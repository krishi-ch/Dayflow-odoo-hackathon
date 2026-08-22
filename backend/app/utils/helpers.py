import logging
from datetime import datetime, date, timedelta
from typing import Optional, Tuple
from dateutil.relativedelta import relativedelta
import calendar
import csv
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable,
)

logger = logging.getLogger(__name__)


def get_month_range(year: int, month: int) -> Tuple[date, date]:
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    return first_day, last_day


def get_week_range(ref_date: Optional[date] = None) -> Tuple[date, date]:
    if ref_date is None:
        ref_date = date.today()
    start = ref_date - timedelta(days=ref_date.weekday())
    end = start + timedelta(days=6)
    return start, end


def count_weekdays(start_date: date, end_date: date, exclude_weekends: bool = True) -> int:
    count = 0
    current = start_date
    while current <= end_date:
        if exclude_weekends:
            if current.weekday() < 5:
                count += 1
        else:
            count += 1
        current += timedelta(days=1)
    return count


def calculate_total_leave_days(
    start_date: date,
    end_date: date,
    half_day_start: bool = False,
    half_day_end: bool = False,
) -> float:
    total_days = count_weekdays(start_date, end_date)
    if half_day_start:
        total_days -= 0.5
    if half_day_end and start_date != end_date:
        total_days -= 0.5
    return max(total_days, 0.5)


def calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def profile_completion_percent(profile) -> int:
    if not profile:
        return 0
    fields = [
        "first_name", "last_name", "date_of_birth", "gender",
        "phone", "address", "emergency_contact", "job_title",
        "department", "joining_date", "pan_number", "aadhaar_number",
        "bank_account", "ifsc_code", "profile_picture_url",
    ]
    filled = sum(1 for f in fields if getattr(profile, f, None))
    return int((filled / len(fields)) * 100)


def generate_csv(rows: list[list], headers: list[str]) -> io.BytesIO:
    buffer = io.BytesIO()
    buffer.write(b"\xef\xbb\xbf")
    text_wrapper = io.TextIOWrapper(buffer, encoding="utf-8", newline="")
    writer = csv.writer(text_wrapper)
    writer.writerow(headers)
    writer.writerows(rows)
    text_wrapper.flush()
    buffer.seek(0)
    return buffer


def generate_payslip_pdf(payroll, profile, structure_components: list) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=0.8 * inch, rightMargin=0.8 * inch,
        topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=20, alignment=1, textColor=colors.HexColor("#1e3a8a"))
    subtitle_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=10, alignment=1, textColor=colors.gray)
    h3 = ParagraphStyle("h3", parent=styles["Heading3"], fontSize=12, textColor=colors.HexColor("#1e40af"))
    normal = styles["Normal"]

    elements = []
    elements.append(Paragraph("DAYFLOW HRMS", title_style))
    elements.append(Paragraph(f"Salary Slip for {calendar.month_name[payroll.pay_month]} {payroll.pay_year}", subtitle_style))
    elements.append(Spacer(1, 0.15 * inch))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#3b82f6")))
    elements.append(Spacer(1, 0.2 * inch))

    if profile:
        info_table = Table([
            [Paragraph(f"<b>Employee ID:</b> {payroll.user.employee_id if payroll.user else ''}", normal),
             Paragraph(f"<b>Employee Name:</b> {profile.first_name} {profile.last_name}", normal)],
            [Paragraph(f"<b>Department:</b> {profile.department or '-'}", normal),
             Paragraph(f"<b>Designation:</b> {profile.job_title or '-'}", normal)],
            [Paragraph(f"<b>Joining Date:</b> {profile.joining_date or '-'}", normal),
             Paragraph(f"<b>Paid Days:</b> {payroll.paid_days}", normal)],
        ], colWidths=[3 * inch, 3.3 * inch])
        info_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.25 * inch))

    earnings = []
    deductions = []
    for item in payroll.line_items:
        row = [item.component_name, f"{item.amount:,.2f}"]
        if item.component_type.value == "earning":
            earnings.append(row)
        else:
            deductions.append(row)

    if not earnings:
        earnings = [["Basic Salary", f"{payroll.total_earnings:,.2f}"]]

    data = [
        [Paragraph("<b>EARNINGS</b>", h3), "", Paragraph("<b>DEDUCTIONS</b>", h3), ""],
        [Paragraph("<b>Component</b>", normal), Paragraph("<b>Amount (₹)</b>", normal),
         Paragraph("<b>Component</b>", normal), Paragraph("<b>Amount (₹)</b>", normal)],
    ]

    max_rows = max(len(earnings), len(deductions), 1)
    for i in range(max_rows):
        e = earnings[i] if i < len(earnings) else ["", ""]
        d = deductions[i] if i < len(deductions) else ["", ""]
        data.append([e[0], e[1], d[0], d[1]])

    data.append([
        Paragraph("<b>Total Earnings</b>", normal),
        Paragraph(f"<b>{payroll.total_earnings:,.2f}</b>", normal),
        Paragraph("<b>Total Deductions</b>", normal),
        Paragraph(f"<b>{payroll.total_deductions:,.2f}</b>", normal),
    ])

    data.append([
        Paragraph("", normal), "",
        Paragraph("<b>NET SALARY</b>", h3),
        Paragraph(f"<b>₹ {payroll.net_salary:,.2f}</b>", h3),
    ])

    t = Table(data, colWidths=[2.2 * inch, 1.3 * inch, 2.2 * inch, 1.3 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#dcfce7")),
        ("BACKGROUND", (2, 0), (3, 0), colors.HexColor("#fee2e2")),
        ("BACKGROUND", (0, 1), (1, 1), colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (2, 1), (3, 1), colors.HexColor("#e2e8f0")),
        ("SPAN", (0, 0), (1, 0)),
        ("SPAN", (2, 0), (3, 0)),
        ("SPAN", (2, -1), (1, -1)),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#334155")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1")))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(
        f"<i>This is a system-generated payslip for {profile.first_name if profile else 'Employee'}. "
        f"Generated on {payroll.generated_at.strftime('%d %b %Y')}.</i>",
        ParagraphStyle("footer", parent=normal, fontSize=8, textColor=colors.gray, alignment=1),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
