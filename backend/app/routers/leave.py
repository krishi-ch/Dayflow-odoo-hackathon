from datetime import datetime, date, timezone as tz
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_self_or_admin
from app import models, schemas
from app.schemas.leave import (
    LeaveTypeResponse, LeaveBalanceResponse,
    LeaveRequestCreate, LeaveRequestAction, LeaveRequestResponse,
)
from app.services.audit import AuditLogger, NotificationService
from app.models.leave import LeaveStatus
from app.models.audit import AuditAction
from app.models.notification import NotificationType
from app.utils.helpers import calculate_total_leave_days

router = APIRouter(prefix="/api/v1/leave", tags=["Leave Management"])


@router.get("/types", response_model=List[LeaveTypeResponse])
def list_leave_types(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.LeaveType)
    if not include_inactive:
        q = q.filter(models.LeaveType.is_active == True)
    return q.order_by(models.LeaveType.name).all()


@router.get("/balances/my", response_model=List[LeaveBalanceResponse])
def my_leave_balances(
    year: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if year is None:
        year = datetime.now(tz.utc).year
    balances = (
        db.query(models.LeaveBalance)
        .options(joinedload(models.LeaveBalance.leave_type))
        .filter(models.LeaveBalance.user_id == current_user.user_id, models.LeaveBalance.year == year)
        .all()
    )
    return balances


@router.get("/balances/{user_id}", response_model=List[LeaveBalanceResponse])
def admin_leave_balances(
    user_id: int,
    year: Optional[int] = None,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if year is None:
        year = datetime.now(tz.utc).year
    return (
        db.query(models.LeaveBalance)
        .options(joinedload(models.LeaveBalance.leave_type))
        .filter(models.LeaveBalance.user_id == user_id, models.LeaveBalance.year == year)
        .all()
    )


@router.post("/request", response_model=LeaveRequestResponse, status_code=201)
def apply_leave(
    data: LeaveRequestCreate,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    leave_type = db.query(models.LeaveType).filter(
        models.LeaveType.leave_type_id == data.leave_type_id,
        models.LeaveType.is_active == True,
    ).first()
    if not leave_type:
        raise HTTPException(status_code=400, detail="Invalid leave type")

    total_days = calculate_total_leave_days(
        data.start_date, data.end_date, data.half_day_start, data.half_day_end
    )
    if total_days <= 0:
        raise HTTPException(status_code=400, detail="Invalid leave duration")

    current_year = data.start_date.year
    balance = db.query(models.LeaveBalance).filter(
        models.LeaveBalance.user_id == current_user.user_id,
        models.LeaveBalance.leave_type_id == data.leave_type_id,
        models.LeaveBalance.year == current_year,
    ).first()
    if not balance:
        raise HTTPException(status_code=400, detail=f"No leave balance initialized for year {current_year}")

    remaining = (balance.entitled_days + balance.carry_forward_days) - balance.used_days
    if Decimal(str(total_days)) > remaining and leave_type.name.value != "unpaid":
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. Available: {remaining} days, Requested: {total_days} days",
        )

    overlapping = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.user_id == current_user.user_id,
        models.LeaveRequest.status != LeaveStatus.REJECTED,
        models.LeaveRequest.start_date <= data.end_date,
        models.LeaveRequest.end_date >= data.start_date,
    ).first()
    if overlapping:
        raise HTTPException(
            status_code=409,
            detail=f"Leave already exists for overlapping dates (#{overlapping.leave_request_id})",
        )

    req = models.LeaveRequest(
        user_id=current_user.user_id,
        leave_type_id=data.leave_type_id,
        start_date=data.start_date,
        end_date=data.end_date,
        total_days=Decimal(str(total_days)),
        half_day_start=data.half_day_start,
        half_day_end=data.half_day_end,
        reason=data.reason,
        supporting_doc_url=data.supporting_doc_url,
        status=LeaveStatus.PENDING,
    )
    db.add(req)
    db.flush()
    AuditLogger.log_create(
        db, current_user.user_id, "leave_requests", req.leave_request_id,
        {
            "leave_type": leave_type.name.value,
            "start": str(data.start_date), "end": str(data.end_date),
            "total_days": str(total_days), "reason": data.reason,
        },
        ip_address=request.state.client_ip,
    )

    admins = db.query(models.User).filter(
        models.User.role.in_(["admin", "hr"]),
        models.User.is_active == True,
    ).all()
    for admin in admins:
        NotificationService.create(
            db, admin.user_id, NotificationType.LEAVE_REQUEST,
            title=f"New Leave Request: #{req.leave_request_id}",
            message=f"Leave request from user {current_user.employee_id} for {total_days} day(s) of {leave_type.name.value} ({data.start_date} to {data.end_date})",
            reference_id=req.leave_request_id, reference_type="leave_request",
        )
    db.commit()
    db.refresh(req)
    resp = LeaveRequestResponse.model_validate(req)
    resp.leave_type_name = leave_type.name
    return resp


@router.get("/my/requests", response_model=List[LeaveRequestResponse])
def my_leave_requests(
    status: Optional[LeaveStatus] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.LeaveRequest)
        .options(joinedload(models.LeaveRequest.leave_type), joinedload(models.LeaveRequest.employee).joinedload(models.User.profile))
        .filter(models.LeaveRequest.user_id == current_user.user_id)
    )
    if status:
        q = q.filter(models.LeaveRequest.status == status)
    reqs = q.order_by(models.LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()
    out = []
    for r in reqs:
        resp = LeaveRequestResponse.model_validate(r)
        if r.leave_type:
            resp.leave_type_name = r.leave_type.name
        out.append(resp)
    return out


@router.get("/requests/pending", response_model=List[LeaveRequestResponse])
def admin_pending_requests(
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    reqs = (
        db.query(models.LeaveRequest)
        .options(joinedload(models.LeaveRequest.leave_type), joinedload(models.LeaveRequest.employee).joinedload(models.User.profile))
        .filter(models.LeaveRequest.status == LeaveStatus.PENDING)
        .order_by(models.LeaveRequest.created_at.asc())
        .all()
    )
    out = []
    for r in reqs:
        resp = LeaveRequestResponse.model_validate(r)
        if r.leave_type:
            resp.leave_type_name = r.leave_type.name
        if r.employee and r.employee.profile:
            resp.employee_name = f"{r.employee.profile.first_name} {r.employee.profile.last_name}"
        out.append(resp)
    return out


@router.get("/requests/all", response_model=List[LeaveRequestResponse])
def admin_all_requests(
    status: Optional[LeaveStatus] = None,
    user_id: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.LeaveRequest)
        .options(joinedload(models.LeaveRequest.leave_type), joinedload(models.LeaveRequest.employee).joinedload(models.User.profile))
    )
    if status:
        q = q.filter(models.LeaveRequest.status == status)
    if user_id:
        q = q.filter(models.LeaveRequest.user_id == user_id)
    if start and end:
        q = q.filter(
            and_(models.LeaveRequest.start_date <= end, models.LeaveRequest.end_date >= start)
        )
    reqs = q.order_by(models.LeaveRequest.created_at.desc()).offset(skip).limit(limit).all()
    out = []
    for r in reqs:
        resp = LeaveRequestResponse.model_validate(r)
        if r.leave_type:
            resp.leave_type_name = r.leave_type.name
        if r.employee and r.employee.profile:
            resp.employee_name = f"{r.employee.profile.first_name} {r.employee.profile.last_name}"
        out.append(resp)
    return out


@router.post("/requests/{request_id}/action", response_model=LeaveRequestResponse)
def admin_action_on_leave(
    request_id: int,
    data: LeaveRequestAction,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    req = db.query(models.LeaveRequest).options(joinedload(models.LeaveRequest.leave_type)).filter(
        models.LeaveRequest.leave_request_id == request_id
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if req.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=409, detail=f"Leave already {req.status.value}")

    now = datetime.now(tz.utc)
    old_vals = {"status": req.status.value, "approver": None, "comments": None}
    req.status = data.action
    req.approver_id = current_user.user_id
    req.admin_comments = data.admin_comments
    if data.action == LeaveStatus.APPROVED:
        req.approved_at = now
    elif data.action == LeaveStatus.REJECTED:
        req.rejected_at = now
    db.flush()
    new_vals = {
        "status": data.action.value,
        "approver_id": current_user.user_id,
        "comments": data.admin_comments,
    }
    AuditLogger.log_update(
        db, current_user.user_id, "leave_requests", request_id,
        old_vals, new_vals, ip_address=request.state.client_ip,
    )

    notif_type = NotificationType.LEAVE_APPROVED if data.action == LeaveStatus.APPROVED else NotificationType.LEAVE_REJECTED
    title = f"Leave {data.action.value.capitalize()}: #{request_id}"
    msg = f"Your {req.leave_type.name.value if req.leave_type else ''} leave from {req.start_date} to {req.end_date} has been {data.action.value}."
    if data.admin_comments:
        msg += f" Comments: {data.admin_comments}"
    NotificationService.create(
        db, req.user_id, notif_type, title=title, message=msg,
        reference_id=request_id, reference_type="leave_request",
    )

    if data.action == LeaveStatus.APPROVED and req.leave_type:
        for single_date in _date_range(req.start_date, req.end_date):
            existing = db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.user_id == req.user_id,
                models.AttendanceRecord.attendance_date == single_date,
            ).first()
            if existing:
                existing.status = "leave"
                existing.remarks = f"Leave #{request_id}: {req.leave_type.name.value}"
            else:
                db.add(models.AttendanceRecord(
                    user_id=req.user_id, attendance_date=single_date,
                    status="leave", remarks=f"Leave #{request_id}: {req.leave_type.name.value}",
                ))

    db.commit()
    db.refresh(req)
    resp = LeaveRequestResponse.model_validate(req)
    if req.leave_type:
        resp.leave_type_name = req.leave_type.name
    return resp


def _date_range(start: date, end: date):
    from datetime import timedelta
    for n in range(int((end - start).days) + 1):
        d = start + timedelta(n)
        if d.weekday() < 5:
            yield d
