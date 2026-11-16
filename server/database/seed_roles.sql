
-- ==========================================
-- INITIAL SYSTEM ROLES
-- ==========================================

INSERT INTO roles (role_name, description)
VALUES
('SUPER_ADMIN', 'Full system administration'),
('HR_MANAGER', 'Human resources management'),
('FINANCE_OFFICER', 'Payroll and financial management'),
('DEPARTMENT_HEAD', 'Authorised department management'),
('EMPLOYEE', 'Employee self-service access'),
('PATIENT', 'Patient and client portal access')
ON CONFLICT (role_name) DO NOTHING;

-- ==========================================
-- INITIAL PERMISSIONS
-- ==========================================

INSERT INTO permissions (permission_name, description)
VALUES
('users.manage', 'Manage system users'),
('roles.manage', 'Manage roles and permissions'),
('employees.view', 'View employee records'),
('employees.create', 'Create employee records'),
('employees.update', 'Update employee records'),
('employees.delete', 'Deactivate or remove employee records'),
('departments.manage', 'Manage hospital departments'),
('attendance.view_all', 'View workforce attendance'),
('attendance.view_own', 'View own attendance'),
('attendance.manage', 'Manage attendance records'),
('leave.view_all', 'View all leave requests'),
('leave.view_own', 'View own leave requests'),
('leave.apply', 'Submit leave requests'),
('leave.approve', 'Approve or reject leave'),
('payroll.view_all', 'View hospital payroll'),
('payroll.view_own', 'View own payslips'),
('payroll.manage', 'Process and manage payroll'),
('recruitment.manage', 'Manage recruitment'),
('performance.manage', 'Manage performance reviews'),
('notifications.manage', 'Manage notifications'),
('reports.view', 'View authorised reports'),
('audit.view', 'View audit logs'),
('appointments.manage', 'Manage appointment requests'),
('appointments.view_own', 'View own appointment requests'),
('profile.view_own', 'View own profile'),
('profile.update_own', 'Update own profile')
ON CONFLICT (permission_name) DO NOTHING;

-- ==========================================
-- ASSIGN PERMISSIONS TO ROLES
-- ==========================================

-- Super Admin receives all permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- HR Manager.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'employees.view',
    'employees.create',
    'employees.update',
    'departments.manage',
    'attendance.view_all',
    'attendance.manage',
    'leave.view_all',
    'leave.approve',
    'recruitment.manage',
    'performance.manage',
    'reports.view'
)
WHERE r.role_name = 'HR_MANAGER'
ON CONFLICT DO NOTHING;

-- Finance Officer.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'employees.view',
    'payroll.view_all',
    'payroll.manage',
    'reports.view'
)
WHERE r.role_name = 'FINANCE_OFFICER'
ON CONFLICT DO NOTHING;

-- Department Head.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'employees.view',
    'attendance.view_all',
    'leave.view_all',
    'leave.approve',
    'performance.manage'
)
WHERE r.role_name = 'DEPARTMENT_HEAD'
ON CONFLICT DO NOTHING;

-- Employee.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'attendance.view_own',
    'leave.view_own',
    'leave.apply',
    'payroll.view_own',
    'profile.view_own',
    'profile.update_own'
)
WHERE r.role_name = 'EMPLOYEE'
ON CONFLICT DO NOTHING;

-- Patient.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_name IN (
    'appointments.view_own',
    'profile.view_own',
    'profile.update_own'
)
WHERE r.role_name = 'PATIENT'
ON CONFLICT DO NOTHING;
