from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, ForeignKey, func, Text,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class NotificationType(str, enum.Enum):
    INFO = "info"
    LEAVE_REQUEST = "leave_request"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    ATTENDANCE_FLAG = "attendance_flag"
    PAYROLL_GENERATED = "payroll_generated"


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    type = Column(SAEnum(NotificationType, name="notification_type", create_type=False), nullable=False, default=NotificationType.INFO)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    reference_id = Column(BigInteger)
    reference_type = Column(String(50))
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = relationship("User", back_populates="notifications")
