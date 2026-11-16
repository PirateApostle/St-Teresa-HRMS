import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../config/db.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

const EMPLOYMENT_TYPES = ["PERMANENT", "CONTRACT", "CASUAL", "INTERN"];

const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"];

const clean = (value) => {
  if (value === undefined || value === null) return null;
  const result = String(value).trim();
  return result === "" ? null : result;
};

const validDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// GET /api/employees/me
// Retrieve the currently authenticated employee's own profile.

router.get(
  "/me",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      if (!employeeId) {
        return res.status(404).json({
          status: "error",
          message: "No employee profile is linked to this account.",
        });
      }

      const result = await pool.query(
        `SELECT
            e.id,
            e.employee_number,
            e.first_name,
            e.last_name,
            e.gender,
            e.date_of_birth,
            e.personal_email,
            e.phone,
            e.address,
            e.hire_date,
            e.employment_type,
            e.employment_status,
            e.base_salary,
            u.email AS login_email,
            d.department_name,
            p.position_title,
            s.first_name || ' ' || s.last_name AS supervisor_name
         FROM employees e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN positions p ON p.id = e.position_id
         LEFT JOIN employees s ON s.id = e.supervisor_id
         WHERE e.id = $1`,
        [employeeId],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      return res.json({
        status: "success",
        employee: result.rows[0],
      });
    } catch (error) {
      console.error("Employee profile error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve employee profile.",
      });
    }
  },
);

// GET /api/employees
// List employees with their departments and positions.
router.get(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           e.id,
           e.employee_number,
           e.first_name,
           e.last_name,
           e.gender,
           e.personal_email,
           e.phone,
           e.hire_date,
           e.employment_type,
           e.employment_status,
           e.base_salary,
           d.department_name,
           p.position_title,
           s.first_name || ' ' || s.last_name AS supervisor_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN positions p ON p.id = e.position_id
         LEFT JOIN employees s ON s.id = e.supervisor_id
         ORDER BY e.created_at DESC`,
      );

      res.json({
        status: "success",
        count: result.rowCount,
        employees: result.rows,
      });
    } catch (error) {
      console.error("Employee listing error:", error);
      res.status(500).json({
        status: "error",
        message: "Unable to retrieve employees.",
      });
    }
  },
);

// POST /api/employees
// Create employee, login account, role and activation invitation.
router.post(
  "/",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    const {
      employee_number,
      first_name,
      last_name,
      gender,
      date_of_birth,
      national_id,
      personal_email,
      phone,
      address,
      hire_date,
      employment_type,
      employment_status,
      base_salary,
      department_id,
      position_id,
      supervisor_id,
    } = req.body;

    const employeeNumber = clean(employee_number);
    const firstName = clean(first_name);
    const lastName = clean(last_name);
    const email = clean(personal_email)?.toLowerCase();
    const employeePhone = clean(phone);
    const hireDate = clean(hire_date);
    const employmentType = clean(employment_type) || "PERMANENT";
    const employmentStatus = clean(employment_status) || "ACTIVE";
    const departmentId = clean(department_id);
    const positionId = clean(position_id);
    const supervisorId = clean(supervisor_id);
    const nationalId = clean(national_id);

    if (!employeeNumber || !firstName || !lastName || !email || !hireDate) {
      return res.status(400).json({
        status: "error",
        message:
          "Employee number, first name, last name, email and hire date are required.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid employee email address.",
      });
    }

    if (!validDate(hireDate)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid hire date in YYYY-MM-DD format.",
      });
    }

    if (date_of_birth && !validDate(date_of_birth)) {
      return res.status(400).json({
        status: "error",
        message: "Enter a valid date of birth in YYYY-MM-DD format.",
      });
    }

    if (!EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid employment type.",
      });
    }

    if (!EMPLOYMENT_STATUSES.includes(employmentStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid employment status.",
      });
    }

    const salary =
      base_salary === undefined || base_salary === null || base_salary === ""
        ? 0
        : Number(base_salary);

    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({
        status: "error",
        message: "Base salary must be a valid non-negative number.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Confirm that the employee number is available.
      const existingEmployee = await client.query(
        "SELECT id FROM employees WHERE employee_number = $1",
        [employeeNumber],
      );

      if (existingEmployee.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          status: "error",
          message: "This employee number is already registered.",
        });
      }

      // Confirm that the email is available.
      const existingUser = await client.query(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [email],
      );

      if (existingUser.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          status: "error",
          message: "An account with this email already exists.",
        });
      }

      // Validate department.
      if (departmentId) {
        const department = await client.query(
          "SELECT id FROM departments WHERE id = $1",
          [departmentId],
        );

        if (department.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            status: "error",
            message: "The selected department does not exist.",
          });
        }
      }

      // Validate position and its department.
      if (positionId) {
        const position = await client.query(
          `SELECT id, department_id
           FROM positions
           WHERE id = $1`,
          [positionId],
        );

        if (position.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            status: "error",
            message: "The selected position does not exist.",
          });
        }

        if (departmentId && position.rows[0].department_id !== departmentId) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            status: "error",
            message:
              "The selected position does not belong to the selected department.",
          });
        }
      }

      // Validate supervisor.
      if (supervisorId) {
        const supervisor = await client.query(
          "SELECT id FROM employees WHERE id = $1",
          [supervisorId],
        );

        if (supervisor.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            status: "error",
            message: "The selected supervisor does not exist.",
          });
        }
      }

      // Find the existing EMPLOYEE role.
      const roleResult = await client.query(
        "SELECT id FROM roles WHERE role_name = 'EMPLOYEE'",
      );

      if (roleResult.rowCount === 0) {
        throw new Error("EMPLOYEE role is missing from the roles table.");
      }

      // Create an unusable temporary password.
      // The employee must activate their account to set a real password.
      const temporaryPassword = crypto.randomBytes(48).toString("hex");
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      const fullName = `${firstName} ${lastName}`;

      // Create login account, initially inactive.
      const userResult = await client.query(
        `INSERT INTO users (
           full_name,
           email,
           phone,
           password_hash,
           account_type,
           is_active,
           email_verified
         )
         VALUES ($1, $2, $3, $4, 'EMPLOYEE', FALSE, FALSE)
         RETURNING id, full_name, email`,
        [fullName, email, employeePhone, passwordHash],
      );

      const user = userResult.rows[0];

      // Assign EMPLOYEE role.
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)`,
        [user.id, roleResult.rows[0].id],
      );

      // Create employee record.
      const employeeResult = await client.query(
        `INSERT INTO employees (
           user_id,
           employee_number,
           department_id,
           position_id,
           supervisor_id,
           first_name,
           last_name,
           gender,
           date_of_birth,
           national_id,
           personal_email,
           phone,
           address,
           hire_date,
           employment_type,
           employment_status,
           base_salary
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17
         )
         RETURNING *`,
        [
          user.id,
          employeeNumber,
          departmentId,
          positionId,
          supervisorId,
          firstName,
          lastName,
          clean(gender),
          clean(date_of_birth),
          nationalId,
          email,
          employeePhone,
          clean(address),
          hireDate,
          employmentType,
          employmentStatus,
          salary,
        ],
      );

      // Generate a single-use activation token.
      const activationToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(activationToken)
        .digest("hex");

      await client.query(
        `INSERT INTO account_activation_tokens (
           user_id,
           token_hash,
           expires_at
         )
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [user.id, tokenHash],
      );

      await client.query("COMMIT");

      const response = {
        status: "success",
        message: "Employee and login account created successfully.",
        employee: employeeResult.rows[0],
        account: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          account_type: "EMPLOYEE",
          is_active: false,
        },
        activation: {
          expires_in: "24 hours",
          delivery_status: "Pending email integration",
        },
      };

      // Development convenience only. Never expose activation tokens in production.
      if (process.env.NODE_ENV !== "production") {
        const clientUrl = (
          process.env.CLIENT_URL || "http://localhost:5173"
        ).replace(/\/$/, "");

        response.activation.development_link = `${clientUrl}/activate-account?token=${activationToken}`;
      }

      return res.status(201).json(response);
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Employee registration error:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          status: "error",
          message:
            "A duplicate employee number, email, phone or national ID was detected.",
        });
      }

      if (error.code === "23503") {
        return res.status(400).json({
          status: "error",
          message:
            "One of the selected department, position or supervisor records is invalid.",
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Employee registration failed. Check the backend logs.",
      });
    } finally {
      client.release();
    }
  },
);

// POST /api/employees/:id/resend-activation
// Reissue an activation link for an inactive employee account.

router.post(
  "/:id/resend-activation",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    const employeeId = req.params.id;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const employeeResult = await client.query(
        `SELECT e.id, e.user_id, e.first_name, e.last_name,
                u.email, u.is_active, u.account_type
         FROM employees e
         JOIN users u ON u.id = e.user_id
         WHERE e.id = $1
         FOR UPDATE OF e, u`,
        [employeeId],
      );

      if (employeeResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          status: "error",
          message: "Employee not found.",
        });
      }

      const employee = employeeResult.rows[0];

      if (employee.account_type !== "EMPLOYEE" || employee.is_active) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          status: "error",
          message: "This employee account cannot be activated.",
        });
      }

      // Remove previous unused activation links.
      await client.query(
        `DELETE FROM account_activation_tokens
         WHERE user_id = $1
           AND used_at IS NULL`,
        [employee.user_id],
      );

      // Generate a fresh secure token.
      const activationToken = crypto.randomBytes(32).toString("hex");

      const tokenHash = crypto
        .createHash("sha256")
        .update(activationToken)
        .digest("hex");

      await client.query(
        `INSERT INTO account_activation_tokens
         (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [employee.user_id, tokenHash],
      );

      await client.query("COMMIT");

      const response = {
        status: "success",
        message: "A new activation link has been generated.",
        employee: {
          id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          email: employee.email,
        },
        activation: {
          expires_in: "24 hours",
          delivery_status: "Pending email integration",
        },
      };

      if (process.env.NODE_ENV !== "production") {
        const clientUrl = (
          process.env.CLIENT_URL || "http://localhost:5173"
        ).replace(/\/+$/, "");

        response.activation.development_link = `${clientUrl}/activate-account?token=${activationToken}`;
      }

      return res.json(response);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Activation reissue error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to generate a new activation link.",
      });
    } finally {
      client.release();
    }
  },
);

// GET /api/employees/dashboard
// Returns dashboard information for the authenticated employee.
router.get(
  "/dashboard",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;
      const userId = req.user.userId;

      if (!employeeId) {
        return res.status(404).json({
          status: "error",
          message: "Employee account not linked to an employee record.",
        });
      }

      // Run dashboard queries concurrently.
      const [
        attendanceSummary,
        recentAttendance,
        leaveBalances,
        leaveSummary,
        upcomingShifts,
        latestPayroll,
        recentNotifications,
      ] = await Promise.all([
        // 1. Current month's attendance statistics
        pool.query(
          `
          SELECT
            COUNT(*) AS total_days,
            COUNT(*) FILTER (
              WHERE LOWER(attendance_status) = 'present'
            ) AS days_present,
            COUNT(*) FILTER (
              WHERE LOWER(attendance_status) = 'absent'
            ) AS days_absent,
            COUNT(*) FILTER (
              WHERE LOWER(attendance_status) = 'late'
            ) AS days_late,
            COALESCE(SUM(hours_worked), 0) AS total_hours
          FROM attendance
          WHERE employee_id = $1
          AND attendance_date >= DATE_TRUNC('month', CURRENT_DATE)::date
          AND attendance_date <= CURRENT_DATE
        `,
          [employeeId],
        ),

        // 2. Five most recent attendance records
        pool.query(
          `
          SELECT
            id,
            attendance_date,
            clock_in,
            clock_out,
            attendance_status,
            hours_worked,
            remarks
          FROM attendance
          WHERE employee_id = $1
          ORDER BY attendance_date DESC
          LIMIT 5
        `,
          [employeeId],
        ),

        // 3. Leave balances for active leave types
        pool.query(
          `
          SELECT
            lt.id AS leave_type_id,
            lt.leave_name,
            lt.annual_entitlement,
            COALESCE(
              SUM(lr.total_days) FILTER (
                WHERE LOWER(lr.request_status) = 'approved'
                AND lr.start_date >= DATE_TRUNC('year', CURRENT_DATE)::date
                AND lr.start_date < (
                  DATE_TRUNC('year', CURRENT_DATE)
                  + INTERVAL '1 year'
                )::date
              ), 0
            ) AS days_used
          FROM leave_types lt
          LEFT JOIN leave_requests lr
            ON lr.leave_type_id = lt.id
            AND lr.employee_id = $1
          WHERE lt.is_active = TRUE
          GROUP BY lt.id, lt.leave_name, lt.annual_entitlement
          ORDER BY lt.leave_name
        `,
          [employeeId],
        ),

        // 4. Pending leave requests
        pool.query(
          `
          SELECT
            COUNT(*) AS pending_requests
          FROM leave_requests
          WHERE employee_id = $1
          AND LOWER(request_status) = 'pending'
        `,
          [employeeId],
        ),

        // 5. Upcoming shifts within the next 30 days
        pool.query(
          `
          SELECT
            esa.id,
            esa.shift_date,
            s.shift_name,
            s.start_time,
            s.end_time,
            s.description
          FROM employee_shift_assignments esa
          INNER JOIN shifts s
            ON s.id = esa.shift_id
          WHERE esa.employee_id = $1
          AND esa.shift_date >= CURRENT_DATE
          AND esa.shift_date <= CURRENT_DATE + 30
          AND s.is_active = TRUE
          ORDER BY esa.shift_date ASC, s.start_time ASC
          LIMIT 5
        `,
          [employeeId],
        ),

        // 6. Latest payroll record
        pool.query(
          `
          SELECT
            pr.id,
            pr.basic_salary,
            pr.gross_salary,
            pr.total_earnings,
            pr.total_deductions,
            pr.net_salary,
            pr.payment_status,
            pr.payment_date,
            pp.period_name,
            pp.start_date,
            pp.end_date
          FROM payroll_records pr
          INNER JOIN payroll_periods pp
            ON pp.id = pr.payroll_period_id
          WHERE pr.employee_id = $1
          ORDER BY pp.end_date DESC, pr.created_at DESC
          LIMIT 1
        `,
          [employeeId],
        ),

        // 7. Recent notifications for this employee
        pool.query(
          `
          SELECT
            id,
            title,
            message,
            notification_type,
            is_read,
            sent_at,
            created_at
          FROM notifications
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `,
          [userId],
        ),
      ]);

      // Prepare leave balances.
      const formattedLeaveBalances = leaveBalances.rows.map((leave) => ({
        ...leave,
        days_used: Number(leave.days_used),
        days_remaining:
          leave.annual_entitlement === null
            ? null
            : Math.max(
                0,
                Number(leave.annual_entitlement) - Number(leave.days_used),
              ),
      }));

      return res.status(200).json({
        status: "success",
        message: "Employee dashboard retrieved successfully.",

        dashboard: {
          attendance: {
            total_days: Number(attendanceSummary.rows[0].total_days),
            days_present: Number(attendanceSummary.rows[0].days_present),
            days_absent: Number(attendanceSummary.rows[0].days_absent),
            days_late: Number(attendanceSummary.rows[0].days_late),
            total_hours: Number(attendanceSummary.rows[0].total_hours),
            recent_records: recentAttendance.rows,
          },

          leave: {
            balances: formattedLeaveBalances,
            pending_requests: Number(leaveSummary.rows[0].pending_requests),
          },

          upcoming_shifts: upcomingShifts.rows,

          latest_payroll: latestPayroll.rows[0] || null,

          notifications: recentNotifications.rows,
        },
      });
    } catch (error) {
      console.error("Employee dashboard error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve employee dashboard.",
      });
    }
  },
);

// ==========================================
// EMPLOYEE LEAVE REQUESTS
// ==========================================

// GET: Retrieve the authenticated employee's leave requests
router.get(
  "/leave-requests",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      const result = await pool.query(
        `SELECT
           lr.id,
           lr.leave_type_id,
           lt.leave_name,
           lt.is_paid,
           lr.start_date,
           lr.end_date,
           lr.total_days,
           lr.reason,
           lr.request_status,
           lr.decision_date,
           lr.decision_remarks,
           lr.created_at
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = $1
         ORDER BY lr.created_at DESC`,
        [employeeId],
      );

      return res.json({
        status: "success",
        message: "Leave requests retrieved successfully.",
        requests: result.rows,
      });
    } catch (error) {
      console.error("Retrieve leave requests error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve leave requests.",
      });
    }
  },
);

// GET: Retrieve available leave types
router.get(
  "/leave-types",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           id,
           leave_name,
           annual_entitlement,
           description,
           is_paid
         FROM leave_types
         WHERE is_active = TRUE
         ORDER BY leave_name ASC`,
      );

      return res.json({
        status: "success",
        leave_types: result.rows,
      });
    } catch (error) {
      console.error("Retrieve leave types error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve leave types.",
      });
    }
  },
);

// POST: Submit a new leave request
router.post(
  "/leave-requests",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      const { leave_type_id, start_date, end_date, reason } = req.body;

      if (!employeeId) {
        return res.status(400).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      if (!leave_type_id || !start_date || !end_date) {
        return res.status(400).json({
          status: "error",
          message: "Leave type, start date and end date are required.",
        });
      }

      // Validate date format
      const validDate = (value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

        const date = new Date(`${value}T00:00:00Z`);

        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      };

      if (!validDate(start_date) || !validDate(end_date)) {
        return res.status(400).json({
          status: "error",
          message: "Please provide valid leave dates.",
        });
      }

      if (end_date < start_date) {
        return res.status(400).json({
          status: "error",
          message: "End date cannot be earlier than start date.",
        });
      }

      // Calculate inclusive calendar days
      const start = new Date(`${start_date}T00:00:00Z`);
      const end = new Date(`${end_date}T00:00:00Z`);

      const totalDays = Math.round((end - start) / 86400000) + 1;

      // Confirm that the selected leave type exists and is active
      const leaveType = await pool.query(
        `SELECT id, leave_name
         FROM leave_types
         WHERE id = $1 AND is_active = TRUE`,
        [leave_type_id],
      );

      if (leaveType.rows.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Selected leave type is invalid or inactive.",
        });
      }

      // Prevent overlapping pending or approved leave requests
      const overlapping = await pool.query(
        `SELECT id
         FROM leave_requests
         WHERE employee_id = $1
           AND request_status IN ('PENDING', 'APPROVED')
           AND start_date <= $3
           AND end_date >= $2
         LIMIT 1`,
        [employeeId, start_date, end_date],
      );

      if (overlapping.rows.length > 0) {
        return res.status(409).json({
          status: "error",
          message:
            "You already have a pending or approved leave request covering these dates.",
        });
      }

      // Save the request
      const result = await pool.query(
        `INSERT INTO leave_requests (
           employee_id,
           leave_type_id,
           start_date,
           end_date,
           total_days,
           reason,
           request_status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         RETURNING *`,
        [
          employeeId,
          leave_type_id,
          start_date,
          end_date,
          totalDays,
          reason?.trim() || null,
        ],
      );

      return res.status(201).json({
        status: "success",
        message: "Leave request submitted successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      console.error("Submit leave request error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to submit leave request.",
      });
    }
  },
);

// ==========================================
// ADMINISTRATOR: LEAVE MANAGEMENT
// ==========================================

// GET: Retrieve leave statistics and employee leave requests
router.get(
  "/leave-management",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const [statsResult, requestsResult] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) FILTER (
              WHERE request_status = 'PENDING'
            ) AS pending_requests,

            COUNT(*) FILTER (
              WHERE request_status = 'APPROVED'
                AND decision_date >= date_trunc('month', CURRENT_DATE)
                AND decision_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            ) AS approved_this_month,

            COUNT(*) FILTER (
              WHERE request_status = 'REJECTED'
                AND decision_date >= date_trunc('month', CURRENT_DATE)
                AND decision_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
            ) AS rejected_this_month,

            (
              SELECT COUNT(DISTINCT employee_id)
              FROM leave_requests
              WHERE request_status = 'APPROVED'
                AND CURRENT_DATE BETWEEN start_date AND end_date
            ) AS employees_on_leave_today

          FROM leave_requests
        `),

        pool.query(`
          SELECT
            lr.id,
            lr.employee_id,
            e.first_name,
            e.last_name,
            e.employee_number,
            d.department_name,
            p.position_title,
            lt.leave_name,
            lt.is_paid,
            lr.start_date,
            lr.end_date,
            lr.total_days,
            lr.reason,
            lr.request_status,
            lr.created_at,
            lr.decision_date,
            lr.decision_remarks,
            u.full_name AS reviewer_name

          FROM leave_requests lr
          JOIN employees e ON e.id = lr.employee_id
          JOIN departments d ON d.id = e.department_id
          JOIN positions p ON p.id = e.position_id
          JOIN leave_types lt ON lt.id = lr.leave_type_id
          LEFT JOIN users u ON u.id = lr.approved_by

          ORDER BY
            CASE lr.request_status
              WHEN 'PENDING' THEN 1
              WHEN 'APPROVED' THEN 2
              WHEN 'REJECTED' THEN 3
              ELSE 4
            END,
            lr.created_at DESC

          LIMIT 200
        `),
      ]);

      return res.json({
        status: "success",
        message: "Leave management data retrieved successfully.",
        statistics: statsResult.rows[0],
        requests: requestsResult.rows,
      });
    } catch (error) {
      console.error("Leave management retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve leave management data.",
      });
    }
  },
);

// PATCH: Approve or reject an employee leave request
router.patch(
  "/leave-requests/:id/decision",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { decision, decision_remarks } = req.body;

      const normalizedDecision = String(decision || "").toUpperCase();

      if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
        return res.status(400).json({
          status: "error",
          message: "Decision must be APPROVED or REJECTED.",
        });
      }

      const result = await pool.query(
        `UPDATE leave_requests
         SET
           request_status = $1,
           approved_by = $2,
           decision_date = NOW(),
           decision_remarks = $3
         WHERE id = $4
           AND request_status = 'PENDING'
         RETURNING id, request_status, decision_date, decision_remarks`,
        [
          normalizedDecision,
          req.user.userId,
          decision_remarks?.trim() || null,
          id,
        ],
      );

      if (result.rows.length === 0) {
        const existing = await pool.query(
          "SELECT id FROM leave_requests WHERE id = $1",
          [id],
        );

        if (existing.rows.length === 0) {
          return res.status(404).json({
            status: "error",
            message: "Leave request not found.",
          });
        }

        return res.status(409).json({
          status: "error",
          message: "This leave request has already been processed.",
        });
      }

      return res.json({
        status: "success",
        message: `Leave request ${normalizedDecision.toLowerCase()} successfully.`,
        request: result.rows[0],
      });
    } catch (error) {
      console.error("Leave decision error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to process leave decision.",
      });
    }
  },
);

// ==========================================
// EMPLOYEE ATTENDANCE MANAGEMENT
// ==========================================

// GET: Retrieve authenticated employee's attendance history
router.get(
  "/attendance/me",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      const result = await pool.query(
        `SELECT
           id,
           attendance_date,
           clock_in,
           clock_out,
           attendance_status,
           hours_worked,
           remarks
         FROM attendance
         WHERE employee_id = $1
         ORDER BY attendance_date DESC
         LIMIT 100`,
        [employeeId],
      );

      return res.json({
        status: "success",
        message: "Attendance history retrieved successfully.",
        attendance: result.rows,
      });
    } catch (error) {
      console.error("Attendance history error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve attendance history.",
      });
    }
  },
);

// POST: Employee clock-in

router.post(
  "/attendance/clock-in",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      const result = await pool.query(
        `WITH current_time AS (
           SELECT NOW() AS actual_time
         ),
         eligible_shift AS (
           SELECT
             esa.employee_id,
             esa.shift_date,
             s.shift_name,
             ((esa.shift_date + s.start_time)
               AT TIME ZONE 'Africa/Nairobi') AS shift_start,
             (((
               CASE
                 WHEN s.end_time <= s.start_time
                 THEN esa.shift_date + 1
                 ELSE esa.shift_date
               END
             ) + s.end_time)
               AT TIME ZONE 'Africa/Nairobi') AS shift_end,
             ct.actual_time
           FROM employee_shift_assignments esa
           JOIN shifts s ON s.id = esa.shift_id
           CROSS JOIN current_time ct
           WHERE esa.employee_id = $1
             AND s.is_active = TRUE
             AND ct.actual_time >=
               ((esa.shift_date + s.start_time)
                 AT TIME ZONE 'Africa/Nairobi')
             AND ct.actual_time <=
               (((
                 CASE
                   WHEN s.end_time <= s.start_time
                   THEN esa.shift_date + 1
                   ELSE esa.shift_date
                 END
               ) + s.end_time)
                 AT TIME ZONE 'Africa/Nairobi')
           ORDER BY esa.shift_date DESC
           LIMIT 1
         )
         INSERT INTO attendance (
           employee_id,
           attendance_date,
           clock_in,
           attendance_status,
           recorded_by
         )
         SELECT
           es.employee_id,
           es.shift_date,
           es.actual_time,
           CASE
             WHEN es.actual_time >
               es.shift_start + INTERVAL '15 minutes'
             THEN 'LATE'
             ELSE 'PRESENT'
           END,
           $2
         FROM eligible_shift es
         ON CONFLICT (employee_id, attendance_date)
         DO NOTHING
         RETURNING *`,
        [employeeId, req.user.userId],
      );

      if (result.rows.length === 0) {
        return res.status(409).json({
          status: "error",
          message:
            "No active shift is currently scheduled for you, or attendance has already been recorded for this shift.",
        });
      }

      const attendance = result.rows[0];

      return res.status(201).json({
        status: "success",
        message:
          attendance.attendance_status === "LATE"
            ? "Clock-in recorded. You have been marked late."
            : "Clock-in recorded successfully.",
        attendance,
      });
    } catch (error) {
      console.error("Clock-in error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to record clock-in.",
      });
    }
  },
);
// POST: Employee clock-out
router.post(
  "/attendance/clock-out",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      if (!employeeId) {
        return res.status(400).json({
          status: "error",
          message: "Employee profile not found.",
        });
      }

      const result = await pool.query(
        `UPDATE attendance
         SET
           clock_out = NOW(),
           hours_worked = ROUND(
             (
               EXTRACT(EPOCH FROM (NOW() - clock_in)) / 3600
             )::numeric,
             2
           )
         WHERE id = (
           SELECT id
           FROM attendance
           WHERE employee_id = $1
             AND clock_in IS NOT NULL
             AND clock_out IS NULL
           ORDER BY clock_in DESC
           LIMIT 1
           FOR UPDATE
         )
         RETURNING *`,
        [employeeId],
      );

      if (result.rows.length === 0) {
        return res.status(409).json({
          status: "error",
          message:
            "No active clock-in record was found, or you have already clocked out.",
        });
      }

      return res.json({
        status: "success",
        message: "Clock-out recorded successfully.",
        attendance: result.rows[0],
      });
    } catch (error) {
      console.error("Clock-out error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to record clock-out.",
      });
    }
  },
);

// ==========================================
// ADMINISTRATOR ATTENDANCE MANAGEMENT
// ==========================================

// GET: Retrieve attendance overview and employee records

router.get(
  "/attendance-management",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const { date, search = "", department = "" } = req.query;

      // Validate selected date
      if (date) {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date
        ) {
          return res.status(400).json({
            status: "error",
            message: "Invalid attendance date.",
          });
        }
      }

      const searchTerm = String(search).trim().toLowerCase();
      const departmentFilter = String(department).trim();

      // Retrieve all active employees, their shifts,
      // attendance records and approved leave.
      const recordsResult = await pool.query(
        `WITH target_date AS (
           SELECT COALESCE(
             $1::date,
             (NOW() AT TIME ZONE 'Africa/Nairobi')::date
           ) AS selected_date
         ),

         employee_records AS (
           SELECT
             e.id AS employee_id,
             e.employee_number,
             e.first_name,
             e.last_name,
             e.employment_status,

             d.department_name,
             p.position_title,
             u.email,

             esa.id AS assignment_id,
             s.shift_name,
             s.start_time,
             s.end_time,

             CASE
               WHEN s.id IS NOT NULL THEN
                 ((
                   td.selected_date + s.start_time
                 ) AT TIME ZONE 'Africa/Nairobi')
               ELSE NULL
             END AS shift_start,

             a.id AS attendance_id,
             a.attendance_date,
             a.clock_in,
             a.clock_out,
             a.hours_worked,
             a.attendance_status,
             a.remarks,
             a.created_at,

             EXISTS (
               SELECT 1
               FROM leave_requests lr
               WHERE lr.employee_id = e.id
                 AND lr.request_status = 'APPROVED'
                 AND td.selected_date BETWEEN
                     lr.start_date AND lr.end_date
             ) AS has_approved_leave

           FROM employees e

           CROSS JOIN target_date td

           LEFT JOIN departments d
             ON e.department_id = d.id

           LEFT JOIN positions p
             ON e.position_id = p.id

           LEFT JOIN users u
             ON e.user_id = u.id

           LEFT JOIN employee_shift_assignments esa
             ON esa.employee_id = e.id
             AND esa.shift_date = td.selected_date

           LEFT JOIN shifts s
             ON s.id = esa.shift_id

           LEFT JOIN attendance a
             ON a.employee_id = e.id
             AND a.attendance_date = td.selected_date

           WHERE e.employment_status = 'ACTIVE'
         )

         SELECT
           *,
           CASE
             WHEN attendance_id IS NOT NULL
               THEN attendance_status

             WHEN has_approved_leave
               THEN 'ON_LEAVE'

             WHEN assignment_id IS NOT NULL
               AND NOW() > shift_start + INTERVAL '15 minutes'
               THEN 'ABSENT'

             WHEN assignment_id IS NOT NULL
               THEN 'AWAITING'

             ELSE 'NOT SCHEDULED'
           END AS calculated_status

         FROM employee_records

         ORDER BY first_name ASC, last_name ASC`,
        [date || null],
      );

      const allRecords = recordsResult.rows;

      // Calculate statistics using all active employees.
      const statistics = {
        total_employees: allRecords.length,

        total_records: 0,
        total_scheduled: 0,

        days_present: 0,
        days_absent: 0,
        days_late: 0,
        half_days: 0,
        on_leave: 0,

        awaiting: 0,
        not_scheduled: 0,

        total_hours: 0,
      };

      for (const record of allRecords) {
        if (record.attendance_id) {
          statistics.total_records++;
        }

        if (record.assignment_id) {
          statistics.total_scheduled++;
        }

        switch (record.calculated_status) {
          case "PRESENT":
            statistics.days_present++;
            break;

          case "ABSENT":
            statistics.days_absent++;
            break;

          case "LATE":
            statistics.days_late++;
            break;

          case "HALF_DAY":
            statistics.half_days++;
            break;

          case "ON_LEAVE":
            statistics.on_leave++;
            break;

          case "AWAITING":
            statistics.awaiting++;
            break;

          case "NOT SCHEDULED":
            statistics.not_scheduled++;
            break;
        }

        statistics.total_hours += Number(record.hours_worked || 0);
      }

      statistics.total_hours = Number(statistics.total_hours.toFixed(2));

      // Apply employee search and department filters.
      const filteredRecords = allRecords.filter((record) => {
        const searchableText = [
          record.first_name,
          record.last_name,
          record.employee_number,
          record.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !searchTerm || searchableText.includes(searchTerm);

        const matchesDepartment =
          !departmentFilter || record.department_name === departmentFilter;

        return matchesSearch && matchesDepartment;
      });

      // Retrieve departments for the filter dropdown.
      const departmentsResult = await pool.query(
        `SELECT id, department_name
         FROM departments
         ORDER BY department_name ASC`,
      );

      return res.json({
        status: "success",
        message: "Attendance management data retrieved successfully.",

        selected_date:
          date ||
          (
            await pool.query(
              `SELECT (NOW() AT TIME ZONE 'Africa/Nairobi')::date AS today`,
            )
          ).rows[0].today,

        statistics,

        attendance: filteredRecords.slice(0, 500),

        departments: departmentsResult.rows,
      });
    } catch (error) {
      console.error("Admin attendance management error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve attendance management data.",
      });
    }
  },
);

router.patch(
  "/attendance-management/:attendanceId/correction",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { attendanceId } = req.params;
      const { clock_in, clock_out, attendance_status, reason } = req.body;

      // Validate correction reason
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({
          status: "error",
          message: "A correction reason is required.",
        });
      }

      // Validate attendance status
      const allowedStatuses = [
        "PRESENT",
        "ABSENT",
        "LATE",
        "HALF_DAY",
        "ON_LEAVE",
      ];

      if (
        attendance_status !== undefined &&
        !allowedStatuses.includes(attendance_status)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid attendance status.",
        });
      }

      // Validate timestamp inputs
      const hasClockIn = Object.prototype.hasOwnProperty.call(
        req.body,
        "clock_in",
      );

      const hasClockOut = Object.prototype.hasOwnProperty.call(
        req.body,
        "clock_out",
      );

      const hasStatus = attendance_status !== undefined;

      const validateTimestamp = (value) => {
        if (value === null || value === "") return null;

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
          throw new Error("Invalid attendance timestamp.");
        }

        return parsed.toISOString();
      };

      const newClockIn = hasClockIn ? validateTimestamp(clock_in) : undefined;

      const newClockOut = hasClockOut
        ? validateTimestamp(clock_out)
        : undefined;

      await client.query("BEGIN");

      // Lock the attendance record
      const existingResult = await client.query(
        `SELECT *
         FROM attendance
         WHERE id = $1
         FOR UPDATE`,
        [attendanceId],
      );

      if (existingResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          status: "error",
          message: "Attendance record not found.",
        });
      }

      const oldRecord = existingResult.rows[0];

      const updatedClockIn = hasClockIn ? newClockIn : oldRecord.clock_in;

      const updatedClockOut = hasClockOut ? newClockOut : oldRecord.clock_out;

      const updatedStatus = hasStatus
        ? attendance_status
        : oldRecord.attendance_status;

      // Validate clock-in and clock-out relationship
      if (updatedClockOut && !updatedClockIn) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          status: "error",
          message: "Clock-in is required when clock-out is provided.",
        });
      }

      if (
        updatedClockIn &&
        updatedClockOut &&
        new Date(updatedClockOut) <= new Date(updatedClockIn)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          status: "error",
          message: "Clock-out must be later than clock-in.",
        });
      }

      // Recalculate hours worked
      const updateResult = await client.query(
        `UPDATE attendance
         SET
           clock_in = $1,
           clock_out = $2,
           attendance_status = $3,
           hours_worked = CASE
             WHEN $1::timestamptz IS NOT NULL
              AND $2::timestamptz IS NOT NULL
             THEN ROUND(
               (EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz))
               / 3600)::numeric,
               2
             )
             ELSE 0
           END,
           remarks = $4
         WHERE id = $5
         RETURNING *`,
        [
          updatedClockIn,
          updatedClockOut,
          updatedStatus,
          String(reason).trim(),
          attendanceId,
        ],
      );

      const updatedRecord = updateResult.rows[0];

      // Record the correction in the audit log
      await client.query(
        `INSERT INTO audit_logs (
          user_id,
          action,
          entity_name,
          entity_id,
          old_values,
          new_values,
          ip_address
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          req.user.userId,
          "ATTENDANCE_CORRECTED",
          "attendance",
          attendanceId,
          JSON.stringify(oldRecord),
          JSON.stringify({
            ...updatedRecord,
            correction_reason: String(reason).trim(),
          }),
          req.ip || null,
        ],
      );

      await client.query("COMMIT");

      return res.json({
        status: "success",
        message: "Attendance corrected successfully.",
        attendance: updatedRecord,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Attendance correction error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to correct attendance record.",
      });
    } finally {
      client.release();
    }
  },
);

// ==========================================
// ADMINISTRATOR SHIFT MANAGEMENT
// ==========================================

// GET: Retrieve available shifts and employee assignments
router.get(
  "/shift-management",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const { date } = req.query;

      if (date) {
        const parsedDate = new Date(`${date}T00:00:00.000Z`);

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date
        ) {
          return res.status(400).json({
            status: "error",
            message: "Invalid shift date.",
          });
        }
      }

      const selectedDate = date || null;

      const [shiftsResult, employeesResult, assignmentsResult] =
        await Promise.all([
          pool.query(
            `SELECT id, shift_name, start_time, end_time, description
             FROM shifts
             WHERE is_active = TRUE
             ORDER BY start_time`,
          ),

          pool.query(
            `SELECT
               e.id,
               e.employee_number,
               e.first_name,
               e.last_name,
               d.department_name,
               p.position_title
             FROM employees e
             LEFT JOIN departments d ON e.department_id = d.id
             LEFT JOIN positions p ON e.position_id = p.id
             WHERE e.employment_status = 'ACTIVE'
             ORDER BY e.first_name, e.last_name`,
          ),

          pool.query(
            `SELECT
               esa.id AS assignment_id,
               esa.employee_id,
               esa.shift_id,
               esa.shift_date,
               e.employee_number,
               e.first_name,
               e.last_name,
               d.department_name,
               s.shift_name,
               s.start_time,
               s.end_time
             FROM employee_shift_assignments esa
             INNER JOIN employees e ON esa.employee_id = e.id
             INNER JOIN shifts s ON esa.shift_id = s.id
             LEFT JOIN departments d ON e.department_id = d.id
             WHERE esa.shift_date = COALESCE(
               $1::date,
               (NOW() AT TIME ZONE 'Africa/Nairobi')::date
             )
             ORDER BY s.start_time, e.first_name`,
            [selectedDate],
          ),
        ]);

      return res.json({
        status: "success",
        message: "Shift management data retrieved successfully.",
        selected_date: selectedDate,
        shifts: shiftsResult.rows,
        employees: employeesResult.rows,
        assignments: assignmentsResult.rows,
      });
    } catch (error) {
      console.error("Shift management error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve shift management data.",
      });
    }
  },
);

// POST: Assign a shift to an employee
router.post(
  "/shift-management/assign",
  authenticateToken,
  requireRole("SUPER_ADMIN", "HR_MANAGER"),
  async (req, res) => {
    try {
      const { employee_id, shift_id, shift_date } = req.body;

      if (!employee_id || !shift_id || !shift_date) {
        return res.status(400).json({
          status: "error",
          message: "Employee, shift and assignment date are required.",
        });
      }

      const parsedDate = new Date(`${shift_date}T00:00:00.000Z`);

      if (
        typeof shift_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(shift_date) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== shift_date
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid assignment date.",
        });
      }

      const employeeResult = await pool.query(
        `SELECT id
         FROM employees
         WHERE id = $1
           AND employment_status = 'ACTIVE'`,
        [employee_id],
      );

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "Active employee not found.",
        });
      }

      const shiftResult = await pool.query(
        `SELECT id
         FROM shifts
         WHERE id = $1
           AND is_active = TRUE`,
        [shift_id],
      );

      if (shiftResult.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "Active shift not found.",
        });
      }

      const result = await pool.query(
        `INSERT INTO employee_shift_assignments (
           employee_id,
           shift_id,
           shift_date,
           assigned_by
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (employee_id, shift_date)
         DO NOTHING
         RETURNING *`,
        [employee_id, shift_id, shift_date, req.user.userId],
      );

      if (result.rows.length === 0) {
        return res.status(409).json({
          status: "error",
          message: "This employee already has a shift assigned for that date.",
        });
      }

      return res.status(201).json({
        status: "success",
        message: "Employee shift assigned successfully.",
        assignment: result.rows[0],
      });
    } catch (error) {
      console.error("Shift assignment error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to assign employee shift.",
      });
    }
  },
);

export default router;
