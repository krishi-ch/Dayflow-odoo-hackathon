from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, Date, Text, ForeignKey,
    Numeric, func, CheckConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class EmployeeProfile(Base):
    __tablename__ = "employee_profiles"

    profile_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date)
    gender = Column(String(20))
    phone = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    zip_code = Column(String(20))
    emergency_contact = Column(String(20))
    emergency_relation = Column(String(50))
    job_title = Column(String(150), nullable=False)
    department = Column(String(100), index=True)
    joining_date = Column(Date, nullable=False)
    confirmation_date = Column(Date)
    manager_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    employment_type = Column(String(50), nullable=False, default="full_time")
    work_location = Column(String(150))
    pan_number = Column(String(20))
    aadhaar_number = Column(String(20))
    bank_account = Column(String(50))
    ifsc_code = Column(String(20))
    profile_picture_url = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))
    updated_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))

    user = relationship("User", back_populates="profile", foreign_keys=[user_id])
    manager = relationship("User", back_populates="managed_employees", foreign_keys=[manager_id])
    __table_args__ = (
        CheckConstraint(
            "joining_date <= CURRENT_DATE + INTERVAL '30 days'",
            name="chk_joining_date_not_future",
        ),
    )
