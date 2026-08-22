from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, ForeignKey, Numeric,
    Enum as SAEnum, func,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class DocumentType(str, enum.Enum):
    RESUME = "resume"
    ID_PROOF = "id_proof"
    ADDRESS_PROOF = "address_proof"
    EDUCATION_CERT = "education_cert"
    EXPERIENCE_LETTER = "experience_letter"
    OTHER = "other"


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    doc_type = Column(SAEnum(DocumentType, name="document_type", create_type=False), nullable=False, index=True)
    doc_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size_bytes = Column(BigInteger)
    mime_type = Column(String(100))
    uploaded_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))
    verified_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))
    is_verified = Column(Boolean, nullable=False, default=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="documents", foreign_keys=[user_id])