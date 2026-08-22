from datetime import datetime
from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, SmallInteger,
    Enum as SAEnum, Integer, Numeric, Text, ForeignKey, UniqueConstraint,
    Date, Time, Index, CheckConstraint, func, Float,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    HR = "hr"
    EMPLOYEE = "employee"


class User(Base):
    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True)
    employee_id = Column(String(32), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole, name="user_role", create_type=False), nullable=False, default=UserRole.EMPLOYEE)
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    verification_token = Column(String(255))
    verification_expiry = Column(DateTime(timezone=True))
    last_login_at = Column(DateTime(timezone=True))
    last_login_ip = Column(INET)
    failed_login_attempts = Column(SmallInteger, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    profile = relationship("EmployeeProfile", back_populates="user", uselist=False, cascade="all, delete-orphan", foreign_keys="EmployeeProfile.user_id")
    leave_requests = relationship("LeaveRequest", back_populates="employee", foreign_keys="LeaveRequest.user_id")
    approved_leaves = relationship("LeaveRequest", back_populates="approver", foreign_keys="LeaveRequest.approver_id")
    leave_balances = relationship("LeaveBalance", back_populates="user", cascade="all, delete-orphan")
    attendance = relationship("AttendanceRecord", back_populates="user", cascade="all, delete-orphan")
    salary_structures = relationship("SalaryStructure", back_populates="user", cascade="all, delete-orphan", foreign_keys="SalaryStructure.user_id")
    payroll_records = relationship("PayrollRecord", back_populates="user", cascade="all, delete-orphan", foreign_keys="PayrollRecord.user_id")
    documents = relationship("Document", back_populates="user", foreign_keys="Document.user_id", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", foreign_keys="AuditLog.user_id")
    managed_employees = relationship("EmployeeProfile", back_populates="manager", foreign_keys="EmployeeProfile.manager_id")

    __table_args__ = (
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="chk_email_format",
        ),
    )
