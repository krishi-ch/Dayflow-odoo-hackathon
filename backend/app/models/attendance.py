from sqlalchemy import (
    Column, BigInteger, String, DateTime, Date, Time, Text, ForeignKey,
    Numeric, Enum as SAEnum, Integer, func, UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    LEAVE = "leave"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    attendance_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    work_duration_minutes = Column(Integer)
    late_arrival_minutes = Column(Integer, nullable=False, default=0)
    early_leave_minutes = Column(Integer, nullable=False, default=0)
    status = Column(SAEnum(AttendanceStatus, name="attendance_status", create_type=False), nullable=False, default=AttendanceStatus.PRESENT, index=True)
    remarks = Column(Text)
    geo_location_lat = Column(Numeric(10, 7))
    geo_location_lng = Column(Numeric(10, 7))
    ip_address = Column(INET)
    device_info = Column(String(500))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="attendance")

    __table_args__ = (
        UniqueConstraint("user_id", "attendance_date", name="uq_attendance_user_date"),
        CheckConstraint(
            "check_out_time IS NULL OR check_out_time > check_in_time",
            name="chk_times_valid",
        ),
        CheckConstraint(
            "work_duration_minutes IS NULL OR work_duration_minutes >= 0",
            name="chk_work_duration",
        ),
    )
