# ============================================================
# SEED DATA — Dayflow HRMS Demo Dataset
# Run AFTER applying 001_init_schema.sql
#   psql -U dayflow -d dayflow_hrms -f seed/seed_data.sql
# ============================================================

-- ------------------------------------------------------------
-- 1. DEFAULT LEAVE TYPES
-- ------------------------------------------------------------
INSERT INTO leave_types (name, description, default_annual_quota, carry_forward, max_carry_forward, requires_proof) VALUES
    ('paid',      'Paid Time Off / Casual Leave',    15.0, TRUE,  5.0, FALSE),
    ('sick',      'Sick Leave with medical proof',   12.0, FALSE, 0.0, TRUE),
    ('casual',    'Casual Leave',                    06.0, FALSE, 0.0, FALSE),
    ('unpaid',    'Leave without pay',               0.0,  FALSE, 0.0, TRUE),
    ('maternity', 'Maternity Leave',                 182.0, FALSE, 0.0, FALSE),
    ('paternity', 'Paternity Leave',                 15.0, FALSE, 0.0, FALSE)
ON CONFLICT (name) DO NOTHING;
