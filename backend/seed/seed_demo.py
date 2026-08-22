"""
One-click demo data setup for Dayflow HRMS.
Creates Admin, HR, and 6 sample Employees with:
- Email-verified accounts
- Employee profiles
- Leave balances for current year
- Sample attendance for last 2 weeks
- Sample leave requests (pending + approved)
- Salary structures
- One generated payroll

Run from `backend/` directory:
    python -m seed.seed_demo
"""
import os
import sys
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password, generate_verification_token
from app import models
from app.models.user import UserRole
from app.models.leave import LeaveStatus
from app.models.attendance import AttendanceStatus

EMPLOYEES = [
    {
        "role": UserRole.ADMIN, "employee_id": "ADM001",
        "email": "admin@dayflow.tech", "password": "Admin@123",
        "first_name": "Priya", "last_name": "Sharma",
        "job_title": "Head of Human Resources", "department": "Human Resources",
        "joining": date(2021, 1, 15),
    },
    {
        "role": UserRole.HR, "employee_id": "HR001",
        "email": "hr@dayflow.tech", "password": "Hr@12345",
        "first_name": "Rohan", "last_name": "Mehta",
        "job_title": "HR Executive", "department": "Human Resources",
        "joining": date(2022, 4, 10),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP001",
        "email": "alex@dayflow.tech", "password": "Alex@1234",
        "first_name": "Alex", "last_name": "Johnson",
        "job_title": "Senior Software Engineer", "department": "Engineering",
        "joining": date(2022, 6, 1),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP002",
        "email": "sara@dayflow.tech", "password": "Sara@1234",
        "first_name": "Sara", "last_name": "Khan",
        "job_title": "Product Designer", "department": "Design",
        "joining": date(2023, 2, 14),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP003",
        "email": "vijay@dayflow.tech", "password": "Vijay@123",
        "first_name": "Vijay", "last_name": "Reddy",
        "job_title": "Backend Developer", "department": "Engineering",
        "joining": date(2023, 9, 1),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP004",
        "email": "neha@dayflow.tech", "password": "Neha@1234",
        "first_name": "Neha", "last_name": "Gupta",
        "job_title": "Marketing Lead", "department": "Marketing",
        "joining": date(2022, 11, 21),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP005",
        "email": "arjun@dayflow.tech", "password": "Arjun@123",
        "first_name": "Arjun", "last_name": "Verma",
        "job_title": "QA Engineer", "department": "Engineering",
        "joining": date(2024, 3, 4),
    },
    {
        "role": UserRole.EMPLOYEE, "employee_id": "EMP006",
        "email": "maya@dayflow.tech", "password": "Maya@1234",
        "first_name": "Maya", "last_name": "Patel",
        "job_title": "Data Analyst", "department": "Analytics",
        "joining": date(2024, 5, 20),
    },
]


def seed_demo():
    db = SessionLocal()
    try:
        Base.metadata.create_all(bind=engine)

        current_year = datetime.now(timezone.utc).year
        leave_types = {lt.name.value: lt for lt in db.query(models.LeaveType).all()}
        if not leave_types:
            from app.models.leave import LeaveTypeName
            defaults = [
                (LeaveTypeName.PAID, "Paid Time Off / Casual Leave", 15.0, True, 5.0, False),
                (LeaveTypeName.SICK, "Sick Leave with medical proof", 12.0, False, 0.0, True),
                (LeaveTypeName.CASUAL, "Casual Leave", 6.0, False, 0.0, False),
                (LeaveTypeName.UNPAID, "Leave without pay", 0.0, False, 0.0, True),
                (LeaveTypeName.MATERNITY, "Maternity Leave", 182.0, False, 0.0, False),
                (LeaveTypeName.PATERNITY, "Paternity Leave", 15.0, False, 0.0, False),
            ]
            from decimal import Decimal
            for name, desc, quota, cf, max_cf, proof in defaults:
                db.add(models.LeaveType(
                    name=name, description=desc,
                    default_annual_quota=Decimal(str(quota)),
                    carry_forward=cf, max_carry_forward=Decimal(str(max_cf)),
                    requires_proof=proof, is_active=True,
                ))
            db.flush()
            leave_types = {lt.name.value: lt for lt in db.query(models.LeaveType).all()}
            print(f"✅ {len(leave_types)} default leave types auto-created")

        user_objects = []
        profile_objects = []
        existing_user = db.query(models.User).first()
        if existing_user:
            print("⚠️  Users already exist. Skipping user seed. (Drop DB if you want a fresh set)")
            return

        for e in EMPLOYEES:
            tok, exp = generate_verification_token()
            u = models.User(
                employee_id=e["employee_id"],
                email=e["email"],
                password_hash=hash_password(e["password"]),
                role=e["role"],
                is_active=True,
                is_verified=True,
                verification_token=tok,
                verification_expiry=exp,
            )
            db.add(u)
            db.flush()
            user_objects.append((u, e))

        admin_user_id = None
        for u, e in user_objects:
            if e["role"] in (UserRole.ADMIN, UserRole.HR):
                admin_user_id = u.user_id
                break

        for u, e in user_objects:
            p = models.EmployeeProfile(
                user_id=u.user_id,
                first_name=e["first_name"],
                last_name=e["last_name"],
                phone="+91 98" + str(10000000 + hash(u.email) % 89999999),
                address=f"Flat {u.user_id*3}, {e['last_name']} Heights, Indiranagar",
                city="Bengaluru", state="Karnataka", country="India", zip_code="560038",
                emergency_contact="+91 9900011" + str(100 + u.user_id),
                emergency_relation="Father",
                date_of_birth=date(1990 + u.user_id, 5 + (u.user_id % 6), 10 + u.user_id),
                gender="Male" if e["first_name"] in ("Alex", "Vijay", "Arjun", "Rohan") else "Female",
                job_title=e["job_title"],
                department=e["department"],
                joining_date=e["joining"],
                employment_type="full_time",
                work_location="Bengaluru HQ",
                pan_number=f"ABCDE123{u.user_id}F",
                aadhaar_number=f"1234 5678 {1000 + u.user_id}",
                bank_account=f"000123456{789 + u.user_id}",
                ifsc_code="HDFC0001234",
                created_by=admin_user_id,
                updated_by=admin_user_id,
            )
            db.add(p)
            profile_objects.append(p)

            for lt in db.query(models.LeaveType).filter(models.LeaveType.is_active == True).all():
                bal = models.LeaveBalance(
                    user_id=u.user_id,
                    leave_type_id=lt.leave_type_id,
                    year=current_year,
                    entitled_days=lt.default_annual_quota,
                    carry_forward_days=Decimal("2") if lt.carry_forward else Decimal("0"),
                    used_days=Decimal("0"),
                )
                db.add(bal)
        db.flush()

        print(f"✅ {len(user_objects)} users + profiles + leave balances created")
        print("   Default logins:")
        for u, e in user_objects:
            print(f"      {e['email']}  /  {e['password']}   ({e['role'].value})")

        emp_users = [(u, e) for u, e in user_objects if e["role"] == UserRole.EMPLOYEE]

        today = date.today()
        work_start_hour, work_start_min = 9, 30
        for u_info in emp_users:
            u, _ = u_info
            user_seed = u.user_id
            for d_offset in range(14):
                d = today - timedelta(days=d_offset)
                if d.weekday() >= 5:
                    continue
                roll = (d.toordinal() + user_seed) % 100
                if roll < 90:
                    st = AttendanceStatus.PRESENT
                    in_min = work_start_min + (roll % 30)
                    in_h = work_start_hour if in_min < 60 else work_start_hour + 1
                    if in_min >= 60:
                        in_min -= 60
                    out_min = 0 + (roll % 45)
                    out_h = 18 if out_min < 60 else 19
                    if out_min >= 60:
                        out_min -= 60
                    from datetime import time
                    ci = time(in_h, in_min)
                    co = time(out_h, out_min)
                    late = max((in_h * 60 + in_min) - (work_start_hour * 60 + work_start_min + 15), 0)
                    early = max((18 * 60) - (out_h * 60 + out_min), 0)
                    work_min = (out_h * 60 + out_min) - (in_h * 60 + in_min)
                    halfday = (roll > 75 and roll < 82)
                    if halfday:
                        st = AttendanceStatus.HALF_DAY
                        work_min //= 2
                    rec = models.AttendanceRecord(
                        user_id=u.user_id, attendance_date=d,
                        check_in_time=ci, check_out_time=co,
                        work_duration_minutes=work_min,
                        late_arrival_minutes=late,
                        early_leave_minutes=early,
                        status=st,
                        ip_address=f"192.168.1.{10 + user_seed}",
                    )
                    db.add(rec)
                elif roll < 95:
                    rec = models.AttendanceRecord(
                        user_id=u.user_id, attendance_date=d,
                        status=AttendanceStatus.ABSENT,
                        remarks="Unmarked / Absent",
                    )
                    db.add(rec)
        db.flush()
        print("✅ Attendance seeded for last 2 weeks")

        paid_id = leave_types["paid"].leave_type_id
        sick_id = leave_types["sick"].leave_type_id
        pending_samples = [
            (emp_users[0][0].user_id, paid_id, today + timedelta(5), today + timedelta(7), 3.0,
             "Family function — need 3 days of paid leave."),
            (emp_users[2][0].user_id, sick_id, today + timedelta(2), today + timedelta(3), 2.0,
             "Fever — doctor advised 2 days rest."),
            (emp_users[4][0].user_id, paid_id, today + timedelta(10), today + timedelta(14), 5.0,
             "Planned vacation out of town."),
        ]
        for uid, lt_id, sd, ed, td, reason in pending_samples:
            lr = models.LeaveRequest(
                user_id=uid, leave_type_id=lt_id,
                start_date=sd, end_date=ed, total_days=Decimal(str(td)),
                reason=reason, status=LeaveStatus.PENDING,
            )
            db.add(lr)
        db.flush()

        if len(emp_users) >= 2:
            from datetime import time as dt_time
            appr_user = emp_users[1][0].user_id
            appr_start = today - timedelta(21)
            appr_end = today - timedelta(19)
            lr = models.LeaveRequest(
                user_id=appr_user, leave_type_id=paid_id,
                start_date=appr_start, end_date=appr_end, total_days=Decimal("3"),
                reason="Personal work", status=LeaveStatus.APPROVED,
                approver_id=admin_user_id,
                approved_at=datetime.now(timezone.utc) - timedelta(days=22),
                admin_comments="Approved — have a nice time!",
            )
            db.add(lr)
            db.flush()
            bal = db.query(models.LeaveBalance).filter(
                models.LeaveBalance.user_id == appr_user,
                models.LeaveBalance.leave_type_id == paid_id,
                models.LeaveBalance.year == current_year,
            ).first()
            if bal:
                bal.used_days += Decimal("3")
        print("✅ Sample leave requests added (3 pending + 1 approved)")

        base_salaries = {
            "Engineering": 130000,
            "Design": 110000,
            "Marketing": 90000,
            "Human Resources": 100000,
            "Analytics": 115000,
        }
        admin_user = next((u for u, e in user_objects if e["role"] == UserRole.ADMIN), None)
        for u, e in user_objects:
            base = base_salaries.get(e["department"], 80000)
            struct = models.SalaryStructure(
                user_id=u.user_id,
                effective_from=e["joining"],
                base_salary=Decimal(base),
                created_by=admin_user_id or u.user_id,
            )
            db.add(struct)
            db.flush()
            components = [
                ("Basic Salary", "earning", base, False),
                ("HRA",          "earning", round(base * 0.40), False),
                ("Special Allowance", "earning", round(base * 0.15), False),
                ("PF (Employer)", "earning", round(base * 0.12), False),
                ("PF (Employee)", "deduction", round(base * 0.12), False),
                ("Professional Tax", "deduction", 2500, False),
                ("Income Tax",   "deduction", round(base * 0.12), False),
            ]
            for nm, typ, amt, isp in components:
                db.add(models.SalaryComponent(
                    structure_id=struct.structure_id,
                    component_name=nm, component_type=typ,
                    amount=Decimal(str(amt)), is_percentage=isp,
                ))
        db.flush()
        print("✅ Salary structures + components created")

        db.commit()
        print("\n🎉 DEMO SEED COMPLETE ✅")
        print("   Start the backend:")
        print("     cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload")
    except Exception as ex:
        db.rollback()
        print(f"❌ Seed failed: {ex}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
