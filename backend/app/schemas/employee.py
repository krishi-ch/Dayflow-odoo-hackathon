from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


class EmployeeProfileBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None
    job_title: str
    department: Optional[str] = None
    joining_date: date
    confirmation_date: Optional[date] = None
    manager_id: Optional[int] = None
    employment_type: str = "full_time"
    work_location: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    profile_picture_url: Optional[str] = None


class EmployeeProfileCreate(EmployeeProfileBase):
    user_id: int


class EmployeeProfileUpdateSelf(BaseModel):
    address: Optional[str] = None
    phone: Optional[str] = None
    profile_picture_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None


class EmployeeProfileUpdateAdmin(EmployeeProfileBase):
    is_active: Optional[bool] = None


class EmployeeProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile_id: int
    user_id: int
    first_name: str
    last_name: str
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_code: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_relation: Optional[str] = None
    job_title: str
    department: Optional[str] = None
    joining_date: date
    confirmation_date: Optional[date] = None
    manager_id: Optional[int] = None
    employment_type: str
    work_location: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_active: bool
    created_at: datetime
