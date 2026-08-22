from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app import models
from app.models.attendance import AttendanceStatus
from app.models.leave import LeaveStatus

router = APIRouter(prefix="/api/v1/ai", tags=["AI Assistant"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., max_length=10)


class ChatResponse(BaseModel):
    reply: str
    intent: Optional[str] = None
    data: Optional[dict] = None


SIMPLE_INTENTS = {
    "attendance_today": [
        "attendance today", "today attendance", "present today", "am i present",
        "check in status", "did i check in",
    ],
    "attendance_this_week": [
        "attendance this week", "weekly attendance", "this week attendance",
    ],
    "leave_balance": [
        "leave balance", "how many leaves left", "remaining leaves", "available leaves",
        "leave quota", "how much leave do i have",
    ],
    "pending_leaves": [
        "pending leave", "pending requests", "leave status pending", "my leave requests",
    ],
    "latest_salary": [
        "latest salary", "last payroll", "last salary", "latest payslip", "my salary",
        "net salary", "payroll status",
    ],
    "upcoming_holidays": [
        "holidays", "upcoming holidays", "when is next holiday",
    ],
    "profile_status": [
        "profile status", "how complete is my profile", "profile completion",
    ],
    "help": [
        "help", "what can you do", "commands", "features",
    ],
}


def _detect_intent(text: str) -> Optional[str]:
    t = text.lower().strip()
    for intent, keywords in SIMPLE_INTENTS.items():
        for kw in keywords:
            if kw in t:
                return intent
    return None


def _fetch_intent_data(db: Session, user: models.User, intent: str) -> dict:
    today = date.today()
    if intent == "attendance_today":
        rec = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.user_id == user.user_id,
            models.AttendanceRecord.attendance_date == today,
        ).first()
        if rec:
            return {
                "status": rec.status.value,
                "check_in": str(rec.check_in_time) if rec.check_in_time else None,
                "check_out": str(rec.check_out_time) if rec.check_out_time else None,
                "work_min": rec.work_duration_minutes,
                "late": rec.late_arrival_minutes,
            }
        return {"status": "not_marked"}

    if intent == "attendance_this_week":
        from app.utils.helpers import get_week_range
        start, end = get_week_range(today)
        recs = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.user_id == user.user_id,
            models.AttendanceRecord.attendance_date.between(start, end),
        ).all()
        counts = {"present": 0, "absent": 0, "half_day": 0, "leave": 0, "total_work_min": 0}
        for r in recs:
            if r.status.value in counts:
                counts[r.status.value] += 1
            if r.work_duration_minutes:
                counts["total_work_min"] += r.work_duration_minutes
        counts["avg_hours"] = round(counts["total_work_min"] / 60 / max(counts["present"] + counts["half_day"], 1), 2)
        counts["range"] = f"{start} to {end}"
        return counts

    if intent == "leave_balance":
        balances = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.user_id == user.user_id,
            models.LeaveBalance.year == today.year,
        ).all()
        out = {}
        for b in balances:
            nm = b.leave_type.name.value if b.leave_type else f"type_{b.leave_type_id}"
            out[nm] = {
                "entitled": float(b.entitled_days),
                "used": float(b.used_days),
                "carry_forward": float(b.carry_forward_days),
                "available": float(b.entitled_days + b.carry_forward_days - b.used_days),
            }
        return {"year": today.year, "balances": out}

    if intent == "pending_leaves":
        reqs = db.query(models.LeaveRequest).filter(
            models.LeaveRequest.user_id == user.user_id,
            models.LeaveRequest.status == LeaveStatus.PENDING,
        ).all()
        return {
            "count": len(reqs),
            "requests": [
                {
                    "id": r.leave_request_id,
                    "leave_type": r.leave_type.name.value if r.leave_type else None,
                    "from": str(r.start_date),
                    "to": str(r.end_date),
                    "days": float(r.total_days),
                }
                for r in reqs
            ],
        }

    if intent == "latest_salary":
        latest = db.query(models.PayrollRecord).options(
            __import__("sqlalchemy.orm", fromlist=["joinedload"]).joinedload(models.PayrollRecord.line_items)
        ).filter(models.PayrollRecord.user_id == user.user_id).order_by(
            models.PayrollRecord.pay_year.desc(), models.PayrollRecord.pay_month.desc()
        ).first()
        if latest:
            return {
                "month": latest.pay_month,
                "year": latest.pay_year,
                "paid_days": float(latest.paid_days),
                "lop_days": float(latest.lop_days),
                "total_earnings": float(latest.total_earnings),
                "total_deductions": float(latest.total_deductions),
                "net_salary": float(latest.net_salary),
                "status": latest.status,
            }
        return {"generated": False}

    if intent == "profile_status":
        from app.utils.helpers import profile_completion_percent
        p = db.query(models.EmployeeProfile).filter(models.EmployeeProfile.user_id == user.user_id).first()
        pct = profile_completion_percent(p)
        return {"completion_pct": pct, "next_steps": _profile_hints(p)}

    if intent == "upcoming_holidays":
        return {"note": "Company holidays are set by HR. Check the announcements. Common 2026 holidays: Aug 15 (Independence Day), Oct 2 (Gandhi Jayanti), Oct 21 (Diwali), Nov 1 (Govardhan), Dec 25 (Christmas)."}

    if intent == "help":
        return {
            "commands": [
                "Show my attendance today",
                "Attendance this week",
                "What is my leave balance?",
                "Show pending leave requests",
                "Latest salary / payslip",
                "Profile completion status",
                "Upcoming holidays",
            ]
        }
    return {}


def _profile_hints(p):
    if not p:
        return ["Contact HR to create your employee profile first."]
    hints = []
    if not p.profile_picture_url:
        hints.append("Upload a profile picture.")
    if not p.phone:
        hints.append("Add your phone number.")
    if not p.address:
        hints.append("Add your current address.")
    if not p.emergency_contact:
        hints.append("Add an emergency contact.")
    if not p.pan_number:
        hints.append("Add your PAN number for payroll.")
    if not hints:
        hints.append("Excellent! Your profile looks complete.")
    return hints


def _format_reply(intent: str, data: dict) -> str:
    if intent == "attendance_today":
        if data.get("status") == "not_marked":
            return "You haven't marked your attendance yet today. Tap Check-In on the dashboard to start your day."
        t = data.get("check_in")
        s = f"Today's attendance: **{data['status'].upper()}**"
        if t:
            s += f" • Check-in at {t}"
        if data.get("check_out"):
            s += f" • Check-out at {data['check_out']}"
        if data.get("late"):
            s += f" • ⚠️ Late by {data['late']} min"
        if data.get("work_min"):
            s += f" • Worked {round(data['work_min']/60, 2)} hrs"
        return s

    if intent == "attendance_this_week":
        return (
            f"Week {data['range']}: "
            f"✅ {data['present']} present, 🔴 {data['absent']} absent, "
            f"🕒 {data['half_day']} half-days, 🏖️ {data['leave']} on leave. "
            f"Avg {data['avg_hours']} hrs/day."
        )

    if intent == "leave_balance":
        b = data.get("balances", {})
        if not b:
            return "No leave balances found for this year. Contact HR."
        lines = [f"**Leave Balance ({data['year']})**"]
        for nm, v in b.items():
            lines.append(f"- {nm.upper()}: {v['available']:.1f} days available (used {v['used']:.1f} / entitled {v['entitled']:.1f})")
        return "\n".join(lines)

    if intent == "pending_leaves":
        if data["count"] == 0:
            return "✅ No pending leave requests. All good!"
        return f"You have **{data['count']}** pending request(s):\n" + "\n".join(
            f"- #{r['id']} — {r['leave_type']} from {r['from']} to {r['to']} ({r['days']} days)"
            for r in data["requests"]
        )

    if intent == "latest_salary":
        if not data.get("generated", True):
            return "Payroll hasn't been generated for you yet. Contact HR once payroll cycle runs."
        return (
            f"💰 Latest payroll: **{data['month']}/{data['year']}**\n"
            f"- Paid days: {data['paid_days']} (LOP: {data['lop_days']})\n"
            f"- Total Earnings: ₹{data['total_earnings']:,.2f}\n"
            f"- Total Deductions: ₹{data['total_deductions']:,.2f}\n"
            f"- **Net Salary: ₹{data['net_salary']:,.2f}**\n"
            f"Status: {data['status']}"
        )

    if intent == "profile_status":
        return (
            f"📊 Profile completion: **{data['completion_pct']}%**\n"
            + "\n".join(f"🔹 {h}" for h in data["next_steps"])
        )

    if intent == "upcoming_holidays":
        return "🗓️ " + data["note"]

    if intent == "help":
        return "👋 I'm Dayflow Assistant. Try asking:\n" + "\n".join(f"• {c}" for c in data["commands"])
    return "Not sure what you mean. Try 'help'!"


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    last_user_msg = ""
    for m in reversed(req.messages):
        if m.role == "user":
            last_user_msg = m.content
            break
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    intent = _detect_intent(last_user_msg)
    if not intent:
        return ChatResponse(
            reply=(
                "I didn't catch that 😕. Try phrases like:\n"
                "• 'attendance today'\n"
                "• 'my leave balance'\n"
                "• 'pending leave requests'\n"
                "• 'latest salary'\n"
                "• 'profile status'\n"
                "• 'help'"
            ),
            intent="unknown",
            data=None,
        )
    data = _fetch_intent_data(db, current_user, intent)
    reply = _format_reply(intent, data)
    return ChatResponse(reply=reply, intent=intent, data=data)
