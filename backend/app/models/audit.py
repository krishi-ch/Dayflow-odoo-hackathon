from sqlalchemy import (
    Column, BigInteger, DateTime, ForeignKey, String, Text,
    Enum as SAEnum, func,
)
from sqlalchemy.dialects.postgresql import JSONB, INET
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class AuditAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    REJECT = "reject"
    LOGIN = "login"
    LOGOUT = "logout"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"), index=True)
    action = Column(SAEnum(AuditAction, name="audit_action", create_type=False), nullable=False)
    table_name = Column(String(100))
    record_id = Column(BigInteger)
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    ip_address = Column(INET)
    user_agent = Column(Text)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    user = relationship("User", back_populates="audit_logs", foreign_keys=[user_id])
