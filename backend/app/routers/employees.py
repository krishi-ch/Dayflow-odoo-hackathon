from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_self_or_admin
from app import models, schemas
from app.schemas.employee import (
    EmployeeProfileCreate, EmployeeProfileUpdateSelf,
    EmployeeProfileUpdateAdmin, EmployeeProfileResponse,
)
from app.services.audit import AuditLogger
from app.models.audit import AuditAction
from app.models.user import UserRole

router = APIRouter(prefix="/api/v1/employees", tags=["Employees"])


def _get_client_ip(request: Request) -> Optional[str]:
    try:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None


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
        data.model_dump(), ip_address=_get_client_ip(request),
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
        old_vals, new_vals, ip_address=_get_client_ip(request),
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
        old_vals, new_vals, ip_address=_get_client_ip(request),
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
