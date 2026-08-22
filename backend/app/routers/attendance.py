from datetime import datetime, date, time, timezone as tz
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_self_or_admin
from app import models, schemas
from app.schemas.attendance import (
    AttendanceCheckIn, AttendanceCheckOut, AttendanceStatusUpdate,
    AttendanceResponse, AttendanceStats,
)
from app.schemas.common import NotificationCount
from app.services.audit import AuditLogger, NotificationService
from app.models.attendance import AttendanceStatus
from app.models.audit import AuditAction
from app.models.notification import NotificationType
from app.core.config import settings

router = APIRouter(prefix="/api/v1/attendance", tags=["Attendance"])


def _is_late(check_in: time) -> int:
    expected_min = settings.WORK_START_HOUR * 60 + settings.WORK_START_MINUTE + settings.LATE_THRESHOLD_MINUTES
    check_in_min = check_in.hour * 60 + check_in.minute
    return max(check_in_min - expected_min, 0)


def _is_early(check_out: time) -> int:
    expected_min = settings.WORK_END_HOUR * 60 + settings.WORK_END_MINUTE
    co_min = check_out.hour * 60 + check_out.minute
    return max(expected_min - co_min, 0)


@router.post("/check-in", response_model=AttendanceResponse)
def check_in(
    data: AttendanceCheckIn,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    existing = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == current_user.user_id,
        models.AttendanceRecord.attendance_date == today,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already checked in today. Use check-out.")

    now = datetime.now()
    t = time(now.hour, now.minute, now.second)
    rec = models.AttendanceRecord(
        user_id=current_user.user_id,
        attendance_date=today,
        check_in_time=t,
        status=AttendanceStatus.PRESENT,
        late_arrival_minutes=_is_late(t),
        geo_location_lat=data.geo_location_lat,
        geo_location_lng=data.geo_location_lng,
        ip_address=request.state.client_ip,
    )
    db.add(rec)
    db.flush()
    AuditLogger.log_create(
        db, current_user.user_id, "attendance_records", rec.attendance_id,
        {"action": "check_in", "time": str(t), "late": rec.late_arrival_minutes},
        ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(rec)
    return rec


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(
    data: AttendanceCheckOut,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    rec = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == current_user.user_id,
        models.AttendanceRecord.attendance_date == today,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="No check-in found for today")
    if rec.check_out_time:
        raise HTTPException(status_code=409, detail="Already checked out today")

    now = datetime.now()
    t = time(now.hour, now.minute, now.second)
    rec.check_out_time = t
    rec.early_leave_minutes = _is_early(t)

    if rec.work_duration_minutes and (rec.work_duration_minutes / 60) < settings.HALF_DAY_THRESHOLD_HOURS:
        rec.status = AttendanceStatus.HALF_DAY
    db.flush()
    AuditLogger.log_update(
        db, current_user.user_id, "attendance_records", rec.attendance_id,
        {}, {"action": "check_out", "time": str(t)}, ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/today", response_model=Optional[AttendanceResponse])
def my_attendance_today(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    return db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == current_user.user_id,
        models.AttendanceRecord.attendance_date == today,
    ).first()


@router.get("/my/daily", response_model=List[AttendanceResponse])
def my_daily_attendance(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == current_user.user_id,
        models.AttendanceRecord.attendance_date >= start_date,
        models.AttendanceRecord.attendance_date <= end_date,
    ).order_by(models.AttendanceRecord.attendance_date.desc()).all()
    return records


@router.get("/my/stats", response_model=AttendanceStats)
def my_attendance_stats(
    start_date: date,
    end_date: date,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _compute_stats(db, current_user.user_id, start_date, end_date)


@router.get("/employee/{user_id}", response_model=List[AttendanceResponse])
def admin_view_employee(
    user_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    records = db.query(models.AttendanceRecord).options(
        joinedload(models.AttendanceRecord.user).joinedload(models.User.profile)
    ).filter(
        models.AttendanceRecord.user_id == user_id,
        models.AttendanceRecord.attendance_date >= start_date,
        models.AttendanceRecord.attendance_date <= end_date,
    ).order_by(models.AttendanceRecord.attendance_date.desc()).all()
    out = []
    for r in records:
        resp = AttendanceResponse.model_validate(r)
        if r.user and r.user.profile:
            resp.employee_name = f"{r.user.profile.first_name} {r.user.profile.last_name}"
        out.append(resp)
    return out


@router.put("/employee/{user_id}/{att_date}", response_model=AttendanceResponse)
def admin_update_attendance_status(
    user_id: int,
    att_date: date,
    data: AttendanceStatusUpdate,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rec = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == user_id,
        models.AttendanceRecord.attendance_date == att_date,
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    old_vals = {"status": rec.status.value, "remarks": rec.remarks}
    rec.status = data.status
    rec.remarks = data.remarks
    db.flush()
    AuditLogger.log_update(
        db, current_user.user_id, "attendance_records", rec.attendance_id,
        old_vals, {"status": data.status.value, "remarks": data.remarks},
        ip_address=request.state.client_ip,
    )
    NotificationService.create(
        db, user_id, type_enum=NotificationType.ATTENDANCE_FLAG,
        title=f"Attendance Updated for {att_date}",
        message=f"Status set to {data.status.value}. Remarks: {data.remarks or 'N/A'}",
        reference_id=rec.attendance_id, reference_type="attendance",
    )
    db.commit()
    db.refresh(rec)
    return rec


@router.get("/all", response_model=List[AttendanceResponse])
def admin_all_attendance(
    date: date,
    status: Optional[AttendanceStatus] = None,
    department: Optional[str] = None,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.AttendanceRecord).options(
        joinedload(models.AttendanceRecord.user).joinedload(models.User.profile)
    ).filter(models.AttendanceRecord.attendance_date == date)
    if status:
        q = q.filter(models.AttendanceRecord.status == status)
    if department:
        q = q.join(models.EmployeeProfile, models.EmployeeProfile.user_id == models.AttendanceRecord.user_id).filter(
            models.EmployeeProfile.department == department
        )
    records = q.all()
    out = []
    for r in records:
        resp = AttendanceResponse.model_validate(r)
        if r.user and r.user.profile:
            resp.employee_name = f"{r.user.profile.first_name} {r.user.profile.last_name}"
        out.append(resp)
    return out


def _compute_stats(db, user_id: int, start: date, end: date) -> AttendanceStats:
    stats = AttendanceStats()
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == user_id,
        models.AttendanceRecord.attendance_date.between(start, end),
    ).all()
    total_min = 0
    for r in records:
        if r.status == AttendanceStatus.PRESENT:
            stats.present_days += 1
        elif r.status == AttendanceStatus.ABSENT:
            stats.absent_days += 1
        elif r.status == AttendanceStatus.HALF_DAY:
            stats.half_day_days += 1
        elif r.status == AttendanceStatus.LEAVE:
            stats.leave_days += 1
        if r.work_duration_minutes:
            total_min += r.work_duration_minutes
        stats.total_late_minutes += (r.late_arrival_minutes or 0)
    stats.total_worked_minutes = total_min
    if stats.present_days + stats.half_day_days > 0:
        divisor = stats.present_days + (stats.half_day_days / 2)
        stats.average_work_hours = round((total_min / 60) / divisor, 2)
    return stats
