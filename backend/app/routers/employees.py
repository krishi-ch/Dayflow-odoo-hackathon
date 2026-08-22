from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

import secrets
import string
from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_self_or_admin, hash_password
from app import models, schemas
from app.schemas.employee import (
    EmployeeProfileCreate, EmployeeProfileUpdateSelf,
    EmployeeProfileUpdateAdmin, EmployeeProfileResponse,
    EmployeeCreateWithAutoId,
)
from app.services.audit import AuditLogger
from app.models.audit import AuditAction
from app.models.user import UserRole

router = APIRouter(prefix="/api/v1/employees", tags=["Employees"])


def _generate_employee_id(db: Session, first_name: str, last_name: str, joining_year: int) -> str:
    """Generate employee ID in format: [CompanyCode][FirstName2][LastName2][Year][Serial]
    Example: OIJODO20220001
    """
    company_code = "DF"  # Dayflow
    name_code = (first_name[:2] + last_name[:2]).upper()
    year_code = str(joining_year)[-2:]  # last 2 digits of year
    
    # Find max serial for this year pattern
    prefix = f"{company_code}{name_code}{year_code}"
    existing = db.query(models.User.employee_id).filter(
        models.User.employee_id.like(f"{prefix}%")
    ).all()
    
    if not existing:
        serial = 1
    else:
        # Extract serial numbers and find max
        serials = []
        for (eid,) in existing:
            suffix = eid[len(prefix):]
            if suffix.isdigit():
                serials.append(int(suffix))
        serial = max(serials, default=0) + 1
    
    return f"{prefix}{str(serial).zfill(4)}"


def _generate_temp_password() -> str:
    """Generate a temporary password that meets security requirements."""
    chars = string.ascii_letters + string.digits + '!@#$%'
    while True:
        pw = ''.join(secrets.choice(chars) for _ in range(12))
        if (any(c.isupper() for c in pw) and any(c.islower() for c in pw)
            and any(c.isdigit() for c in pw) and any(c in '!@#$%' for c in pw)):
            return pw


@router.post("/create", status_code=201)
def create_employee_with_auto_id(
    data: EmployeeCreateWithAutoId,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin creates a new employee with auto-generated ID and password.
    Format: [CompanyCode][FirstName2][LastName2][Year][Serial]
    """
    if not data.first_name or not data.last_name:
        raise HTTPException(status_code=400, detail="First name and last name are required")
    
    joining_year = data.joining_date.year if data.joining_date else datetime.now(timezone.utc).year
    emp_id = _generate_employee_id(db, data.first_name, data.last_name, joining_year)
    temp_password = _generate_temp_password()
    
    # Create user account
    user = models.User(
        employee_id=emp_id,
        email=f"{emp_id.lower()}@dayflow.tech",
        password_hash=hash_password(temp_password),
        role=UserRole.EMPLOYEE,
        is_verified=True,
    )
    db.add(user)
    db.flush()
    
    # Create leave balances
    current_year = datetime.now(timezone.utc).year
    for lt in db.query(models.LeaveType).filter(models.LeaveType.is_active == True).all():
        lb = models.LeaveBalance(
            user_id=user.user_id,
            leave_type_id=lt.leave_type_id,
            year=current_year,
            entitled_days=lt.default_annual_quota,
        )
        db.add(lb)
    
    # Create profile
    profile_data = data.model_dump(exclude_none=True)
    profile_data['user_id'] = user.user_id
    profile = models.EmployeeProfile(**profile_data, created_by=current_user.user_id)
    db.add(profile)
    db.flush()
    
    AuditLogger.log_create(
        db, current_user.user_id, "employee_profiles", profile.profile_id,
        {**data.model_dump(), 'employee_id': emp_id}, ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(user)
    db.refresh(profile)
    
    return {
        "employee_id": emp_id,
        "email": user.email,
        "temp_password": temp_password,
        "profile": EmployeeProfileResponse.model_validate(profile),
        "message": f"Employee created. Login ID: {emp_id}, Password: {temp_password}"
    }


@router.post("", response_model=EmployeeProfileResponse, status_code=201)
def create_profile(
    data: EmployeeProfileCreate,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(models.EmployeeProfile).filter(models.EmployeeProfile.user_id == data.user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists for this user")

    profile = models.EmployeeProfile(**data.model_dump(exclude_none=True), created_by=current_user.user_id)
    db.add(profile)
    db.flush()
    AuditLogger.log_create(
        db, current_user.user_id, "employee_profiles", profile.profile_id,
        data.model_dump(), ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/me", response_model=EmployeeProfileResponse)
def get_my_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EmployeeProfile).filter(
        models.EmployeeProfile.user_id == current_user.user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Ask HR to create it.")
    return profile


@router.get("/{profile_id}", response_model=EmployeeProfileResponse)
def get_profile(
    profile_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EmployeeProfile).filter(
        models.EmployeeProfile.profile_id == profile_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if not require_self_or_admin(profile.user_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return profile


@router.get("", response_model=List[EmployeeProfileResponse])
def list_employees(
    search: Optional[str] = Query(None, description="Search by name or employee_id"),
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.EmployeeProfile).options(joinedload(models.EmployeeProfile.user))
    if search:
        pattern = f"%{search.lower()}%"
        q = q.outerjoin(models.User, models.User.user_id == models.EmployeeProfile.user_id).filter(
            or_(
                func.lower(models.EmployeeProfile.first_name).like(pattern),
                func.lower(models.EmployeeProfile.last_name).like(pattern),
                func.lower(models.User.employee_id).like(pattern),
            )
        )
    if department:
        q = q.filter(models.EmployeeProfile.department == department)
    if is_active is not None:
        q = q.filter(models.EmployeeProfile.is_active == is_active)
    profiles = q.order_by(models.EmployeeProfile.created_at.desc()).offset(skip).limit(limit).all()
    return profiles


@router.put("/me", response_model=EmployeeProfileResponse)
def update_my_profile(
    data: EmployeeProfileUpdateSelf,
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EmployeeProfile).filter(
        models.EmployeeProfile.user_id == current_user.user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    old_vals = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, val)
    profile.updated_by = current_user.user_id
    db.flush()
    new_vals = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
    AuditLogger.log_update(
        db, current_user.user_id, "employee_profiles", profile.profile_id,
        old_vals, new_vals, ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=EmployeeProfileResponse)
def admin_update_profile(
    profile_id: int,
    data: EmployeeProfileUpdateAdmin,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EmployeeProfile).filter(
        models.EmployeeProfile.profile_id == profile_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    old_vals = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, val)
    profile.updated_by = current_user.user_id
    db.flush()
    if "is_active" in data.model_dump(exclude_unset=True):
        user = db.query(models.User).filter(models.User.user_id == profile.user_id).first()
        if user:
            user.is_active = data.is_active
    new_vals = {c.name: getattr(profile, c.name) for c in profile.__table__.columns}
    AuditLogger.log_update(
        db, current_user.user_id, "employee_profiles", profile.profile_id,
        old_vals, new_vals, ip_address=request.state.client_ip,
    )
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{user_id}/documents", response_model=list[schemas.common.DocumentResponse])
def list_employee_documents(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not require_self_or_admin(user_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    docs = db.query(models.Document).filter(models.Document.user_id == user_id).all()
    return docs
