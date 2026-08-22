from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict
from app.models.notification import NotificationType
from app.models.document import DocumentType


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    user_id: int
    type: NotificationType
    title: str
    message: Optional[str] = None
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationCount(BaseModel):
    total: int
    unread: int


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: int
    user_id: int
    doc_type: DocumentType
    doc_name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    is_verified: bool
    uploaded_at: datetime
    uploaded_by: Optional[int] = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: int
    user_id: Optional[int] = None
    action: str
    table_name: Optional[str] = None
    record_id: Optional[int] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    user_name: Optional[str] = None


class DashboardEmployeeStats(BaseModel):
    profile_completion_pct: int
    present_today: Optional[str] = None
    pending_leave_requests: int = 0
    approved_leave_days_this_month: int = 0
    used_leave_days_this_year: int = 0
    available_leave_balance: int = 0
    latest_payroll_month: Optional[str] = None
    unread_notifications: int = 0


class DashboardAdminStats(BaseModel):
    total_employees: int = 0
    active_employees: int = 0
    present_today: int = 0
    absent_today: int = 0
    pending_leave_approvals: int = 0
    pending_verifications: int = 0
    payroll_generated_current_month: bool = False
    new_employees_this_month: int = 0
