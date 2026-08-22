from sqlalchemy import (
    Column, BigInteger, String, Boolean, DateTime, Date, Text, ForeignKey,
    Numeric, Enum as SAEnum, Integer, func, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class SalaryComponentType(str, enum.Enum):
    EARNING = "earning"
    DEDUCTION = "deduction"


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    structure_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date)
    base_salary = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    created_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))

    user = relationship("User", back_populates="salary_structures", foreign_keys=[user_id])
    components = relationship("SalaryComponent", back_populates="structure", cascade="all, delete-orphan")
    payroll_records = relationship("PayrollRecord", back_populates="structure")

    __table_args__ = (
        UniqueConstraint("user_id", "effective_from", name="uq_sal_struct_user_eff"),
        CheckConstraint("base_salary > 0", name="chk_base_positive"),
        CheckConstraint(
            "effective_to IS NULL OR effective_to >= effective_from",
            name="chk_effective_dates",
        ),
    )


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    component_id = Column(BigInteger, primary_key=True)
    structure_id = Column(BigInteger, ForeignKey("salary_structures.structure_id", ondelete="CASCADE"), nullable=False, index=True)
    component_name = Column(String(100), nullable=False)
    component_type = Column(SAEnum(SalaryComponentType, name="salary_component_type", create_type=False), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    is_percentage = Column(Boolean, nullable=False, default=False)
    percentage_of = Column(BigInteger, ForeignKey("salary_components.component_id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    structure = relationship("SalaryStructure", back_populates="components")

    __table_args__ = (
        CheckConstraint("amount >= 0", name="chk_amount_not_negative"),
    )


class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    payroll_id = Column(BigInteger, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    pay_month = Column(Integer, nullable=False)
    pay_year = Column(Integer, nullable=False)
    structure_id = Column(BigInteger, ForeignKey("salary_structures.structure_id", ondelete="SET NULL"))
    total_earnings = Column(Numeric(12, 2), nullable=False)
    total_deductions = Column(Numeric(12, 2), nullable=False)
    net_salary = Column(Numeric(12, 2), nullable=False)
    paid_days = Column(Numeric(5, 1), nullable=False)
    lop_days = Column(Numeric(5, 1), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="generated", index=True)
    generated_by = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"))
    generated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    payslip_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="payroll_records", foreign_keys=[user_id])
    structure = relationship("SalaryStructure", back_populates="payroll_records")
    line_items = relationship("PayrollLineItem", back_populates="payroll", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "pay_month", "pay_year", name="uq_payroll_user_month_year"),
        CheckConstraint("pay_month BETWEEN 1 AND 12", name="chk_month_valid"),
        CheckConstraint("net_salary = total_earnings - total_deductions", name="chk_net_calc"),
        CheckConstraint("paid_days > 0", name="chk_pays_positive"),
    )


class PayrollLineItem(Base):
    __tablename__ = "payroll_line_items"

    line_item_id = Column(BigInteger, primary_key=True)
    payroll_id = Column(BigInteger, ForeignKey("payroll_records.payroll_id", ondelete="CASCADE"), nullable=False, index=True)
    component_name = Column(String(100), nullable=False)
    component_type = Column(SAEnum(SalaryComponentType, name="salary_component_type", create_type=False), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    payroll = relationship("PayrollRecord", back_populates="line_items")
