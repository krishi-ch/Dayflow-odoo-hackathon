from datetime import datetime, date, time
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.models.attendance import AttendanceStatus


class AttendanceCheckIn(BaseModel):
    geo_location_lat: Optional[Decimal] = None
    geo_location_lng: Optional[Decimal] = None


class AttendanceCheckOut(BaseModel):
    geo_location_lat: Optional[Decimal] = None
    geo_location_lng: Optional[Decimal] = None


class AttendanceStatusUpdate(BaseModel):
    status: AttendanceStatus
    remarks: Optional[str] = None


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attendance_id: int
    user_id: int
    attendance_date: date
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    work_duration_minutes: Optional[int] = None
    late_arrival_minutes: int
    early_leave_minutes: int
    status: AttendanceStatus
    remarks: Optional[str] = None
    created_at: datetime
    employee_name: Optional[str] = None


class AttendanceStats(BaseModel):
    present_days: int = 0
    absent_days: int = 0
    half_day_days: int = 0
    leave_days: int = 0
    total_worked_minutes: int = 0
    total_late_minutes: int = 0
    average_work_hours: float = 0.0
