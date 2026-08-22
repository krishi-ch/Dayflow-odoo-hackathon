from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from app.models.payroll import SalaryComponentType


class SalaryComponentCreate(BaseModel):
    component_name: str
    component_type: SalaryComponentType
    amount: Decimal = Field(..., ge=0)
    is_percentage: bool = False
    percentage_of: Optional[int] = None


class SalaryComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    component_id: int
    component_name: str
    component_type: SalaryComponentType
    amount: Decimal
    is_percentage: bool
    percentage_of: Optional[int] = None


class SalaryStructureCreate(BaseModel):
    user_id: int
    effective_from: date
    effective_to: Optional[date] = None
    base_salary: Decimal = Field(..., gt=0)
    components: List[SalaryComponentCreate] = []


class SalaryStructureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    structure_id: int
    user_id: int
    effective_from: date
    effective_to: Optional[date] = None
    base_salary: Decimal
    created_at: datetime
    components: List[SalaryComponentResponse] = []
    employee_name: Optional[str] = None


class PayrollLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line_item_id: int
    component_name: str
    component_type: SalaryComponentType
    amount: Decimal


class PayrollGenerateRequest(BaseModel):
    pay_month: int = Field(..., ge=1, le=12)
    pay_year: int = Field(..., ge=2000, le=2100)


class PayrollRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payroll_id: int
    user_id: int
    pay_month: int
    pay_year: int
    structure_id: Optional[int] = None
    total_earnings: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    paid_days: Decimal
    lop_days: Decimal
    status: str
    generated_at: datetime
    payslip_url: Optional[str] = None
    line_items: List[PayrollLineItemResponse] = []
    employee_name: Optional[str] = None
