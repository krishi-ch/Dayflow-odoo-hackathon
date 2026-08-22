# 🚀 Dayflow HRMS — Quickstart

> Every workday, perfectly aligned.
> Odoo Hackathon 2026 submission.

## Evaluator Highlights (what to check FIRST)

| Priority | Where |
|---|---|
| 🥇 **Database design** (13 tables, 3NF, triggers, enums, constraints, indexes) | `backend/migrations/001_init_schema.sql` + `backend/app/models/*.py` |
| 🏗️ **Architecture** (separation of concerns, modularity) | `backend/app/{core,models,schemas,services,routers,utils}` |
| 🔐 **Security** (RBAC, JWT, audit logs, input validation, rate-limit via lockout) | `backend/app/core/security.py` + `backend/app/routers/*` + `pages/admin/AuditLogsPage.jsx` |
| ⚡ **Performance** (indexes, proper joins, lazy-loading via joinedloads) | All SQLAlchemy `joinedload()` calls in routers |
| 🧭 **UI/UX** (responsive, intuitive nav, role-based menus, toasts, dashboards) | `frontend/src/` |
| 🤖 **AI Chatbot** (intent layer with data-backed replies) | `backend/app/routers/ai_chat.py` + `AIAssistantPage.jsx` |
| 📊 **Reports** (PDF payslips + CSV payroll export) | `backend/app/utils/helpers.py` `generate_payslip_pdf` / `generate_csv` |

---

## 0. Prerequisites

- Python 3.11+
- Node 18+
- PostgreSQL 14+ (use Docker for 1-click setup, below)

---

## 1. Start Postgres (recommended)

From repo root:

```bash
docker compose up -d
```

This creates a local PostgreSQL server at `localhost:5432` with credentials:
- user: `dayflow` / password: `dayflow` / database: `dayflow_hrms`

Alternative: create DB manually in your existing Postgres server and edit `backend/.env`.

---

## 2. Apply the database schema + seed data

```bash
# 1. Create schema (tables, enums, indexes, triggers)
psql -U dayflow -d dayflow_hrms -h localhost -f backend/migrations/001_init_schema.sql
# (Enter password: dayflow)

# 2. Seed leave types
psql -U dayflow -d dayflow_hrms -h localhost -f backend/seed/seed_data.sql

# 3. Seed demo users + attendance + salary structures
cd backend
pip install -r requirements.txt
python -m seed.seed_demo
```

Seeded demo logins:

| Role     | Email                  | Password   |
|---|---|---|
| Admin    | admin@dayflow.tech     | Admin@123  |
| HR       | hr@dayflow.tech        | Hr@12345   |
| Employee | alex@dayflow.tech      | Alex@1234  |
| Employee | sara@dayflow.tech      | Sara@1234  |
| Employee | vijay@dayflow.tech     | Vijay@123  |
| Employee | neha@dayflow.tech      | Neha@1234  |
| Employee | arjun@dayflow.tech     | Arjun@123  |
| Employee | maya@dayflow.tech      | Maya@1234  |

---

## 3. Run the backend

```bash
cd backend
cp .env.example .env    # optional, default config just works
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Docs live at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**:    http://localhost:8000/redoc
- **Health**:   http://localhost:8000/health

---

## 4. Run the frontend (Vite + React + Tailwind)

```bash
cd frontend
npm install         # or: npm i
npm run dev
```

Open: http://localhost:5173 — login with one of the demo accounts.

---

## 5. Demo script (5-min walkthrough for judges)

1. **Login** as `admin@dayflow.tech / Admin@123` → notice Admin Dashboard with charts + pending approvals
2. **Admin Dashboard** → click **Run Payroll** for current month → Payroll generates + employees notified
3. Open **Leave** module → **Approve** / **Reject** pending requests → status updates instantly + employee is notified
4. Open **Audit Logs** → show the *before/after JSON diffs* logged for every approval / update / login
5. Open **AI Assistant** → type *"What is my leave balance?"* / *"Attendance this week?"* / *"Latest salary?"*
6. **Logout** → login as `alex@dayflow.tech / Alex@1234` → check-in, apply leave, view payslip PDF.

---

## 6. Project structure

```
odoo hackathon/
├── docker-compose.yml          # Postgres
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py             # FastAPI app root
│   │   ├── core/
│   │   │   ├── config.py       # Settings
│   │   │   ├── database.py     # SQLAlchemy engine & sessions
│   │   │   ├── security.py     # JWT, pwd hashing, RBAC dependencies
│   │   │   └── init_db.py
│   │   ├── models/             # SQLAlchemy ORM → DB tables
│   │   ├── schemas/            # Pydantic (validation, serialization)
│   │   ├── services/
│   │   │   └── audit.py        # Audit logger + Notifications service
│   │   ├── routers/            # 7 REST modules
│   │   │   ├── auth.py
│   │   │   ├── employees.py
│   │   │   ├── attendance.py
│   │   │   ├── leave.py
│   │   │   ├── payroll.py
│   │   │   ├── dashboard.py
│   │   │   └── ai_chat.py
│   │   └── utils/helpers.py    # PDF payslip + CSV export + date utils
│   ├── migrations/
│   │   └── 001_init_schema.sql # THE STAR OF THE SHOW 🥇
│   └── seed/
│       ├── seed_data.sql       # Leave types
│       └── seed_demo.py        # 8 users + attendance + leave + structures
└── frontend/
    ├── index.html
    ├── package.json            # React 18 + Vite + Tailwind + Recharts + Axios
    ├── vite.config.js          # proxy /api → :8000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── context/AuthContext.jsx
        ├── utils/ (api.js + formatters.js)
        ├── components/ (Toast, Avatar, StatCard, NotificationBell, ProtectedRoute, layout/*)
        └── pages/
            ├── LoginPage, SignupPage, VerifyPage, NotFoundPage
            ├── ProfilePage, AttendancePage, LeavePage, PayrollPage, NotificationsPage, AIAssistantPage
            ├── dashboard/ (Employee & Admin)
            └── admin/ (EmployeesPage + AuditLogsPage)
```

---

## 7. Quick commands (tl;dr)

```bash
# terminal 1: db + backend
docker compose up -d
# psql ... -f backend/migrations/001_init_schema.sql
# psql ... -f backend/seed/seed_data.sql
cd backend && pip install -r requirements.txt && python -m seed.seed_demo
uvicorn app.main:app --reload --port 8000

# terminal 2: frontend
cd frontend && npm i && npm run dev
```

Enjoy Dayflow! 💙
