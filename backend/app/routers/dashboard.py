from __future__ import annotations

from datetime import datetime, date, timezone as tz
from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app import models
from app.schemas.common import (
    DashboardEmployeeStats, DashboardAdminStats, NotificationCount,
    NotificationResponse, AuditLogResponse,
)
from app.models.leave import LeaveStatus
from app.models.attendance import AttendanceStatus
from app.utils.helpers import profile_completion_percent, get_month_range

router = APIRouter(prefix="/api/v1", tags=["Dashboard & Common"])


# --- Employee card data for dashboard grid ---
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class DashboardEmployeeCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    employee_id: str
    email: str
    role: str
    profile: Optional[dict] = None


@router.get("/dashboard/employees", response_model=List[DashboardEmployeeCard])
def dashboard_employees(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all active users with their profiles for the employee cards grid."""
    users = (
        db.query(models.User)
        .options(joinedload(models.User.profile))
        .filter(models.User.is_active == True)
        .all()
    )
    result = []
    for u in users:
        profile_data = None
        if u.profile:
            profile_data = {
                "first_name": u.profile.first_name,
                "last_name": u.profile.last_name,
                "job_title": u.profile.job_title,
                "department": u.profile.department,
                "work_location": u.profile.work_location,
                "phone": u.profile.phone,
                "employment_type": u.profile.employment_type,
                "joining_date": str(u.profile.joining_date) if u.profile.joining_date else None,
                "profile_picture_url": u.profile.profile_picture_url,
                "manager_id": u.profile.manager_id,
            }
        result.append(DashboardEmployeeCard(
            user_id=u.user_id,
            employee_id=u.employee_id,
            email=u.email,
            role=u.role.value if hasattr(u.role, 'value') else u.role,
            profile=profile_data,
        ))
    return result


def _emp_name_from_user(db, user_id: Optional[int]):
    if not user_id:
        return None
    p = db.query(models.EmployeeProfile).filter(models.EmployeeProfile.user_id == user_id).first()
    if p:
        return f"{p.first_name} {p.last_name}"
    return None


@router.get("/dashboard/employee", response_model=DashboardEmployeeStats)
def employee_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EmployeeProfile).filter(models.EmployeeProfile.user_id == current_user.user_id).first()
    today = date.today()
    stats = DashboardEmployeeStats()
    stats.profile_completion_pct = profile_completion_percent(profile)

    att = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == current_user.user_id,
        models.AttendanceRecord.attendance_date == today,
    ).first()
    stats.present_today = att.status.value if att else None

    stats.pending_leave_requests = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.user_id == current_user.user_id,
        models.LeaveRequest.status == LeaveStatus.PENDING,
    ).count()

    cur_month_start, cur_month_end = get_month_range(today.year, today.month)
    stats.approved_leave_days_this_month = db.query(
        func.coalesce(func.sum(models.LeaveRequest.total_days), 0)
    ).filter(
        models.LeaveRequest.user_id == current_user.user_id,
        models.LeaveRequest.status == LeaveStatus.APPROVED,
        and_(models.LeaveRequest.start_date <= cur_month_end, models.LeaveRequest.end_date >= cur_month_start),
    ).scalar() or 0

    stats.used_leave_days_this_year = db.query(
        func.coalesce(func.sum(models.LeaveBalance.used_days), 0)
    ).filter(
        models.LeaveBalance.user_id == current_user.user_id,
        models.LeaveBalance.year == today.year,
    ).scalar() or 0

    stats.available_leave_balance = db.query(
        func.coalesce(func.sum(
            models.LeaveBalance.entitled_days + models.LeaveBalance.carry_forward_days - models.LeaveBalance.used_days
        ), 0)
    ).filter(
        models.LeaveBalance.user_id == current_user.user_id,
        models.LeaveBalance.year == today.year,
    ).scalar() or 0

    latest_pr = db.query(models.PayrollRecord).filter(
        models.PayrollRecord.user_id == current_user.user_id,
    ).order_by(models.PayrollRecord.pay_year.desc(), models.PayrollRecord.pay_month.desc()).first()
    if latest_pr:
        stats.latest_payroll_month = f"{latest_pr.pay_month}/{latest_pr.pay_year}"
    else:
        stats.latest_payroll_month = None

    stats.unread_notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id,
        models.Notification.is_read == False,
    ).count()
    return stats


@router.get("/dashboard/admin", response_model=DashboardAdminStats)
def admin_dashboard(
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    today = date.today()
    s = DashboardAdminStats()
    s.total_employees = db.query(models.User).filter(models.User.role == "employee").count()
    s.active_employees = db.query(models.User).filter(
        models.User.role == "employee", models.User.is_active == True, models.User.is_verified == True,
    ).count()
    s.present_today = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.attendance_date == today,
        models.AttendanceRecord.status == AttendanceStatus.PRESENT,
    ).count()
    s.absent_today = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.attendance_date == today,
        models.AttendanceRecord.status == AttendanceStatus.ABSENT,
    ).count()
    s.pending_leave_approvals = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.status == LeaveStatus.PENDING,
    ).count()
    s.pending_verifications = db.query(models.User).filter(
        models.User.is_verified == False, models.User.is_active == True,
    ).count()

    cur_month_start, _ = get_month_range(today.year, today.month)
    s.new_employees_this_month = db.query(models.EmployeeProfile).filter(
        models.EmployeeProfile.joining_date >= cur_month_start,
        models.EmployeeProfile.joining_date <= today,
    ).count()

    s.payroll_generated_current_month = db.query(models.PayrollRecord).filter(
        models.PayrollRecord.pay_month == today.month,
        models.PayrollRecord.pay_year == today.year,
    ).first() is not None

    return s


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    only_unread: bool = False,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Notification).filter(models.Notification.user_id == current_user.user_id)
    if only_unread:
        q = q.filter(models.Notification.is_read == False)
    return q.order_by(models.Notification.created_at.desc()).limit(limit).all()


@router.get("/notifications/count", response_model=NotificationCount)
def notification_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.audit import NotificationService as NS
    total, unread = NS.count(db, current_user.user_id)
    return NotificationCount(total=total, unread=unread)


@router.post("/notifications/{n_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    n_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.audit import NotificationService as NS
    notif = NS.mark_read(db, current_user.user_id, n_id)
    if not notif:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/notifications/read-all", status_code=200)
def mark_all_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.audit import NotificationService as NS
    NS.mark_all_read(db, current_user.user_id)
    db.commit()
    return {"detail": "All notifications marked as read"}


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def audit_logs(
    table: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = Query(100, le=500),
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.AuditLog)
    if table:
        q = q.filter(models.AuditLog.table_name == table)
    if action:
        q = q.filter(models.AuditLog.action == action)
    if user_id:
        q = q.filter(models.AuditLog.user_id == user_id)
    logs = q.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()
    out = []
    for l in logs:
        r = AuditLogResponse.model_validate(l)
        r.user_name = _emp_name_from_user(db, l.user_id)
        out.append(r)
    return out
