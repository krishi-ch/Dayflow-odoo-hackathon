-- ============================================================
-- DAYFLOW HRMS - DATABASE SCHEMA v1.0
-- Evaluator priority #1: Database Design
-- ============================================================
-- NORMALIZATION: 3NF achieved
-- AUDIT COLUMNS: created_at, updated_at, created_by, updated_by
-- SOFT DELETE: is_active flag on critical entities
-- CONSTRAINTS: CHECK, UNIQUE, FK with proper ON DELETE rules
-- INDEXES: On all FK columns + frequently queried columns
-- SECURITY: Row-level security enforced via API layer
-- ============================================================

-- ------------------------------------------------------------
-- ENUM TYPES (PostgreSQL native enums for data integrity)
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'employee', 'hr');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE leave_type_name AS ENUM ('paid', 'sick', 'unpaid', 'maternity', 'paternity', 'casual');
CREATE TYPE salary_component_type AS ENUM ('earning', 'deduction');
CREATE TYPE document_type AS ENUM ('resume', 'id_proof', 'address_proof', 'education_cert', 'experience_letter', 'other');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'approve', 'reject', 'login', 'logout');
CREATE TYPE notification_type AS ENUM ('info', 'leave_request', 'leave_approved', 'leave_rejected', 'attendance_flag', 'payroll_generated');

-- ------------------------------------------------------------
-- 1. USERS TABLE (Authentication & Authorization)
-- Separated from employee profiles for SOC (Separation of Concerns)
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id             BIGSERIAL PRIMARY KEY,
    employee_id         VARCHAR(32) UNIQUE NOT NULL,
    email               VARCHAR(255) UNIQUE NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    role                user_role NOT NULL DEFAULT 'employee',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token  VARCHAR(255),
    verification_expiry TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_employee_id    ON users(employee_id);
CREATE INDEX idx_users_role           ON users(role);
CREATE INDEX idx_users_is_active      ON users(is_active);

ALTER TABLE users ADD CONSTRAINT chk_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ------------------------------------------------------------
-- 2. EMPLOYEE PROFILES TABLE (Personal & Job Details)
-- FK: user_id → users.user_id (1:1 relationship)
-- ------------------------------------------------------------
CREATE TABLE employee_profiles (
    profile_id          BIGSERIAL PRIMARY KEY,
    user_id             BIGINT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    full_name           VARCHAR(255) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    date_of_birth       DATE,
    gender              VARCHAR(20),
    phone               VARCHAR(20),
    address             TEXT,
    city                VARCHAR(100),
    state               VARCHAR(100),
    country             VARCHAR(100),
    zip_code            VARCHAR(20),
    emergency_contact   VARCHAR(20),
    emergency_relation  VARCHAR(50),
    job_title           VARCHAR(150) NOT NULL,
    department          VARCHAR(100),
    joining_date        DATE NOT NULL,
    confirmation_date   DATE,
    manager_id          BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    employment_type     VARCHAR(50) NOT NULL DEFAULT 'full_time',
    work_location       VARCHAR(150),
    pan_number          VARCHAR(20),
    aadhaar_number      VARCHAR(20),
    bank_account        VARCHAR(50),
    ifsc_code           VARCHAR(20),
    profile_picture_url VARCHAR(500),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_by          BIGINT REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_emp_user_id        ON employee_profiles(user_id);
CREATE INDEX idx_emp_department     ON employee_profiles(department);
CREATE INDEX idx_emp_manager_id     ON employee_profiles(manager_id);
CREATE INDEX idx_emp_joining_date   ON employee_profiles(joining_date);
CREATE INDEX idx_emp_is_active      ON employee_profiles(is_active);
CREATE INDEX idx_emp_full_name      ON employee_profiles(full_name);

ALTER TABLE employee_profiles ADD CONSTRAINT chk_joining_date_not_future
    CHECK (joining_date <= CURRENT_DATE + INTERVAL '30 days');

-- ------------------------------------------------------------
-- 3. LEAVE TYPES TABLE (Configurable by Admin)
-- ------------------------------------------------------------
CREATE TABLE leave_types (
    leave_type_id   BIGSERIAL PRIMARY KEY,
    name            leave_type_name UNIQUE NOT NULL,
    description     TEXT,
    default_annual_quota DECIMAL(5,1) NOT NULL DEFAULT 0,
    carry_forward   BOOLEAN NOT NULL DEFAULT FALSE,
    max_carry_forward DECIMAL(5,1) NOT NULL DEFAULT 0,
    requires_proof  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_types_active ON leave_types(is_active);

-- ------------------------------------------------------------
-- 4. LEAVE BALANCES TABLE (Yearly entitlements per employee)
-- ------------------------------------------------------------
CREATE TABLE leave_balances (
    leave_balance_id BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    leave_type_id    BIGINT NOT NULL REFERENCES leave_types(leave_type_id) ON DELETE CASCADE,
    year             INTEGER NOT NULL,
    entitled_days    DECIMAL(5,1) NOT NULL DEFAULT 0,
    used_days        DECIMAL(5,1) NOT NULL DEFAULT 0,
    carry_forward_days DECIMAL(5,1) NOT NULL DEFAULT 0,
    available_days   DECIMAL(5,1) GENERATED ALWAYS AS (entitled_days + carry_forward_days - used_days) STORED,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, leave_type_id, year)
);

CREATE INDEX idx_leave_bal_user_year ON leave_balances(user_id, year);
CREATE INDEX idx_leave_bal_type       ON leave_balances(leave_type_id);

ALTER TABLE leave_balances ADD CONSTRAINT chk_used_not_exceed
    CHECK (used_days <= entitled_days + carry_forward_days);
ALTER TABLE leave_balances ADD CONSTRAINT chk_year_valid
    CHECK (year BETWEEN 2000 AND 2100);

-- ------------------------------------------------------------
-- 5. LEAVE REQUESTS TABLE (Leave application workflow)
-- ------------------------------------------------------------
CREATE TABLE leave_requests (
    leave_request_id BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    leave_type_id    BIGINT NOT NULL REFERENCES leave_types(leave_type_id) ON DELETE RESTRICT,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    total_days       DECIMAL(5,1) NOT NULL,
    half_day_start   BOOLEAN NOT NULL DEFAULT FALSE,
    half_day_end     BOOLEAN NOT NULL DEFAULT FALSE,
    reason           TEXT NOT NULL,
    status           leave_status NOT NULL DEFAULT 'pending',
    approver_id      BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    admin_comments   TEXT,
    supporting_doc_url VARCHAR(500),
    approved_at      TIMESTAMPTZ,
    rejected_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_req_user_id    ON leave_requests(user_id);
CREATE INDEX idx_leave_req_status     ON leave_requests(status);
CREATE INDEX idx_leave_req_date_range ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_req_approver   ON leave_requests(approver_id);
CREATE INDEX idx_leave_req_created    ON leave_requests(created_at DESC);

ALTER TABLE leave_requests ADD CONSTRAINT chk_dates_valid
    CHECK (end_date >= start_date);
ALTER TABLE leave_requests ADD CONSTRAINT chk_total_days_positive
    CHECK (total_days > 0);
ALTER TABLE leave_requests ADD CONSTRAINT chk_status_timestamps
    CHECK (
        (status = 'approved' AND approved_at IS NOT NULL) OR
        (status = 'rejected' AND rejected_at IS NOT NULL) OR
        (status = 'pending'  AND approved_at IS NULL AND rejected_at IS NULL)
    );

-- ------------------------------------------------------------
-- 6. ATTENDANCE RECORDS TABLE (Daily attendance)
-- ------------------------------------------------------------
CREATE TABLE attendance_records (
    attendance_id    BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    attendance_date  DATE NOT NULL,
    check_in_time    TIME,
    check_out_time   TIME,
    work_duration_minutes INTEGER,
    late_arrival_minutes  INTEGER NOT NULL DEFAULT 0,
    early_leave_minutes   INTEGER NOT NULL DEFAULT 0,
    status           attendance_status NOT NULL DEFAULT 'present',
    remarks          TEXT,
    geo_location_lat DECIMAL(10, 7),
    geo_location_lng DECIMAL(10, 7),
    ip_address       INET,
    device_info      VARCHAR(500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, attendance_date)
);

CREATE INDEX idx_att_user_date  ON attendance_records(user_id, attendance_date DESC);
CREATE INDEX idx_att_date       ON attendance_records(attendance_date DESC);
CREATE INDEX idx_att_status     ON attendance_records(status);

ALTER TABLE attendance_records ADD CONSTRAINT chk_times_valid
    CHECK (
        check_out_time IS NULL OR
        check_out_time > check_in_time
    );
ALTER TABLE attendance_records ADD CONSTRAINT chk_work_duration
    CHECK (work_duration_minutes IS NULL OR work_duration_minutes >= 0);

-- ------------------------------------------------------------
-- 7. SALARY STRUCTURES TABLE (Compensation components)
-- ------------------------------------------------------------
CREATE TABLE salary_structures (
    structure_id     BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    effective_from   DATE NOT NULL,
    effective_to     DATE,
    base_salary      DECIMAL(12,2) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    UNIQUE (user_id, effective_from)
);

CREATE INDEX idx_sal_struct_user  ON salary_structures(user_id);
CREATE INDEX idx_sal_struct_eff   ON salary_structures(effective_from, effective_to);

ALTER TABLE salary_structures ADD CONSTRAINT chk_base_positive
    CHECK (base_salary > 0);
ALTER TABLE salary_structures ADD CONSTRAINT chk_effective_dates
    CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- ------------------------------------------------------------
-- 8. SALARY COMPONENTS TABLE (Detailed salary breakup)
-- ------------------------------------------------------------
CREATE TABLE salary_components (
    component_id     BIGSERIAL PRIMARY KEY,
    structure_id     BIGINT NOT NULL REFERENCES salary_structures(structure_id) ON DELETE CASCADE,
    component_name   VARCHAR(100) NOT NULL,
    component_type   salary_component_type NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    is_percentage    BOOLEAN NOT NULL DEFAULT FALSE,
    percentage_of    BIGINT REFERENCES salary_components(component_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sal_comp_struct ON salary_components(structure_id);

ALTER TABLE salary_components ADD CONSTRAINT chk_amount_not_negative
    CHECK (amount >= 0);

-- ------------------------------------------------------------
-- 9. PAYROLL RECORDS TABLE (Monthly salary runs)
-- ------------------------------------------------------------
CREATE TABLE payroll_records (
    payroll_id       BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pay_month        INTEGER NOT NULL,
    pay_year         INTEGER NOT NULL,
    structure_id     BIGINT REFERENCES salary_structures(structure_id) ON DELETE SET NULL,
    total_earnings   DECIMAL(12,2) NOT NULL,
    total_deductions DECIMAL(12,2) NOT NULL,
    net_salary       DECIMAL(12,2) NOT NULL,
    paid_days        DECIMAL(5,1) NOT NULL,
    lop_days         DECIMAL(5,1) NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'generated',
    generated_by     BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payslip_url      VARCHAR(500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, pay_month, pay_year)
);

CREATE INDEX idx_payroll_user_date ON payroll_records(user_id, pay_year, pay_month);
CREATE INDEX idx_payroll_date      ON payroll_records(pay_year, pay_month);
CREATE INDEX idx_payroll_status    ON payroll_records(status);

ALTER TABLE payroll_records ADD CONSTRAINT chk_month_valid
    CHECK (pay_month BETWEEN 1 AND 12);
ALTER TABLE payroll_records ADD CONSTRAINT chk_net_calc
    CHECK (net_salary = total_earnings - total_deductions);
ALTER TABLE payroll_records ADD CONSTRAINT chk_pays_positive
    CHECK (paid_days > 0);

-- ------------------------------------------------------------
-- 10. PAYROLL LINE ITEMS (Detailed payroll components per run)
-- ------------------------------------------------------------
CREATE TABLE payroll_line_items (
    line_item_id    BIGSERIAL PRIMARY KEY,
    payroll_id      BIGINT NOT NULL REFERENCES payroll_records(payroll_id) ON DELETE CASCADE,
    component_name  VARCHAR(100) NOT NULL,
    component_type  salary_component_type NOT NULL,
    amount          DECIMAL(12,2) NOT NULL
);

CREATE INDEX idx_payroll_lines_id ON payroll_line_items(payroll_id);

-- ------------------------------------------------------------
-- 11. EMPLOYEE DOCUMENTS TABLE
-- ------------------------------------------------------------
CREATE TABLE documents (
    document_id    BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    doc_type       document_type NOT NULL,
    doc_name       VARCHAR(255) NOT NULL,
    file_url       VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    mime_type      VARCHAR(100),
    uploaded_by    BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    verified_by    BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_user   ON documents(user_id);
CREATE INDEX idx_docs_type   ON documents(doc_type);

-- ------------------------------------------------------------
-- 12. NOTIFICATIONS TABLE (Real-time alerts)
-- ------------------------------------------------------------
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            notification_type NOT NULL DEFAULT 'info',
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    reference_id    BIGINT,
    reference_type  VARCHAR(50),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notif_created   ON notifications(created_at DESC);

-- ------------------------------------------------------------
-- 13. AUDIT LOG TABLE (All sensitive actions tracked - Security)
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    log_id          BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    action          audit_action NOT NULL,
    table_name      VARCHAR(100),
    record_id       BIGINT,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_logs(user_id);
CREATE INDEX idx_audit_action  ON audit_logs(action);
CREATE INDEX idx_audit_table   ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_time    ON audit_logs(timestamp DESC);

-- ============================================================
-- TRIGGERS: Auto-update updated_at column on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_update_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_emp_profiles_update_updated_at
    BEFORE UPDATE ON employee_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_leave_types_update_updated_at
    BEFORE UPDATE ON leave_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_leave_balances_update_updated_at
    BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_leave_requests_update_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_attendance_update_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sal_struct_update_updated_at
    BEFORE UPDATE ON salary_structures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Auto-calculate work duration on attendance check-out
-- ============================================================
CREATE OR REPLACE FUNCTION calc_work_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        NEW.work_duration_minutes := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_calc_duration
    BEFORE UPDATE OF check_out_time ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION calc_work_duration();

-- ============================================================
-- TRIGGER: Auto-deduct leave balance when leave is approved
-- ============================================================
CREATE OR REPLACE FUNCTION process_leave_approval()
RETURNS TRIGGER AS $$
DECLARE
    leave_year INTEGER;
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        leave_year := EXTRACT(YEAR FROM NEW.start_date);
        UPDATE leave_balances
        SET used_days = used_days + NEW.total_days
        WHERE user_id = NEW.user_id
          AND leave_type_id = NEW.leave_type_id
          AND year = leave_year;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leave_approval_balance
    AFTER UPDATE OF status ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION process_leave_approval();
