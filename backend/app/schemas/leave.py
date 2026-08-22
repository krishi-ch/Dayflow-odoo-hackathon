from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.leave import LeaveStatus, LeaveTypeName


class LeaveTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    leave_type_id: int
    name: LeaveTypeName
    description: Optional[str] = None
    default_annual_quota: Decimal
    carry_forward: bool
    max_carry_forward: Decimal
    requires_proof: bool
    is_active: bool


class LeaveBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    leave_balance_id: int
    user_id: int
    leave_type_id: int
    year: int
    entitled_days: Decimal
    used_days: Decimal
    carry_forward_days: Decimal
    available_days: Optional[Decimal] = None
    leave_type: Optional[LeaveTypeResponse] = None

    @model_validator(mode='after')
    def compute_available(self):
        if self.available_days is None:
            total = (self.entitled_days or Decimal(0)) + (self.carry_forward_days or Decimal(0)) - (self.used_days or Decimal(0))
            self.available_days = max(total, Decimal(0))
        return self


class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    half_day_start: bool = False
    half_day_end: bool = False
    reason: str = Field(..., min_length=5, max_length=1000)
    supporting_doc_url: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("End date cannot be before start date")
        return v


class LeaveRequestAction(BaseModel):
    action: LeaveStatus
    admin_comments: Optional[str] = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v):
        if v not in (LeaveStatus.APPROVED, LeaveStatus.REJECTED):
            raise ValueError("Action must be 'approved' or 'rejected'")
        return v


class LeaveRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    leave_request_id: int
    user_id: int
    leave_type_id: int
    start_date: date
    end_date: date
    total_days: Decimal
    half_day_start: bool
    half_day_end: bool
    reason: str
    status: LeaveStatus
    approver_id: Optional[int] = None
    admin_comments: Optional[str] = None
    supporting_doc_url: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    created_at: datetime
    employee_name: Optional[str] = None
    leave_type_name: Optional[LeaveTypeName] = None
