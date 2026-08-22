from __future__ import annotations

from datetime import datetime, date, timezone as tz
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_

from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_self_or_admin
from app import models, schemas
from app.schemas.payroll import (
    SalaryStructureCreate, SalaryStructureResponse,
    PayrollGenerateRequest, PayrollRecordResponse,
)
from app.services.audit import AuditLogger, NotificationService
from app.models.audit import AuditAction
from app.models.notification import NotificationType
from app.models.payroll import SalaryComponentType
from app.utils.helpers import (
    generate_payslip_pdf, generate_csv, get_month_range, count_weekdays,
)

router = APIRouter(prefix="/api/v1/payroll", tags=["Payroll & Salary"])


def _get_client_ip(request: Request) -> Optional[str]:
    try:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None


@router.post("/structures", response_model=SalaryStructureResponse, status_code=201)
def create_salary_structure(
    data: SalaryStructureCreate,
    request: Request,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.effective_to and data.effective_to < data.effective_from:
        raise HTTPException(status_code=400, detail="effective_to must be >= effective_from")

    overlap = db.query(models.SalaryStructure).filter(
        models.SalaryStructure.user_id == data.user_id,
        and_(
            models.SalaryStructure.effective_from <= (data.effective_to or date(2099, 12, 31)),
            (models.SalaryStructure.effective_to.is_(None) |
             (models.SalaryStructure.effective_to >= data.effective_from)),
        ),
    ).first()
    if overlap:
        raise HTTPException(status_code=409, detail=f"Overlapping structure exists (ID {overlap.structure_id})")

    struct = models.SalaryStructure(
        user_id=data.user_id,
        effective_from=data.effective_from,
        effective_to=data.effective_to,
        base_salary=data.base_salary,
        created_by=current_user.user_id,
    )
    db.add(struct)
    db.flush()

    for comp in data.components:
        db.add(models.SalaryComponent(
            structure_id=struct.structure_id,
            component_name=comp.component_name,
            component_type=comp.component_type,
            amount=comp.amount,
            is_percentage=comp.is_percentage,
            percentage_of=comp.percentage_of,
        ))

    AuditLogger.log_create(
        db, current_user.user_id, "salary_structures", struct.structure_id,
        data.model_dump(), ip_address=_get_client_ip(request),
    )
    db.commit()
    db.refresh(struct)
    resp = SalaryStructureResponse.model_validate(struct)
    if user.profile:
        resp.employee_name = f"{user.profile.first_name} {user.profile.last_name}"
    return resp


@router.get("/structures/my", response_model=List[SalaryStructureResponse])
def my_salary_structures(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    structs = db.query(models.SalaryStructure).options(
        joinedload(models.SalaryStructure.components)
    ).filter(models.SalaryStructure.user_id == current_user.user_id).order_by(
        models.SalaryStructure.effective_from.desc()
    ).all()
    return structs


@router.get("/structures/employee/{user_id}", response_model=List[SalaryStructureResponse])
def admin_employee_structures(
    user_id: int,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    structs = db.query(models.SalaryStructure).options(
        joinedload(models.SalaryStructure.components)
    ).filter(models.SalaryStructure.user_id == user_id).order_by(
        models.SalaryStructure.effective_from.desc()
    ).all()
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    out = []
    for s in structs:
        r = SalaryStructureResponse.model_validate(s)
        if user and user.profile:
            r.employee_name = f"{user.profile.first_name} {user.profile.last_name}"
        out.append(r)
    return out


def _resolve_component_amount(components: list, component) -> Decimal:
    if not component.is_percentage:
        return Decimal(component.amount)
    base_comp = next((c for c in components if c.component_id == component.percentage_of), None)
    if not base_comp:
        return Decimal(0)
    base_val = _resolve_component_amount(components, base_comp)
    return (base_val * Decimal(component.amount)) / Decimal(100)


def _calc_for_user(db, user, pay_month, pay_year, paid_days) -> tuple[Decimal, Decimal, Decimal, list, int | None]:
    start, end = get_month_range(pay_year, pay_month)
    struct = (
        db.query(models.SalaryStructure)
        .options(joinedload(models.SalaryStructure.components))
        .filter(models.SalaryStructure.user_id == user.user_id)
        .filter(models.SalaryStructure.effective_from <= end)
        .filter(
            (models.SalaryStructure.effective_to.is_(None)) |
            (models.SalaryStructure.effective_to >= start)
        )
        .order_by(models.SalaryStructure.effective_from.desc())
        .first()
    )
    if not struct:
        raise ValueError(f"No salary structure for user {user.user_id} covering {pay_month}/{pay_year}")

    comps = struct.components
    total_earnings = Decimal(0)
    total_deductions = Decimal(0)
    lines = []
    for comp in comps:
        amt = _resolve_component_amount(comps, comp)
        prorated = (amt * Decimal(str(paid_days))) / Decimal(count_weekdays(start, end))
        prorated = Decimal(round(prorated, 2))
        lines.append({
            "name": comp.component_name,
            "type": comp.component_type,
            "amount": prorated,
        })
        if comp.component_type == SalaryComponentType.EARNING:
            total_earnings += prorated
        else:
            total_deductions += prorated

    base_component = next((c for c in comps if c.component_name.lower() == "basic" or c.component_name.lower() == "base salary"), None)
    if not base_component and len(comps) == 0:
        base_line = {"name": "Base Salary", "type": SalaryComponentType.EARNING, "amount": Decimal(round(struct.base_salary * Decimal(str(paid_days)) / Decimal(count_weekdays(start, end)), 2))}
        lines.insert(0, base_line)
        total_earnings += base_line["amount"]
    net = total_earnings - total_deductions
    return total_earnings, total_deductions, Decimal(round(net, 2)), lines, struct.structure_id


@router.post("/generate", response_model=List[PayrollRecordResponse])
def generate_payroll(
    data: PayrollGenerateRequest,
    request: Request,
    user_ids: Optional[str] = Query(None, description="Comma-separated user IDs (optional; all active if omitted)"),
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    start, end = get_month_range(data.pay_year, data.pay_month)
    total_month_days = count_weekdays(start, end)

    users = db.query(models.User).filter(models.User.is_active == True)
    if user_ids:
        id_list = [int(x.strip()) for x in user_ids.split(",") if x.strip().isdigit()]
        users = users.filter(models.User.user_id.in_(id_list))
    users = users.all()

    results = []
    errors = []
    for user in users:
        profile = db.query(models.EmployeeProfile).filter(models.EmployeeProfile.user_id == user.user_id).first()
        if not profile:
            continue
        if profile.joining_date > end:
            continue
        existing = db.query(models.PayrollRecord).filter(
            models.PayrollRecord.user_id == user.user_id,
            models.PayrollRecord.pay_month == data.pay_month,
            models.PayrollRecord.pay_year == data.pay_year,
        ).first()
        if existing:
            results.append(existing)
            continue

        attendance_count = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.user_id == user.user_id,
            models.AttendanceRecord.attendance_date.between(start, end),
            models.AttendanceRecord.status.in_(["present", "half_day", "leave"]),
        ).count()
        half_days = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.user_id == user.user_id,
            models.AttendanceRecord.attendance_date.between(start, end),
            models.AttendanceRecord.status == "half_day",
        ).count()
        paid_days = Decimal(str(attendance_count - half_days * 0.5))
        if paid_days <= 0:
            paid_days = Decimal(str(max(0, total_month_days - max(0, profile.joining_date.day if profile.joining_date > start else 0))))
        lop_days = Decimal(max(total_month_days - paid_days, 0))

        try:
            earnings, deductions, net, lines, struct_id = _calc_for_user(db, user, data.pay_month, data.pay_year, float(paid_days))
        except ValueError as e:
            errors.append({"user_id": user.user_id, "error": str(e)})
            continue

        rec = models.PayrollRecord(
            user_id=user.user_id,
            pay_month=data.pay_month,
            pay_year=data.pay_year,
            structure_id=struct_id,
            total_earnings=earnings,
            total_deductions=deductions,
            net_salary=net,
            paid_days=paid_days,
            lop_days=lop_days,
            status="generated",
            generated_by=current_user.user_id,
        )
        db.add(rec)
        db.flush()
        for ln in lines:
            db.add(models.PayrollLineItem(
                payroll_id=rec.payroll_id,
                component_name=ln["name"],
                component_type=ln["type"],
                amount=ln["amount"],
            ))
        AuditLogger.log_create(
            db, current_user.user_id, "payroll_records", rec.payroll_id,
            {
                "user_id": user.user_id, "month": data.pay_month, "year": data.pay_year,
                "net": float(net), "paid_days": float(paid_days),
            }, ip_address=_get_client_ip(request),
        )
        NotificationService.create(
            db, user.user_id, NotificationType.PAYROLL_GENERATED,
            title="Payroll Generated",
            message=f"Your payroll for {data.pay_month}/{data.pay_year} has been generated. Net Salary: ₹{net:,.2f}",
            reference_id=rec.payroll_id, reference_type="payroll",
        )
        results.append(rec)

    db.commit()
    out = []
    for r in results:
        db.refresh(r)
        r2 = db.query(models.PayrollRecord).options(
            joinedload(models.PayrollRecord.line_items),
            joinedload(models.PayrollRecord.user).joinedload(models.User.profile),
        ).filter(models.PayrollRecord.payroll_id == r.payroll_id).first()
        resp = PayrollRecordResponse.model_validate(r2)
        if r2.user and r2.user.profile:
            resp.employee_name = f"{r2.user.profile.first_name} {r2.user.profile.last_name}"
        out.append(resp)
    return out


@router.get("/my", response_model=List[PayrollRecordResponse])
def my_payroll_records(
    year: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.PayrollRecord).options(joinedload(models.PayrollRecord.line_items)).filter(
        models.PayrollRecord.user_id == current_user.user_id
    )
    if year:
        q = q.filter(models.PayrollRecord.pay_year == year)
    return q.order_by(models.PayrollRecord.pay_year.desc(), models.PayrollRecord.pay_month.desc()).all()


@router.get("/all", response_model=List[PayrollRecordResponse])
def admin_all_payroll(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = None,
    user_id: Optional[int] = None,
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.PayrollRecord).options(
        joinedload(models.PayrollRecord.line_items),
        joinedload(models.PayrollRecord.user).joinedload(models.User.profile),
    )
    if month:
        q = q.filter(models.PayrollRecord.pay_month == month)
    if year:
        q = q.filter(models.PayrollRecord.pay_year == year)
    if user_id:
        q = q.filter(models.PayrollRecord.user_id == user_id)
    recs = q.order_by(models.PayrollRecord.pay_year.desc(), models.PayrollRecord.pay_month.desc()).all()
    out = []
    for r in recs:
        resp = PayrollRecordResponse.model_validate(r)
        if r.user and r.user.profile:
            resp.employee_name = f"{r.user.profile.first_name} {r.user.profile.last_name}"
        out.append(resp)
    return out


@router.get("/{payroll_id}/payslip.pdf")
def download_payslip_pdf(
    payroll_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = db.query(models.PayrollRecord).options(
        joinedload(models.PayrollRecord.line_items),
        joinedload(models.PayrollRecord.user).joinedload(models.User.profile),
    ).filter(models.PayrollRecord.payroll_id == payroll_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    if not require_self_or_admin(rec.user_id, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    profile = rec.user.profile if rec.user else None
    components = []
    if rec.structure:
        components = rec.structure.components
    buf = generate_payslip_pdf(rec, profile, components)
    filename = f"payslip_{payroll_id}_{rec.pay_month}_{rec.pay_year}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export.csv")
def export_payroll_csv(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(...),
    current_user: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.PayrollRecord).options(
        joinedload(models.PayrollRecord.user).joinedload(models.User.profile),
    ).filter(models.PayrollRecord.pay_month == month, models.PayrollRecord.pay_year == year).all()
    headers = ["Employee ID", "Name", "Department", "Paid Days", "LOP Days", "Total Earnings", "Total Deductions", "Net Salary", "Status"]
    rows = []
    for r in q:
        emp_id = r.user.employee_id if r.user else ""
        name = f"{r.user.profile.first_name} {r.user.profile.last_name}" if (r.user and r.user.profile) else ""
        dept = r.user.profile.department if (r.user and r.user.profile) else ""
        rows.append([
            emp_id, name, dept, str(r.paid_days), str(r.lop_days),
            f"{r.total_earnings:,.2f}", f"{r.total_deductions:,.2f}",
            f"{r.net_salary:,.2f}", r.status,
        ])
    buf = generate_csv(rows, headers)
    return StreamingResponse(
        buf, media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="payroll_{year}_{month}.csv"'},
    )
