from datetime import datetime
from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, Date, Text, ForeignKey,
    Numeric, Enum as SAEnum, func, CheckConstraint, UniqueConstraint,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class LeaveTypeName(str, enum.Enum):
    PAID = "paid"
    SICK = "sick"
    UNPAID = "unpaid"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    CASUAL = "casual"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LeaveType(Base):
    __tablename__ = "leave_types"

    leave_type_id = Column(BigInteger, primary_key=True)
    name = Column(SAEnum(LeaveTypeName, name="leave_type_name", create_type=False), unique=True, nullable=False)
    description = Column(Text)
    default_annual_quota = Column(Numeric(5, 1), nullable=False, default=0)
    carry_forward = Column(Boolean, nullable=False, default=False)
    max_carry_forward = Column(Numeric(5, 1), nullable=False, default=0)
    requires_proof = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    balances = relationship("LeaveBalance", back_populates="leave_type", cascade="all, delete-orphan")
    requests = relationship("LeaveRequest", back_populates="leave_type")


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    leave_balance_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(BigInteger, ForeignKey("leave_types.leave_type_id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(BigInteger, nullable=False)
    entitled_days = Column(Numeric(5, 1), nullable=False, default=0)
    used_days = Column(Numeric(5, 1), nullable=False, default=0)
    carry_forward_days = Column(Numeric(5, 1), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")

    __table_args__ = (
        UniqueConstraint("user_id", "leave_type_id", "year", name="uq_leave_balance_user_type_year"),
        CheckConstraint("used_days <= entitled_days + carry_forward_days", name="chk_used_not_exceed"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="chk_year_valid"),
    )


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_request_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(BigInteger, ForeignKey("leave_types.leave_type_id", ondelete="RESTRICT"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Numeric(5, 1), nullable=False)
    half_day_start = Column(Boolean, nullable=False, default=False)
    half_day_end = Column(Boolean, nullable=False, default=False)
    reason = Column(Text, nullable=False)
    status = Column(SAEnum(LeaveStatus, name="leave_status", create_type=False), nullable=False, default=LeaveStatus.PENDING, index=True)
    approver_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    admin_comments = Column(Text)
    supporting_doc_url = Column(String(500))
    approved_at = Column(DateTime(timezone=True))
    rejected_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    employee = relationship("User", back_populates="leave_requests", foreign_keys=[user_id])
    approver = relationship("User", back_populates="approved_leaves", foreign_keys=[approver_id])
    leave_type = relationship("LeaveType", back_populates="requests")
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="chk_dates_valid"),
        CheckConstraint("total_days > 0", name="chk_total_days_positive"),
        CheckConstraint(
            "(status = 'approved' AND approved_at IS NOT NULL) OR "
            "(status = 'rejected' AND rejected_at IS NOT NULL) OR "
            "(status = 'pending' AND approved_at IS NULL AND rejected_at IS NULL)",
            name="chk_status_timestamps",
        ),
    )
