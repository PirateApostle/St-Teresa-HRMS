
-- ==========================================
-- ST TERESA HOSPITAL HRMS
-- DATABASE SCHEMA
-- PostgreSQL
-- ==========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- 1. ROLES
-- ==========================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 2. PERMISSIONS
-- ==========================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- ==========================================
-- 3. ROLE PERMISSIONS
-- ==========================================

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id)
        ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id)
        ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ==========================================
-- 4. USERS
-- ==========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    account_type VARCHAR(30) NOT NULL
        CHECK (account_type IN ('ADMIN', 'EMPLOYEE', 'PATIENT')),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. USER ROLES
-- ==========================================

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id)
        ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- ==========================================
-- 6. DEPARTMENTS
-- ==========================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    head_employee_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 7. POSITIONS
-- ==========================================

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id)
        ON DELETE RESTRICT,
    position_title VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (department_id, position_title)
);

-- ==========================================
-- 8. EMPLOYEES
-- ==========================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id)
        ON DELETE SET NULL,
    employee_number VARCHAR(30) NOT NULL UNIQUE,
    department_id UUID REFERENCES departments(id)
        ON DELETE RESTRICT,
    position_id UUID REFERENCES positions(id)
        ON DELETE RESTRICT,
    supervisor_id UUID REFERENCES employees(id)
        ON DELETE SET NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    gender VARCHAR(20),
    date_of_birth DATE,
    national_id VARCHAR(30) UNIQUE,
    personal_email VARCHAR(150),
    phone VARCHAR(20),
    address TEXT,
    hire_date DATE NOT NULL,
    employment_type VARCHAR(30)
        CHECK (employment_type IN (
            'PERMANENT', 'CONTRACT', 'CASUAL', 'INTERN'
        )),
    employment_status VARCHAR(30) DEFAULT 'ACTIVE'
        CHECK (employment_status IN (
            'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'
        )),
    base_salary NUMERIC(12,2) DEFAULT 0
        CHECK (base_salary >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Department heads are employees.
ALTER TABLE departments
ADD CONSTRAINT fk_department_head
FOREIGN KEY (head_employee_id)
REFERENCES employees(id)
ON DELETE SET NULL;


-- ==========================================
-- 9. SHIFTS
-- ==========================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_name VARCHAR(80) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    CHECK (start_time <> end_time)
);

-- ==========================================
-- 10. EMPLOYEE SHIFT ASSIGNMENTS
-- ==========================================

CREATE TABLE employee_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id)
        ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id)
        ON DELETE RESTRICT,
    shift_date DATE NOT NULL,
    assigned_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, shift_date)
);

-- ==========================================
-- 11. ATTENDANCE
-- ==========================================

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id)
        ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    attendance_status VARCHAR(30) DEFAULT 'PRESENT'
        CHECK (attendance_status IN (
            'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'
        )),
    hours_worked NUMERIC(5,2) DEFAULT 0
        CHECK (hours_worked >= 0),
    remarks TEXT,
    recorded_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, attendance_date),
    CHECK (
        clock_out IS NULL OR clock_in IS NOT NULL
    ),
    CHECK (
        clock_out IS NULL OR clock_out > clock_in
    )
);


-- ==========================================
-- 12. LEAVE TYPES
-- ==========================================

CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_name VARCHAR(80) NOT NULL UNIQUE,
    annual_entitlement NUMERIC(6,2) DEFAULT 0,
    description TEXT,
    is_paid BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    CHECK (annual_entitlement >= 0)
);

-- ==========================================
-- 13. LEAVE REQUESTS
-- ==========================================

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id)
        ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id)
        ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(6,2) NOT NULL,
    reason TEXT,
    request_status VARCHAR(30) DEFAULT 'PENDING'
        CHECK (request_status IN (
            'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
        )),
    approved_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    decision_date TIMESTAMPTZ,
    decision_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    CHECK (total_days > 0)
);


-- ==========================================
-- 14. PAYROLL PERIODS
-- ==========================================

CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_date DATE,
    period_status VARCHAR(30) DEFAULT 'OPEN'
        CHECK (period_status IN (
            'OPEN', 'PROCESSING', 'APPROVED', 'PAID', 'CLOSED'
        )),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date),
    UNIQUE (start_date, end_date)
);

-- ==========================================
-- 15. PAYROLL RECORDS
-- ==========================================

CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id)
        ON DELETE RESTRICT,
    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id)
        ON DELETE RESTRICT,
    basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(30) DEFAULT 'PENDING'
        CHECK (payment_status IN (
            'PENDING', 'APPROVED', 'PAID', 'FAILED'
        )),
    payment_reference VARCHAR(100),
    processed_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    payment_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (employee_id, payroll_period_id),
    CHECK (basic_salary >= 0),
    CHECK (gross_salary >= 0),
    CHECK (total_earnings >= 0),
    CHECK (total_deductions >= 0),
    CHECK (net_salary >= 0)
);

-- ==========================================
-- 16. PAYROLL ITEMS
-- ==========================================

CREATE TABLE payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id UUID NOT NULL REFERENCES payroll_records(id)
        ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL
        CHECK (item_type IN ('EARNING', 'DEDUCTION')),
    item_code VARCHAR(50) NOT NULL,
    description VARCHAR(150) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 17. JOB OPENINGS
-- ==========================================

CREATE TABLE job_openings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id)
        ON DELETE SET NULL,
    position_id UUID REFERENCES positions(id)
        ON DELETE SET NULL,
    job_title VARCHAR(150) NOT NULL,
    job_description TEXT NOT NULL,
    employment_type VARCHAR(30),
    vacancies INTEGER DEFAULT 1 CHECK (vacancies > 0),
    application_deadline DATE,
    job_status VARCHAR(30) DEFAULT 'OPEN'
        CHECK (job_status IN (
            'DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'
        )),
    created_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 18. APPLICANTS
-- ==========================================

CREATE TABLE applicants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    resume_path TEXT,
    qualifications TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 19. JOB APPLICATIONS
-- ==========================================

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES applicants(id)
        ON DELETE CASCADE,
    job_opening_id UUID NOT NULL REFERENCES job_openings(id)
        ON DELETE CASCADE,
    application_status VARCHAR(30) DEFAULT 'RECEIVED'
        CHECK (application_status IN (
            'RECEIVED', 'SHORTLISTED', 'INTERVIEW',
            'SELECTED', 'REJECTED', 'WITHDRAWN'
        )),
    interview_date TIMESTAMPTZ,
    remarks TEXT,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (applicant_id, job_opening_id)
);

-- ==========================================
-- 20. PERFORMANCE REVIEWS
-- ==========================================

CREATE TABLE performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id)
        ON DELETE CASCADE,
    reviewer_id UUID REFERENCES employees(id)
        ON DELETE SET NULL,
    review_period_start DATE NOT NULL,
    review_period_end DATE NOT NULL,
    performance_score NUMERIC(5,2),
    strengths TEXT,
    areas_for_improvement TEXT,
    recommendations TEXT,
    review_status VARCHAR(30) DEFAULT 'DRAFT'
        CHECK (review_status IN (
            'DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'FINALIZED'
        )),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK (review_period_end >= review_period_start),
    CHECK (
        performance_score IS NULL OR
        performance_score BETWEEN 0 AND 100
    )
);


-- ==========================================
-- 21. NOTIFICATIONS
-- ==========================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50),
    channel VARCHAR(20) DEFAULT 'IN_APP'
        CHECK (channel IN (
            'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'
        )),
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 22. AUDIT LOGS
-- ==========================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id)
        ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 23. PATIENT / CLIENT PROFILES
-- ==========================================

CREATE TABLE patient_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id)
        ON DELETE SET NULL,
    patient_number VARCHAR(30) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 24. APPOINTMENT REQUESTS
-- ==========================================

CREATE TABLE appointment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patient_clients(id)
        ON DELETE CASCADE,
    requested_department_id UUID REFERENCES departments(id)
        ON DELETE SET NULL,
    preferred_date DATE NOT NULL,
    preferred_time TIME,
    reason TEXT,
    request_status VARCHAR(30) DEFAULT 'PENDING'
        CHECK (request_status IN (
            'PENDING', 'CONFIRMED', 'RESCHEDULED',
            'CANCELLED', 'COMPLETED'
        )),
    reviewed_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 25. PATIENT / CLIENT ENQUIRIES
-- ==========================================

CREATE TABLE patient_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_clients(id)
        ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    enquiry_status VARCHAR(30) DEFAULT 'OPEN'
        CHECK (enquiry_status IN (
            'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
        )),
    handled_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- 26. DATABASE INDEXES
-- ==========================================

-- User authentication
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- Employee records
CREATE INDEX idx_employees_department
ON employees(department_id);

CREATE INDEX idx_employees_position
ON employees(position_id);

CREATE INDEX idx_employees_status
ON employees(employment_status);

CREATE INDEX idx_employees_name
ON employees(last_name, first_name);

-- Attendance
CREATE INDEX idx_attendance_employee_date
ON attendance(employee_id, attendance_date DESC);

CREATE INDEX idx_attendance_date
ON attendance(attendance_date);

-- Shifts
CREATE INDEX idx_shift_assignments_date
ON employee_shift_assignments(shift_date);

-- Leave
CREATE INDEX idx_leave_employee
ON leave_requests(employee_id);

CREATE INDEX idx_leave_status
ON leave_requests(request_status);

-- Payroll
CREATE INDEX idx_payroll_employee
ON payroll_records(employee_id);

CREATE INDEX idx_payroll_period
ON payroll_records(payroll_period_id);

-- Recruitment
CREATE INDEX idx_applications_job
ON job_applications(job_opening_id);

-- Performance
CREATE INDEX idx_performance_employee
ON performance_reviews(employee_id);

-- Notifications
CREATE INDEX idx_notifications_user_unread
ON notifications(user_id, created_at DESC)
WHERE is_read = FALSE;

-- Audit logs
CREATE INDEX idx_audit_user
ON audit_logs(user_id);

CREATE INDEX idx_audit_created
ON audit_logs(created_at DESC);

-- Patient/client
CREATE INDEX idx_patient_phone
ON patient_clients(phone);

CREATE INDEX idx_appointments_patient
ON appointment_requests(patient_id);

CREATE INDEX idx_appointments_date
ON appointment_requests(preferred_date);

CREATE INDEX idx_enquiries_status
ON patient_enquiries(enquiry_status);
