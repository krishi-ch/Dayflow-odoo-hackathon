from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    decode_token, generate_verification_token, get_current_user,
)
from app import models, schemas
from app.schemas.auth import (
    UserCreate, UserLogin, TokenResponse, UserResponse,
    TokenRefresh, VerificationRequest,
)
from app.services.audit import AuditLogger, NotificationService
from app.models.audit import AuditAction
from app.models.notification import NotificationType
from app.core.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> Optional[str]:
    try:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None


@router.post("/signup", response_model=UserResponse, status_code=201)
def signup(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    existing_email = db.query(models.User).filter(
        func.lower(models.User.email) == func.lower(data.email)
    ).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")

    existing_emp = db.query(models.User).filter(
        models.User.employee_id == data.employee_id
    ).first()
    if existing_emp:
        raise HTTPException(status_code=409, detail="Employee ID already in use")

    token, expiry = generate_verification_token()
    user = models.User(
        employee_id=data.employee_id,
        email=data.email.lower().strip(),
        password_hash=hash_password(data.password),
        role=data.role.value if hasattr(data.role, "value") else data.role,
        verification_token=token,
        verification_expiry=expiry,
    )
    db.add(user)
    db.flush()

    current_year = datetime.now(timezone.utc).year
    for lt in db.query(models.LeaveType).filter(models.LeaveType.is_active == True).all():
        lb = models.LeaveBalance(
            user_id=user.user_id,
            leave_type_id=lt.leave_type_id,
            year=current_year,
            entitled_days=lt.default_annual_quota,
        )
        db.add(lb)

    AuditLogger.log_create(
        db, user.user_id, "users", user.user_id,
        {"email": user.email, "role": user.role, "employee_id": user.employee_id},
        ip_address=_get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/verify", response_model=TokenResponse)
def verify_email(data: VerificationRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.verification_token == data.token,
        models.User.is_verified == False,
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or already used verification token")
    if user.verification_expiry and user.verification_expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token expired")

    user.is_verified = True
    user.verification_token = None
    user.verification_expiry = None
    db.commit()
    db.refresh(user)

    access = create_access_token(data={"sub": str(user.user_id), "role": user.role.value})
    refresh = create_refresh_token(data={"sub": str(user.user_id), "role": user.role.value})
    return TokenResponse(access_token=access, refresh_token=refresh, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    user = db.query(models.User).filter(
        func.lower(models.User.email) == func.lower(form_data.username.strip())
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact HR.")
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=423, detail="Account locked due to too many failed attempts. Try again later.")

    if not verify_password(form_data.password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = now + timezone.timedelta(minutes=15)
            user.failed_login_attempts = 0
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    if request:
        user.last_login_ip = _get_client_ip(request)

    AuditLogger.log(
        db, user.user_id, AuditAction.LOGIN,
        "users", user.user_id, ip_address=_get_client_ip(request),
    )
    db.commit()
    db.refresh(user)

    access = create_access_token(data={"sub": str(user.user_id), "role": user.role.value})
    refresh = create_refresh_token(data={"sub": str(user.user_id), "role": user.role.value})
    return TokenResponse(access_token=access, refresh_token=refresh, user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: TokenRefresh, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = int(payload["sub"])
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user or not user.is_active or not user.is_verified:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access = create_access_token(data={"sub": str(user.user_id), "role": user.role.value})
    refresh = create_refresh_token(data={"sub": str(user.user_id), "role": user.role.value})
    return TokenResponse(access_token=access, refresh_token=refresh, user=UserResponse.model_validate(user))


@router.post("/logout", status_code=200)
def logout(request: Request, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    AuditLogger.log(
        db, current_user.user_id, AuditAction.LOGOUT,
        "users", current_user.user_id, ip_address=_get_client_ip(request),
    )
    db.commit()
    return {"detail": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
