import express from "express";
import pool from "../config/db.js";
import PDFDocument from "pdfkit";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { calculateEmployeePayroll } from "../utils/payrollCalculator.js";
import { getEffectivePayrollRates } from "../utils/payrollRates.js";

const router = express.Router();
class PayrollApprovalError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "PayrollApprovalError";
    this.statusCode = statusCode;
  }
}

class PayrollPeriodCloseError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "PayrollPeriodCloseError";
    this.statusCode = statusCode;
  }
}

class PayrollPaymentError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "PayrollPaymentError";
    this.statusCode = statusCode;
  }
}

const PAYROLL_MANAGERS = ["SUPER_ADMIN", "HR_MANAGER", "FINANCE_OFFICER"];

// Validate YYYY-MM-DD dates
function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// ==========================================
// GET: Retrieve all payroll periods
// ==========================================

router.get(
  "/periods",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          pp.id,
          pp.period_name,
          pp.start_date,
          pp.end_date,
          pp.payment_date,
          pp.period_status,
          pp.created_at,
          COUNT(pr.id)::int AS employee_count,
          COUNT(pr.id) FILTER (
  WHERE pr.statutory_rates_snapshot <> '{}'::jsonb
)::int AS calculated_count,
COUNT(pr.id) FILTER (
  WHERE pr.statutory_rates_snapshot = '{}'::jsonb
)::int AS awaiting_calculation_count,
COUNT(pr.id) FILTER (
  WHERE pr.payment_status = 'APPROVED'
)::int AS approved_count,
COUNT(pr.id) FILTER (
  WHERE pr.payment_status = 'PAID'
)::int AS paid_count,
COUNT(pr.id) FILTER (
  WHERE pr.payment_status = 'FAILED'
)::int AS failed_count,
COUNT(pr.id) FILTER (
  WHERE pr.payment_status = 'PENDING'
)::int AS pending_count,
        ROUND(COALESCE(SUM(pr.basic_salary), 0), 2) AS total_basic_salary,
        ROUND(COALESCE(SUM(pr.total_earnings), 0), 2) AS total_earnings,
        ROUND(COALESCE(SUM(pr.taxable_income), 0), 2) AS total_taxable_income,
        ROUND(COALESCE(SUM(pr.personal_relief_amount), 0), 2) AS total_personal_relief,
        ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'DEDUCTION'
      AND UPPER(TRIM(pi.item_code)) = 'PAYE'
  ), 0),
  2
) AS total_paye,
 ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'DEDUCTION'
      AND UPPER(TRIM(pi.item_code)) = 'NSSF'
  ), 0),
  2
) AS total_nssf,
 ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'DEDUCTION'
      AND UPPER(TRIM(pi.item_code)) = 'SHIF'
  ), 0),
  2
) AS total_shif,
 ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'DEDUCTION'
      AND UPPER(TRIM(pi.item_code)) = 'AHL'
  ), 0),
  2
) AS total_ahl,
 ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'EMPLOYER_CONTRIBUTION'
      AND UPPER(TRIM(pi.item_code)) = 'NSSF_EMPLOYER'
  ), 0),
  2
) AS total_employer_nssf,
 ROUND(
  COALESCE((
    SELECT SUM(pi.amount)
    FROM payroll_items pi
    INNER JOIN payroll_records pr2
      ON pr2.id = pi.payroll_record_id
    WHERE pr2.payroll_period_id = pp.id
      AND pi.item_type = 'EMPLOYER_CONTRIBUTION'
      AND UPPER(TRIM(pi.item_code)) = 'AHL_EMPLOYER'
  ), 0),
  2
) AS total_employer_ahl,
ROUND(COALESCE(SUM(pr.gross_salary), 0), 2) AS total_gross,
ROUND(COALESCE(SUM(pr.total_deductions), 0), 2) AS total_deductions,
ROUND(COALESCE(SUM(pr.net_salary), 0), 2) AS total_net,
ROUND(COALESCE(SUM(pr.employer_contributions), 0), 2) AS total_employer_contributions
        FROM payroll_periods pp
        LEFT JOIN payroll_records pr
          ON pr.payroll_period_id = pp.id
        GROUP BY pp.id
        ORDER BY pp.start_date DESC, pp.created_at DESC, pp.id DESC
      `);

      return res.status(200).json({
        status: "success",
        message: "Payroll periods retrieved successfully.",
        periods: result.rows,
      });
    } catch (error) {
      console.error("Payroll periods retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve payroll periods.",
      });
    }
  },
);

// ==========================================
// POST: Create a payroll period
// ==========================================

router.post(
  "/periods",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    try {
      const { period_name, start_date, end_date, payment_date } = req.body;

      if (
        !period_name ||
        typeof period_name !== "string" ||
        !period_name.trim() ||
        period_name.trim().length > 100 ||
        !isValidDate(start_date) ||
        !isValidDate(end_date)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Provide a valid period name, start date and end date.",
        });
      }

      if (end_date < start_date) {
        return res.status(400).json({
          status: "error",
          message: "The end date cannot be before the start date.",
        });
      }

      if (
        payment_date !== undefined &&
        payment_date !== null &&
        payment_date !== "" &&
        !isValidDate(payment_date)
      ) {
        return res.status(400).json({
          status: "error",
          message: "The payment date is invalid.",
        });
      }

      if (payment_date && payment_date < end_date) {
        return res.status(400).json({
          status: "error",
          message:
            "The payment date cannot be before the payroll period end date.",
        });
      }

      // Prevent overlapping payroll periods.
      const overlap = await pool.query(
        `
        SELECT id, period_name
        FROM payroll_periods
        WHERE start_date <= $2
          AND end_date >= $1
        LIMIT 1
        `,
        [start_date, end_date],
      );

      if (overlap.rows.length > 0) {
        return res.status(409).json({
          status: "error",
          message: `This period overlaps with ${overlap.rows[0].period_name}.`,
        });
      }

      const result = await pool.query(
        `
        INSERT INTO payroll_periods (
          period_name,
          start_date,
          end_date,
          payment_date,
          period_status
        )
        VALUES ($1, $2, $3, $4, 'OPEN')
        RETURNING
          id,
          period_name,
          start_date,
          end_date,
          payment_date,
          period_status,
          created_at
        `,
        [period_name.trim(), start_date, end_date, payment_date || null],
      );

      return res.status(201).json({
        status: "success",
        message: "Payroll period created successfully.",
        period: result.rows[0],
      });
    } catch (error) {
      console.error("Payroll period creation error:", error);

      if (error.code === "23505" || error.code === "23P01") {
        return res.status(409).json({
          status: "error",
          message:
            "This payroll period conflicts with an existing payroll period.",
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Unable to create payroll period.",
      });
    }
  },
);

// ==========================================
// POST: Calculate an employee payroll record
// ==========================================

router.post(
  "/records/:recordId/calculate",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { recordId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(recordId || "")) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll record ID.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      // Lock the payroll record and its period.
      // First, retrieve the payroll period ID.
      const periodIdResult = await client.query(
        `
  SELECT payroll_period_id
  FROM payroll_records
  WHERE id = $1
  `,
        [recordId],
      );

      if (periodIdResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record not found.",
        });
      }

      const payrollPeriodId = periodIdResult.rows[0].payroll_period_id;

      // Lock the payroll period first.
      const periodResult = await client.query(
        `
  SELECT
    id,
    end_date::text AS end_date,
    period_status
  FROM payroll_periods
  WHERE id = $1
  FOR UPDATE
  `,
        [payrollPeriodId],
      );

      // Then lock the payroll record.
      const recordResult = await client.query(
        `
  SELECT
    id,
    employee_id,
    basic_salary,
    payment_status,
    tax_resident,
    personal_relief_eligible
  FROM payroll_records
  WHERE id = $1
    AND payroll_period_id = $2
  FOR UPDATE
  `,
        [recordId, payrollPeriodId],
      );

      if (recordResult.rowCount === 0 || periodResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record or period not found.",
        });
      }

      const record = {
        ...recordResult.rows[0],
        end_date: periodResult.rows[0].end_date,
        period_status: periodResult.rows[0].period_status,
      };

      if (
        record.payment_status !== "PENDING" ||
        record.period_status !== "OPEN"
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message:
            "Payroll can only be calculated for an open period with a pending record.",
        });
      }

      // Retrieve the statutory rates effective on the payroll period end date.
      const { rates, snapshot } = await getEffectivePayrollRates(
        record.end_date,
        client,
      );

      // Retrieve all existing payroll items.
      const itemsResult = await client.query(
        `
        SELECT
          id,
          item_type,
          item_code,
          description,
          amount,
          is_paye_taxable,
          is_pensionable,
          is_shif_liable,
          is_housing_levy_liable
        FROM payroll_items
        WHERE payroll_record_id = $1
        ORDER BY created_at, id
        FOR UPDATE
        `,
        [recordId],
      );

      const allItems = itemsResult.rows;

      // Exclude the basic salary item because it is passed separately.
      const earningItems = allItems.filter(
        (item) =>
          item.item_type === "EARNING" &&
          String(item.item_code).trim().toUpperCase() !== "BASIC_SALARY",
      );

      // Only manually entered deductions are passed to the calculator.
      const statutoryCodes = [
        "PAYE",
        "NSSF",
        "SHIF",
        "AHL",
        "NSSF_EMPLOYER",
        "AHL_EMPLOYER",
      ];

      const deductionItems = allItems.filter(
        (item) =>
          item.item_type === "DEDUCTION" &&
          !statutoryCodes.includes(String(item.item_code).trim().toUpperCase()),
      );

      // Calculate the complete payroll.
      const calculation = calculateEmployeePayroll({
        basicSalary: record.basic_salary,
        earningItems,
        deductionItems,
        rates,
        taxResident: record.tax_resident,
        personalReliefEligible: record.personal_relief_eligible,
      });

      // Remove previously generated statutory items.
      // Manual earnings and deductions remain untouched.
      await client.query(
        `
  DELETE FROM payroll_items
  WHERE payroll_record_id = $1
    AND (
      (
        item_type = 'DEDUCTION'
        AND UPPER(TRIM(item_code)) = ANY(
          ARRAY['PAYE', 'NSSF', 'SHIF', 'AHL']::varchar[]
        )
      )
      OR
      (
        item_type = 'EMPLOYER_CONTRIBUTION'
        AND UPPER(TRIM(item_code)) = ANY(
          ARRAY['NSSF_EMPLOYER', 'AHL_EMPLOYER']::varchar[]
        )
      )
    )
  `,
        [recordId],
      );

      // Prepare employee statutory deductions.
      const generatedItems = [
        {
          item_type: "DEDUCTION",
          item_code: "NSSF",
          description: "Employee NSSF Contribution",
          amount: calculation.nssf_employee,
        },
        {
          item_type: "DEDUCTION",
          item_code: "SHIF",
          description: "Social Health Insurance Fund Contribution",
          amount: calculation.shif_employee,
        },
        {
          item_type: "DEDUCTION",
          item_code: "AHL",
          description: "Employee Affordable Housing Levy",
          amount: calculation.housing_levy_employee,
        },
        {
          item_type: "DEDUCTION",
          item_code: "PAYE",
          description: "Pay As You Earn Tax",
          amount: calculation.paye,
        },

        // Employer contributions are separate payroll items.
        {
          item_type: "EMPLOYER_CONTRIBUTION",
          item_code: "NSSF_EMPLOYER",
          description: "Employer NSSF Contribution",
          amount: calculation.nssf_employer,
        },
        {
          item_type: "EMPLOYER_CONTRIBUTION",
          item_code: "AHL_EMPLOYER",
          description: "Employer Affordable Housing Levy",
          amount: calculation.housing_levy_employer,
        },
      ];

      // Save generated statutory payroll items.
      for (const item of generatedItems) {
        if (Number(item.amount) <= 0) {
          continue;
        }

        await client.query(
          `
          INSERT INTO payroll_items (
            payroll_record_id,
            item_type,
            item_code,
            description,
            amount,
            is_paye_taxable,
            is_pensionable,
            is_shif_liable,
            is_housing_levy_liable
          )
          VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, FALSE, FALSE)
          `,
          [
            recordId,
            item.item_type,
            item.item_code,
            item.description,
            item.amount,
          ],
        );
      }

      // Preserve the statutory rates and calculation bases.
      const ratesSnapshot = {
        ...snapshot,
        calculation_bases: {
          paye_taxable_earnings: calculation.paye_taxable_earnings,
          pensionable_pay: calculation.pensionable_pay,
          shif_salary: calculation.shif_salary,
          housing_levy_salary: calculation.housing_levy_salary,
        },
      };

      // Update the payroll record with calculated totals.
      const updatedRecord = await client.query(
        `
        UPDATE payroll_records
        SET
          gross_salary = $2,
          total_earnings = $3,
          total_deductions = $4,
          net_salary = $5,
          taxable_income = $6,
          personal_relief_amount = $7,
          employer_contributions = $8,
          statutory_rates_snapshot = $9::jsonb
        WHERE id = $1
        RETURNING *
        `,
        [
          recordId,
          calculation.gross_salary,
          calculation.total_earnings,
          calculation.total_deductions,
          calculation.net_salary,
          calculation.taxable_income,
          calculation.personal_relief_applied,
          calculation.employer_contributions,
          JSON.stringify(ratesSnapshot),
        ],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll calculated successfully.",
        payroll_record: updatedRecord.rows[0],
        calculation,
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Payroll calculation rollback error:", rollbackError);
        }
      }

      console.error("Payroll calculation error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to calculate payroll.",
      });
    } finally {
      client.release();
    }
  },
);

// ==========================================
// GET: Retrieve active employees for payroll
// ==========================================

router.get(
  "/employees",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          employee_number,
          first_name,
          last_name,
          department_id,
          employment_type,
          base_salary
        FROM employees
        WHERE employment_status = 'ACTIVE'
        ORDER BY first_name ASC, last_name ASC, employee_number ASC
      `);

      return res.status(200).json({
        status: "success",
        message: "Payroll employees retrieved successfully.",
        employees: result.rows,
      });
    } catch (error) {
      console.error("Payroll employee retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve payroll employees.",
      });
    }
  },
);

// ==========================================
// GET: Retrieve an employee's tax profile
// ==========================================

router.get(
  "/employees/:employeeId/tax-profile",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    try {
      const { employeeId } = req.params;

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          employeeId,
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid employee ID.",
        });
      }

      // Check that the employee exists.
      const employeeExists = await pool.query(
        "SELECT id FROM employees WHERE id = $1",
        [employeeId],
      );

      if (employeeExists.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Employee not found.",
        });
      }

      // Create a default profile if one does not exist.
      await pool.query(
        `
  INSERT INTO employee_tax_profiles (employee_id)
  VALUES ($1)
  ON CONFLICT (employee_id) DO NOTHING
  `,
        [employeeId],
      );

      const result = await pool.query(
        `
        SELECT
          e.id AS employee_id,
          e.employee_number,
          e.first_name,
          e.last_name,
          COALESCE(etp.tax_resident, TRUE) AS tax_resident,
         COALESCE(etp.personal_relief_eligible, TRUE)
  AS personal_relief_eligible,
etp.updated_at AS profile_updated_at
        FROM employees e
        LEFT JOIN employee_tax_profiles etp
          ON etp.employee_id = e.id
        WHERE e.id = $1
        `,
        [employeeId],
      );

      return res.status(200).json({
        status: "success",
        message: "Employee tax profile retrieved successfully.",
        tax_profile: result.rows[0],
      });
    } catch (error) {
      console.error("Tax profile retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve employee tax profile.",
      });
    }
  },
);

// ==========================================
// PATCH: Update an employee's tax profile
// ==========================================

router.patch(
  "/employees/:employeeId/tax-profile",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { employeeId } = req.params;
      const { tax_resident, personal_relief_eligible } = req.body;

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          employeeId,
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid employee ID.",
        });
      }

      if (
        (tax_resident !== undefined && typeof tax_resident !== "boolean") ||
        (personal_relief_eligible !== undefined &&
          typeof personal_relief_eligible !== "boolean") ||
        (tax_resident === undefined && personal_relief_eligible === undefined)
      ) {
        return res.status(400).json({
          status: "error",
          message: "Provide valid boolean tax profile settings.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      // Ensure the employee exists and has a profile.
      const employee = await client.query(
        `
        INSERT INTO employee_tax_profiles (employee_id)
        SELECT id
        FROM employees
        WHERE id = $1
        ON CONFLICT (employee_id) DO NOTHING
        RETURNING employee_id
        `,
        [employeeId],
      );

      if (employee.rowCount === 0) {
        const exists = await client.query(
          "SELECT id FROM employees WHERE id = $1",
          [employeeId],
        );

        if (exists.rowCount === 0) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(404).json({
            status: "error",
            message: "Employee not found.",
          });
        }
      }

      const current = await client.query(
        `
  SELECT tax_resident, personal_relief_eligible
  FROM employee_tax_profiles
  WHERE employee_id = $1
  FOR UPDATE
  `,
        [employeeId],
      );

      if (current.rowCount === 0) {
        throw new Error("Employee tax profile could not be created.");
      }

      const nextTaxResident = tax_resident ?? current.rows[0].tax_resident;

      let nextReliefEligible =
        personal_relief_eligible ?? current.rows[0].personal_relief_eligible;

      // Apply personal relief to all resident employees.
      if (nextTaxResident) {
        nextReliefEligible = true;
      } else {
        if (personal_relief_eligible === true) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            status: "error",
            message:
              "Non-resident employees cannot be eligible for personal relief.",
          });
        }

        nextReliefEligible = false;
      }

      const result = await client.query(
        `
        UPDATE employee_tax_profiles
        SET
          tax_resident = $2,
          personal_relief_eligible = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
        RETURNING
          employee_id,
          tax_resident,
          personal_relief_eligible,
          updated_at
        `,
        [employeeId, nextTaxResident, nextReliefEligible],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Employee tax profile updated successfully.",
        tax_profile: result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Tax profile rollback error:", rollbackError);
        }
      }

      console.error("Tax profile update error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to update employee tax profile.",
      });
    } finally {
      client.release();
    }
  },
);

// ==========================================
// POST: Generate an individual payroll record
// ==========================================

router.post(
  "/records/generate",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid request body is required.",
        });
      }

      const { employee_id, payroll_period_id } = req.body;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (
        !uuidPattern.test(employee_id || "") ||
        !uuidPattern.test(payroll_period_id || "")
      ) {
        return res.status(400).json({
          status: "error",
          message: "Valid employee ID and payroll period ID are required.",
        });
      }
      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // Retrieve employee and tax profile.
      const employeeResult = await client.query(
        `
        SELECT
          e.id,
          e.employee_number,
          e.first_name,
          e.last_name,
          e.base_salary,
          e.employment_status
         FROM employees e
WHERE e.id = $1
FOR UPDATE OF e
        `,
        [employee_id],
      );

      if (employeeResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Employee not found.",
        });
      }

      const employee = employeeResult.rows[0];

      if (employee.employment_status !== "ACTIVE") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message: "Only active employees can be included in payroll.",
        });
      }

      const basicSalary = Number(employee.base_salary);

      if (!Number.isFinite(basicSalary) || basicSalary <= 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message: "Employee must have a valid basic salary.",
        });
      }

      // Retrieve and lock payroll period.
      const periodResult = await client.query(
        `
        SELECT id, period_name, period_status
        FROM payroll_periods
        WHERE id = $1
        FOR UPDATE
        `,
        [payroll_period_id],
      );

      if (periodResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(404).json({
          status: "error",
          message: "Payroll period not found.",
        });
      }

      if (periodResult.rows[0].period_status !== "OPEN") {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(400).json({
          status: "error",
          message: "Payroll records can only be generated for open periods.",
        });
      }

      // Create a default tax profile if one does not exist.
      await client.query(
        `
        INSERT INTO employee_tax_profiles (employee_id)
        VALUES ($1)
        ON CONFLICT (employee_id) DO NOTHING
        `,
        [employee_id],
      );

      // Retrieve and lock the employee tax profile.
      const taxProfileResult = await client.query(
        `
  SELECT
    tax_resident,
    personal_relief_eligible
  FROM employee_tax_profiles
  WHERE employee_id = $1
  FOR UPDATE
  `,
        [employee_id],
      );

      if (taxProfileResult.rowCount === 0) {
        throw new Error("Employee tax profile could not be retrieved.");
      }

      const taxProfile = taxProfileResult.rows[0];

      // Create the payroll record.
      const result = await client.query(
        `
        INSERT INTO payroll_records (
          employee_id,
          payroll_period_id,
          basic_salary,
          gross_salary,
          total_earnings,
          total_deductions,
          net_salary,
          payment_status,
          tax_resident,
          personal_relief_eligible
        )
        VALUES ($1, $2, $3, 0, 0, 0, 0, 'PENDING', $4, $5)
        RETURNING *
        `,
        [
          employee_id,
          payroll_period_id,
          basicSalary,
          taxProfile.tax_resident,
          taxProfile.personal_relief_eligible,
        ],
      );

      // Add basic salary as an earning item.
      await client.query(
        `
        INSERT INTO payroll_items (
          payroll_record_id,
          item_type,
          item_code,
          description,
          amount
        )
        VALUES ($1, 'EARNING', 'BASIC_SALARY', 'Basic Salary', $2)
        `,
        [result.rows[0].id, basicSalary],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        status: "success",
        message: "Payroll record generated successfully.",
        payroll_record: result.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Payroll generation rollback error:", rollbackError);
        }
      }

      console.error("Payroll record generation error:", error);

      if (error.code === "23505") {
        return res.status(409).json({
          status: "error",
          message:
            "This employee already has a payroll record for this period.",
        });
      }

      if (error.code === "23503") {
        return res.status(400).json({
          status: "error",
          message: "The employee or payroll period is no longer available.",
        });
      }

      return res.status(500).json({
        status: "error",
        message: "Unable to generate payroll record.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

// ==========================================
// GET: Retrieve payroll records for a period
// ==========================================

router.get(
  "/periods/:periodId/records",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    try {
      const { periodId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(periodId || "")) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll period ID.",
        });
      }

      const periodResult = await pool.query(
        `
        SELECT id, period_name, start_date, end_date,
               payment_date, period_status
        FROM payroll_periods
        WHERE id = $1
        `,
        [periodId],
      );

      if (periodResult.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Payroll period not found.",
        });
      }

      const recordsResult = await pool.query(
        `
        SELECT
          pr.id,
          pr.employee_id,
          e.employee_number,
          e.first_name,
          e.last_name,
          d.department_name,
          pr.basic_salary,
          pr.gross_salary,
          pr.total_earnings,
          pr.total_deductions,
          pr.net_salary,
          pr.employer_contributions,
          pr.taxable_income,
        pr.personal_relief_amount,
        pr.statutory_rates_snapshot,
        pr.tax_resident,
pr.personal_relief_eligible,
          pr.payment_status,
          pr.payment_reference,
          pr.payment_date,
          pr.created_at,

          COALESCE(
  json_agg(
    json_build_object(
      'id', pi.id,
      'item_type', pi.item_type,
      'item_code', pi.item_code,
      'description', pi.description,
      'amount', pi.amount::numeric,
      'is_paye_taxable', pi.is_paye_taxable,
      'is_pensionable', pi.is_pensionable,
      'is_shif_liable', pi.is_shif_liable,
      'is_housing_levy_liable', pi.is_housing_levy_liable
    )
    ORDER BY pi.item_type, pi.item_code
  ) FILTER (WHERE pi.id IS NOT NULL),
  '[]'::json
) AS payroll_items

        FROM payroll_records pr

        INNER JOIN employees e
          ON e.id = pr.employee_id

        LEFT JOIN departments d
          ON d.id = e.department_id

        LEFT JOIN payroll_items pi
          ON pi.payroll_record_id = pr.id

        WHERE pr.payroll_period_id = $1

        GROUP BY
          pr.id,
          e.id,
          d.department_name

        ORDER BY e.first_name, e.last_name, e.employee_number
        `,
        [periodId],
      );

      const summary = recordsResult.rows.reduce(
        (totals, record) => {
          totals.total_employees += 1;
          totals.total_basic_salary += Number(record.basic_salary || 0);
          totals.total_gross_salary += Number(record.gross_salary || 0);
          totals.total_earnings += Number(record.total_earnings || 0);
          totals.total_deductions += Number(record.total_deductions || 0);
          totals.total_net_salary += Number(record.net_salary || 0);
          totals.total_employer_contributions += Number(
            record.employer_contributions || 0,
          );

          return totals;
        },
        {
          total_employees: 0,
          total_basic_salary: 0,
          total_gross_salary: 0,
          total_earnings: 0,
          total_deductions: 0,
          total_net_salary: 0,
          total_employer_contributions: 0,
        },
      );

      Object.keys(summary).forEach((key) => {
        if (key !== "total_employees") {
          summary[key] = Number(summary[key].toFixed(2));
        }
      });

      return res.status(200).json({
        status: "success",
        message: "Payroll records retrieved successfully.",
        period: periodResult.rows[0],
        summary,
        records: recordsResult.rows,
      });
    } catch (error) {
      console.error("Payroll records retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve payroll records.",
      });
    }
  },
);

// ==========================================
// POST: Add a manual payroll item
// ==========================================

router.post(
  "/records/:recordId/items",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { recordId } = req.params;

      const {
        item_type,
        item_code,
        description,
        amount,
        is_paye_taxable,
        is_pensionable,
        is_shif_liable,
        is_housing_levy_liable,
      } = req.body;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(recordId || "")) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll record ID.",
        });
      }

      if (
        !["EARNING", "DEDUCTION"].includes(item_type) ||
        typeof item_code !== "string" ||
        !item_code.trim() ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Number(amount.toFixed(2)) !== amount
      ) {
        return res.status(400).json({
          status: "error",
          message:
            "Provide a valid item type, code, description and positive amount.",
        });
      }

      const reservedCodes = [
        "BASIC_SALARY",
        "PAYE",
        "NSSF",
        "SHIF",
        "AHL",
        "NSSF_EMPLOYER",
        "AHL_EMPLOYER",
      ];

      const normalizedCode = item_code.trim().toUpperCase();

      if (normalizedCode.length > 50) {
        return res.status(400).json({
          status: "error",
          message: "Payroll item code cannot exceed 50 characters.",
        });
      }

      if (description.trim().length > 150) {
        return res.status(400).json({
          status: "error",
          message: "Payroll item description cannot exceed 150 characters.",
        });
      }

      if (reservedCodes.includes(normalizedCode)) {
        return res.status(400).json({
          status: "error",
          message:
            "This payroll item code is reserved for statutory payroll calculations.",
        });
      }

      const treatmentFlags = [
        is_paye_taxable,
        is_pensionable,
        is_shif_liable,
        is_housing_levy_liable,
      ];

      if (
        item_type === "EARNING" &&
        treatmentFlags.some(
          (flag) => flag !== undefined && typeof flag !== "boolean",
        )
      ) {
        return res.status(400).json({
          status: "error",
          message: "Statutory treatment flags must be true or false.",
        });
      }

      const treatment =
        item_type === "EARNING"
          ? {
              is_paye_taxable: is_paye_taxable ?? true,
              is_pensionable: is_pensionable ?? true,
              is_shif_liable: is_shif_liable ?? true,
              is_housing_levy_liable: is_housing_levy_liable ?? true,
            }
          : {
              is_paye_taxable: false,
              is_pensionable: false,
              is_shif_liable: false,
              is_housing_levy_liable: false,
            };

      await client.query("BEGIN");
      transactionStarted = true;

      const recordResult = await client.query(
        `
        SELECT
          pr.id,
          pr.payment_status,
          pp.period_status
        FROM payroll_records pr
        INNER JOIN payroll_periods pp
          ON pp.id = pr.payroll_period_id
        WHERE pr.id = $1
        FOR UPDATE OF pr, pp
        `,
        [recordId],
      );

      if (recordResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record not found.",
        });
      }

      const record = recordResult.rows[0];

      if (
        record.payment_status !== "PENDING" ||
        record.period_status !== "OPEN"
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message:
            "Payroll items can only be changed in an open, pending payroll record.",
        });
      }

      const itemResult = await client.query(
        `
        INSERT INTO payroll_items (
          payroll_record_id,
          item_type,
          item_code,
          description,
          amount,
          is_paye_taxable,
          is_pensionable,
          is_shif_liable,
          is_housing_levy_liable
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          recordId,
          item_type,
          normalizedCode,
          description.trim(),
          amount,
          treatment.is_paye_taxable,
          treatment.is_pensionable,
          treatment.is_shif_liable,
          treatment.is_housing_levy_liable,
        ],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        status: "success",
        message: "Payroll item added successfully.",
        payroll_item: itemResult.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("Payroll item creation error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to add payroll item.",
      });
    } finally {
      client.release();
    }
  },
);

// ==========================================
// DELETE: Remove a manual payroll item
// ==========================================

router.delete(
  "/records/:recordId/items/:itemId",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { recordId, itemId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (
        !uuidPattern.test(recordId || "") ||
        !uuidPattern.test(itemId || "")
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll record or item ID.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const recordResult = await client.query(
        `
        SELECT
          pr.id,
          pr.payment_status,
          pp.period_status
        FROM payroll_records pr
        INNER JOIN payroll_periods pp
          ON pp.id = pr.payroll_period_id
        WHERE pr.id = $1
        FOR UPDATE OF pr, pp
        `,
        [recordId],
      );

      if (recordResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record not found.",
        });
      }

      const record = recordResult.rows[0];

      if (
        record.payment_status !== "PENDING" ||
        record.period_status !== "OPEN"
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message:
            "Items can only be removed from open, pending payroll records.",
        });
      }

      const itemResult = await client.query(
        `
        DELETE FROM payroll_items
        WHERE id = $1
          AND payroll_record_id = $2
          AND item_type IN ('EARNING', 'DEDUCTION')
          AND item_code NOT IN (
            'BASIC_SALARY',
            'PAYE',
            'NSSF',
            'SHIF',
            'AHL',
            'NSSF_EMPLOYER',
            'AHL_EMPLOYER'
          )
        RETURNING id, item_code, description, amount
        `,
        [itemId, recordId],
      );

      if (itemResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          status: "error",
          message: "Payroll item not found or cannot be removed.",
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Manual payroll item removed successfully.",
        payroll_item: itemResult.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("Payroll item deletion error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to remove payroll item.",
      });
    } finally {
      client.release();
    }
  },
);

router.post(
  "/records/:recordId/approve",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      const { recordId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(recordId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll record ID.",
        });
      }

      const approverId = req.user.userId;

      if (!approverId || !uuidPattern.test(approverId)) {
        throw new Error("Authenticated approver ID is invalid.");
      }

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // Retrieve the payroll period ID.
      const periodIdResult = await client.query(
        `
  SELECT payroll_period_id
  FROM payroll_records
  WHERE id = $1
  `,
        [recordId],
      );

      if (periodIdResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record not found.",
        });
      }

      const payrollPeriodId = periodIdResult.rows[0].payroll_period_id;

      // Lock the payroll period first.
      const periodResult = await client.query(
        `
  SELECT id, period_status
  FROM payroll_periods
  WHERE id = $1
  FOR UPDATE
  `,
        [payrollPeriodId],
      );

      // Lock the payroll record second.
      const recordResult = await client.query(
        `
  SELECT
    pr.id,
    pr.employee_id,
    pr.payroll_period_id,
    pr.payment_status,
    pr.basic_salary,
    pr.gross_salary,
    pr.total_earnings,
    pr.total_deductions,
    pr.net_salary,
    pr.statutory_rates_snapshot,
    e.user_id AS employee_user_id
  FROM payroll_records pr
  INNER JOIN employees e
    ON e.id = pr.employee_id
  WHERE pr.id = $1
    AND pr.payroll_period_id = $2
  FOR UPDATE OF pr, e
  `,
        [recordId, payrollPeriodId],
      );

      if (periodResult.rowCount === 0 || recordResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll record or period not found.",
        });
      }

      const record = {
        ...recordResult.rows[0],
        period_status: periodResult.rows[0].period_status,
      };

      if (record.payment_status !== "PENDING") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Only pending payroll records can be approved.",
        });
      }

      if (record.period_status !== "OPEN") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Only payroll records in an open period can be approved.",
        });
      }

      if (
        !record.statutory_rates_snapshot ||
        typeof record.statutory_rates_snapshot !== "object" ||
        Array.isArray(record.statutory_rates_snapshot) ||
        Object.keys(record.statutory_rates_snapshot).length === 0 ||
        !record.statutory_rates_snapshot.calculation_bases ||
        typeof record.statutory_rates_snapshot.calculation_bases !== "object" ||
        Array.isArray(record.statutory_rates_snapshot.calculation_bases) ||
        Object.keys(record.statutory_rates_snapshot.calculation_bases)
          .length === 0
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Payroll must be fully calculated before approval.",
        });
      }

      const basicSalary = Number(record.basic_salary);
      const grossSalary = Number(record.gross_salary);
      const totalEarnings = Number(record.total_earnings);
      const totalDeductions = Number(record.total_deductions);
      const netSalary = Number(record.net_salary);

      const expectedNetSalary =
        Math.round((grossSalary - totalDeductions) * 100) / 100;

      if (
        ![
          basicSalary,
          grossSalary,
          totalEarnings,
          totalDeductions,
          netSalary,
        ].every(Number.isFinite) ||
        [
          basicSalary,
          grossSalary,
          totalEarnings,
          totalDeductions,
          netSalary,
        ].some((value) => value < 0) ||
        basicSalary <= 0 ||
        grossSalary <= 0 ||
        basicSalary > grossSalary ||
        Math.abs(totalEarnings - grossSalary) > 0.01 ||
        totalDeductions > grossSalary ||
        Math.abs(netSalary - expectedNetSalary) > 0.01
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message:
            "Payroll financial totals are inconsistent. Recalculate payroll before approval.",
        });
      }

      if (record.employee_user_id && record.employee_user_id === approverId) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          status: "error",
          message: "You cannot approve your own payroll record.",
        });
      }

      const approvalResult = await client.query(
        `
        UPDATE payroll_records
        SET
          payment_status = 'APPROVED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP
        WHERE id = $2
          AND payment_status = 'PENDING'
        RETURNING
          id,
          employee_id,
          payroll_period_id,
          payment_status,
          approved_by,
          approved_at
        `,
        [approverId, recordId],
      );

      if (approvalResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Payroll record could not be approved.",
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll record approved successfully.",
        payroll_record: approvalResult.rows[0],
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Payroll approval rollback error:", rollbackError);
        }
      }

      console.error("Payroll approval error:", error);

      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        status: "error",
        message:
          error instanceof PayrollApprovalError
            ? error.message
            : "Unable to approve payroll record.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.post(
  "/periods/:periodId/approve",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      const { periodId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(periodId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll period ID.",
        });
      }

      const approverId = req.user.userId;

      if (!approverId || !uuidPattern.test(approverId)) {
        return res.status(401).json({
          status: "error",
          message: "Invalid authenticated user.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      // Lock the payroll period.
      const periodResult = await client.query(
        `
        SELECT
          id,
          period_name,
          period_status
        FROM payroll_periods
        WHERE id = $1
        FOR UPDATE
        `,
        [periodId],
      );

      if (periodResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          status: "error",
          message: "Payroll period not found.",
        });
      }

      const period = periodResult.rows[0];

      if (period.period_status !== "OPEN") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Only open payroll periods can be approved.",
        });
      }

      // Lock all payroll records in the period.
      const recordsResult = await client.query(
        `
        SELECT
          pr.id,
          pr.employee_id,
          pr.payment_status,
          pr.basic_salary,
          pr.gross_salary,
          pr.total_earnings,
          pr.total_deductions,
          pr.net_salary,
          pr.statutory_rates_snapshot,
          pr.approved_by,
          pr.approved_at,
          e.user_id AS employee_user_id
        FROM payroll_records pr
        INNER JOIN employees e
          ON e.id = pr.employee_id
        WHERE pr.payroll_period_id = $1
        ORDER BY pr.employee_id
        FOR UPDATE OF pr, e
        `,
        [periodId],
      );

      if (recordsResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          status: "error",
          message: "Cannot approve a payroll period with no payroll records.",
        });
      }

      const records = recordsResult.rows;

      // Validate every payroll record before approving the period.
      for (const record of records) {
        if (
          record.payment_status !== "PENDING" &&
          record.payment_status !== "APPROVED"
        ) {
          throw new PayrollApprovalError(
            `Payroll record ${record.id} has an invalid approval status.`,
          );
        }

        const calculationBases =
          record.statutory_rates_snapshot?.calculation_bases;

        const requiredBases = [
          "paye_taxable_earnings",
          "pensionable_pay",
          "shif_salary",
          "housing_levy_salary",
        ];

        if (
          !record.statutory_rates_snapshot ||
          typeof record.statutory_rates_snapshot !== "object" ||
          Array.isArray(record.statutory_rates_snapshot) ||
          !calculationBases ||
          typeof calculationBases !== "object" ||
          Array.isArray(calculationBases) ||
          !requiredBases.every((key) =>
            Object.prototype.hasOwnProperty.call(calculationBases, key),
          ) ||
          !requiredBases.every(
            (key) =>
              Number.isFinite(Number(calculationBases[key])) &&
              Number(calculationBases[key]) >= 0,
          )
        ) {
          throw new PayrollApprovalError(
            `Payroll record ${record.id} has not been fully calculated.`,
          );
        }
        const basicSalary = Number(record.basic_salary);
        const grossSalary = Number(record.gross_salary);
        const totalEarnings = Number(record.total_earnings);
        const totalDeductions = Number(record.total_deductions);
        const netSalary = Number(record.net_salary);

        const financialValues = [
          basicSalary,
          grossSalary,
          totalEarnings,
          totalDeductions,
          netSalary,
        ];

        const expectedNetSalary =
          Math.round((grossSalary - totalDeductions) * 100) / 100;

        if (
          !financialValues.every(Number.isFinite) ||
          financialValues.some((value) => value < 0) ||
          basicSalary <= 0 ||
          grossSalary <= 0 ||
          basicSalary > grossSalary ||
          Math.abs(totalEarnings - grossSalary) > 0.01 ||
          totalDeductions > grossSalary ||
          Math.abs(netSalary - expectedNetSalary) > 0.01
        ) {
          throw new PayrollApprovalError(
            `Payroll record ${record.id} has inconsistent financial totals.`,
          );
        }

        if (
          record.payment_status === "APPROVED" &&
          (!record.approved_by || !record.approved_at)
        ) {
          throw new PayrollApprovalError(
            `Payroll record ${record.id} has incomplete approval details.`,
          );
        }

        if (
          record.payment_status === "PENDING" &&
          (record.approved_by || record.approved_at)
        ) {
          throw new PayrollApprovalError(
            `Payroll record ${record.id} has unexpected approval details.`,
          );
        }

        if (
          record.employee_user_id === approverId &&
          (record.payment_status === "PENDING" ||
            record.approved_by === approverId)
        ) {
          throw new PayrollApprovalError(
            "You cannot approve a payroll period containing your own payroll record.",
            403,
          );
        }
      }

      // Approve all pending records.
      const approvalResult = await client.query(
        `
        UPDATE payroll_records
        SET
          payment_status = 'APPROVED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP
        WHERE payroll_period_id = $2
          AND payment_status = 'PENDING'
        RETURNING id
        `,
        [approverId, periodId],
      );

      // Mark the entire payroll period as approved.
      const updatedPeriod = await client.query(
        `
        UPDATE payroll_periods
        SET period_status = 'APPROVED'
        WHERE id = $1
          AND period_status = 'OPEN'
        RETURNING
          id,
          period_name,
          period_status
        `,
        [periodId],
      );

      if (updatedPeriod.rowCount === 0) {
        throw new PayrollApprovalError(
          "Payroll period approval could not be completed.",
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll period approved successfully.",
        period: updatedPeriod.rows[0],
        total_records: records.length,
        newly_approved_records: approvalResult.rowCount,
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error(
            "Payroll period approval rollback error:",
            rollbackError,
          );
        }
      }

      console.error("Payroll period approval error:", error);

      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        status: "error",
        message:
          error instanceof PayrollApprovalError
            ? error.message
            : "Unable to approve payroll period.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.post(
  "/records/:recordId/pay",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      const { recordId } = req.params;

      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid payment request body is required.",
        });
      }

      const { payment_reference, payment_date } = req.body;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (!uuidPattern.test(recordId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll record ID.",
        });
      }

      const paidBy = req.user.userId;

      if (!paidBy || !uuidPattern.test(paidBy)) {
        return res.status(401).json({
          status: "error",
          message: "Invalid authenticated user.",
        });
      }

      if (
        typeof payment_reference !== "string" ||
        !payment_reference.trim() ||
        payment_reference.trim().length > 100
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid payment reference is required.",
        });
      }

      if (
        typeof payment_date !== "string" ||
        !datePattern.test(payment_date) ||
        !Number.isFinite(Date.parse(`${payment_date}T00:00:00Z`)) ||
        new Date(`${payment_date}T00:00:00Z`).toISOString().slice(0, 10) !==
          payment_date
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid payment date is required.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      const periodIdResult = await client.query(
        `SELECT payroll_period_id
         FROM payroll_records
         WHERE id = $1`,
        [recordId],
      );

      if (periodIdResult.rowCount === 0) {
        throw new PayrollPaymentError("Payroll record not found.", 404);
      }

      const payrollPeriodId = periodIdResult.rows[0].payroll_period_id;

      const periodResult = await client.query(
        `SELECT
     id,
     period_status,
     end_date::text AS end_date
   FROM payroll_periods
   WHERE id = $1
   FOR UPDATE`,
        [payrollPeriodId],
      );

      if (periodResult.rowCount === 0) {
        throw new PayrollPaymentError("Payroll period not found.", 404);
      }

      const recordResult = await client.query(
        `SELECT
           id,
           payroll_period_id,
           payment_status,
           payment_reference,
           payment_date,
           net_salary
         FROM payroll_records
         WHERE id = $1
           AND payroll_period_id = $2
         FOR UPDATE`,
        [recordId, payrollPeriodId],
      );

      if (recordResult.rowCount === 0) {
        throw new PayrollPaymentError("Payroll record not found.", 404);
      }

      const record = recordResult.rows[0];
      const period = periodResult.rows[0];

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (payment_date < period.end_date) {
        throw new PayrollPaymentError(
          "Payment date cannot be earlier than the payroll period end date.",
          400,
        );
      }

      if (payment_date > today) {
        throw new PayrollPaymentError(
          "Payment date cannot be in the future.",
          400,
        );
      }
      if (record.payment_status !== "APPROVED") {
        throw new PayrollPaymentError(
          "Only approved payroll records can be marked as paid.",
        );
      }

      if (period.period_status !== "APPROVED") {
        throw new PayrollPaymentError(
          "The payroll period must be approved before payment.",
        );
      }

      if (
        !Number.isFinite(Number(record.net_salary)) ||
        Number(record.net_salary) <= 0
      ) {
        throw new PayrollPaymentError(
          "Payroll record has an invalid net salary.",
        );
      }

      const paymentResult = await client.query(
        `UPDATE payroll_records
         SET
           payment_status = 'PAID',
           payment_reference = $1,
           payment_date = $2,
           paid_by = $3,
           paid_at = CURRENT_TIMESTAMP
         WHERE id = $4
           AND payment_status = 'APPROVED'
         RETURNING
           id,
           employee_id,
           payroll_period_id,
           gross_salary,
           total_deductions,
           net_salary,
           payment_status,
           payment_reference,
           payment_date,
           paid_by,
           paid_at`,
        [payment_reference.trim(), payment_date, paidBy, recordId],
      );

      if (paymentResult.rowCount === 0) {
        throw new PayrollPaymentError(
          "Payroll record could not be marked as paid.",
        );
      }

      const unpaidRecordsResult = await client.query(
        `SELECT COUNT(*)::int AS unpaid_count
   FROM payroll_records
   WHERE payroll_period_id = $1
     AND payment_status <> 'PAID'`,
        [payrollPeriodId],
      );

      if (unpaidRecordsResult.rows[0].unpaid_count === 0) {
        await client.query(
          `UPDATE payroll_periods
     SET period_status = 'PAID'
     WHERE id = $1
       AND period_status = 'APPROVED'`,
          [payrollPeriodId],
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll record marked as paid successfully.",
        payroll_record: paymentResult.rows[0],
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Payroll payment rollback error:", rollbackError);
        }
      }

      console.error("Payroll payment error:", error);

      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        status: "error",
        message:
          error instanceof PayrollPaymentError
            ? error.message
            : "Unable to process payroll payment.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.post(
  "/periods/:periodId/pay",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      const { periodId } = req.params;

      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid payment request body is required.",
        });
      }

      const { payment_reference, payment_date } = req.body;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (!uuidPattern.test(periodId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll period ID.",
        });
      }

      const paidBy = req.user.userId;

      if (!paidBy || !uuidPattern.test(paidBy)) {
        return res.status(401).json({
          status: "error",
          message: "Invalid authenticated user.",
        });
      }

      if (
        typeof payment_reference !== "string" ||
        !payment_reference.trim() ||
        payment_reference.trim().length > 100
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid batch payment reference is required.",
        });
      }

      if (
        typeof payment_date !== "string" ||
        !datePattern.test(payment_date) ||
        !Number.isFinite(Date.parse(`${payment_date}T00:00:00Z`)) ||
        new Date(`${payment_date}T00:00:00Z`).toISOString().slice(0, 10) !==
          payment_date
      ) {
        return res.status(400).json({
          status: "error",
          message: "A valid payment date is required.",
        });
      }

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (payment_date > today) {
        return res.status(400).json({
          status: "error",
          message: "Payment date cannot be in the future.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      const periodResult = await client.query(
        `SELECT
           id,
           period_name,
           period_status,
           end_date::text AS end_date
         FROM payroll_periods
         WHERE id = $1
         FOR UPDATE`,
        [periodId],
      );

      if (periodResult.rowCount === 0) {
        throw new PayrollPaymentError("Payroll period not found.", 404);
      }

      const period = periodResult.rows[0];

      if (period.period_status !== "APPROVED") {
        throw new PayrollPaymentError(
          "Only approved payroll periods can be paid.",
        );
      }

      if (payment_date < period.end_date) {
        throw new PayrollPaymentError(
          "Payment date cannot be earlier than the payroll period end date.",
          400,
        );
      }

      const recordsResult = await client.query(
        `SELECT
           id,
           employee_id,
           payment_status,
           net_salary
         FROM payroll_records
         WHERE payroll_period_id = $1
         ORDER BY employee_id
         FOR UPDATE`,
        [periodId],
      );

      if (recordsResult.rowCount === 0) {
        throw new PayrollPaymentError(
          "No payroll records were found for this period.",
        );
      }

      const records = recordsResult.rows;

      const invalidRecords = records.filter(
        (record) => !["APPROVED", "PAID"].includes(record.payment_status),
      );

      if (invalidRecords.length > 0) {
        throw new PayrollPaymentError(
          "All payroll records must be approved or already paid before bulk payment.",
        );
      }

      const unpaidRecords = records.filter(
        (record) => record.payment_status === "APPROVED",
      );

      if (unpaidRecords.length === 0) {
        throw new PayrollPaymentError(
          "All payroll records in this period have already been paid.",
        );
      }

      for (const record of unpaidRecords) {
        if (
          !Number.isFinite(Number(record.net_salary)) ||
          Number(record.net_salary) <= 0
        ) {
          throw new PayrollPaymentError(
            "One or more payroll records have an invalid net salary.",
          );
        }
      }

      const paymentResult = await client.query(
        `UPDATE payroll_records
         SET
           payment_status = 'PAID',
           payment_reference = $1,
           payment_date = $2,
           paid_by = $3,
           paid_at = CURRENT_TIMESTAMP
         WHERE payroll_period_id = $4
           AND payment_status = 'APPROVED'
         RETURNING
           id,
           employee_id,
           net_salary,
           payment_status,
           payment_reference,
           payment_date,
           paid_by,
           paid_at`,
        [payment_reference.trim(), payment_date, paidBy, periodId],
      );

      if (paymentResult.rowCount !== unpaidRecords.length) {
        throw new PayrollPaymentError(
          "Not all eligible payroll records could be marked as paid.",
        );
      }

      await client.query(
        `UPDATE payroll_periods
   SET period_status = 'PAID'
   WHERE id = $1
     AND period_status = 'APPROVED'`,
        [periodId],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll period payments processed successfully.",
        period: {
          id: period.id,
          period_name: period.period_name,
          period_status: "PAID",
        },
        total_records: records.length,
        newly_paid_records: paymentResult.rowCount,
        payment_reference: payment_reference.trim(),
        payment_date,
        paid_records: paymentResult.rows,
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error("Bulk payroll payment rollback error:", rollbackError);
        }
      }

      console.error("Bulk payroll payment error:", error);

      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        status: "error",
        message:
          error instanceof PayrollPaymentError
            ? error.message
            : "Unable to process payroll period payments.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.post(
  "/periods/:periodId/close",
  authenticateToken,
  requireRole(...PAYROLL_MANAGERS),
  async (req, res) => {
    let client;
    let transactionStarted = false;

    try {
      const { periodId } = req.params;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(periodId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payroll period ID.",
        });
      }

      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      const periodResult = await client.query(
        `SELECT
           id,
           period_name,
           period_status
         FROM payroll_periods
         WHERE id = $1
         FOR UPDATE`,
        [periodId],
      );

      if (periodResult.rowCount === 0) {
        throw new PayrollPeriodCloseError("Payroll period not found.", 404);
      }

      const period = periodResult.rows[0];

      if (period.period_status !== "PAID") {
        throw new PayrollPeriodCloseError(
          "Only fully paid payroll periods can be closed.",
        );
      }

      const recordsResult = await client.query(
        `SELECT
           COUNT(*)::int AS total_records,
           COUNT(*) FILTER (
             WHERE payment_status = 'PAID'
           )::int AS paid_records
         FROM payroll_records
         WHERE payroll_period_id = $1`,
        [periodId],
      );

      const { total_records, paid_records } = recordsResult.rows[0];

      if (total_records === 0 || total_records !== paid_records) {
        throw new PayrollPeriodCloseError(
          "All payroll records must be paid before the period can be closed.",
        );
      }

      const closeResult = await client.query(
        `UPDATE payroll_periods
         SET period_status = 'CLOSED'
         WHERE id = $1
           AND period_status = 'PAID'
         RETURNING id, period_name, period_status`,
        [periodId],
      );

      if (closeResult.rowCount === 0) {
        throw new PayrollPeriodCloseError(
          "Payroll period could not be closed.",
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        status: "success",
        message: "Payroll period closed successfully.",
        period: closeResult.rows[0],
        total_records,
        paid_records,
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query("ROLLBACK");
          transactionStarted = false;
        } catch (rollbackError) {
          console.error(
            "Payroll period closing rollback error:",
            rollbackError,
          );
        }
      }

      console.error("Payroll period closing error:", error);

      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        status: "error",
        message:
          error instanceof PayrollPeriodCloseError
            ? error.message
            : "Unable to close payroll period.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.get(
  "/my-payslips",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user.employeeId;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!employeeId || !uuidPattern.test(employeeId)) {
        return res.status(403).json({
          status: "error",
          message: "No valid employee profile is linked to this account.",
        });
      }

      const result = await pool.query(
        `SELECT
           pr.id AS payroll_record_id,
           pr.employee_id,
           e.employee_number,
           e.first_name,
           e.last_name,
           pp.id AS payroll_period_id,
           pp.period_name,
           pp.start_date,
           pp.end_date,
           pp.payment_date AS scheduled_payment_date,
           pr.basic_salary,
           pr.gross_salary,
           pr.total_earnings,
           pr.total_deductions,
           pr.taxable_income,
           pr.personal_relief_amount,
           pr.net_salary,
           pr.payment_status,
           pr.payment_reference,
           pr.payment_date,
           pr.approved_at,
           pr.paid_at,
           COALESCE(items.payroll_items, '[]'::jsonb)
             AS payroll_items
         FROM payroll_records pr
         INNER JOIN employees e
           ON e.id = pr.employee_id
         INNER JOIN payroll_periods pp
           ON pp.id = pr.payroll_period_id
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(
             jsonb_build_object(
               'item_type', pi.item_type,
               'item_code', pi.item_code,
               'description', pi.description,
               'amount', pi.amount,
               'is_paye_taxable', pi.is_paye_taxable,
               'is_pensionable', pi.is_pensionable,
               'is_shif_liable', pi.is_shif_liable,
               'is_housing_levy_liable',
                 pi.is_housing_levy_liable
             )
             ORDER BY pi.item_type, pi.item_code
           ) AS payroll_items
           FROM payroll_items pi
           WHERE pi.payroll_record_id = pr.id
         ) items ON TRUE
         WHERE pr.employee_id = $1
  AND e.user_id = $2
  AND pr.payment_status IN ('APPROVED', 'PAID')
           AND pp.period_status IN ('APPROVED', 'PAID', 'CLOSED')
         ORDER BY pp.start_date DESC`,
        [employeeId, req.user.userId],
      );

      return res.status(200).json({
        status: "success",
        count: result.rowCount,
        payslips: result.rows,
      });
    } catch (error) {
      console.error("Employee payslips retrieval error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to retrieve employee payslips.",
      });
    }
  },
);

router.get(
  "/my-payslips/:recordId/pdf",
  authenticateToken,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const { recordId } = req.params;
      const employeeId = req.user.employeeId;
      const userId = req.user.userId;

      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (
        !uuidPattern.test(recordId || "") ||
        !uuidPattern.test(employeeId || "") ||
        !uuidPattern.test(userId || "")
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid payslip request.",
        });
      }

      const result = await pool.query(
        `SELECT
           pr.id AS payroll_record_id,
           pr.employee_id,
           e.employee_number,
           e.first_name,
           e.last_name,
          e.personal_email,
d.department_name,
pp.period_name,
           pp.start_date,
           pp.end_date,
           pr.basic_salary,
           pr.gross_salary,
           pr.total_earnings,
           pr.total_deductions,
           pr.taxable_income,
           pr.personal_relief_amount,
           pr.net_salary,
           pr.payment_status,
           pr.payment_reference,
           pr.payment_date,
           pr.paid_at,
           COALESCE(items.payroll_items, '[]'::jsonb)
             AS payroll_items
         FROM payroll_records pr
         INNER JOIN employees e
  ON e.id = pr.employee_id
LEFT JOIN departments d
  ON d.id = e.department_id
INNER JOIN payroll_periods pp
           ON pp.id = pr.payroll_period_id
         LEFT JOIN LATERAL (
           SELECT jsonb_agg(
             jsonb_build_object(
             'id', pi.id,
               'item_type', pi.item_type,
               'item_code', pi.item_code,
               'description', pi.description,
               'amount', pi.amount
             )
             ORDER BY pi.item_type, pi.item_code, pi.id
           ) AS payroll_items
           FROM payroll_items pi
           WHERE pi.payroll_record_id = pr.id
         ) items ON TRUE
         WHERE pr.id = $1
           AND pr.employee_id = $2
           AND e.user_id = $3
           AND pr.payment_status IN ('APPROVED', 'PAID')
           AND pp.period_status IN ('APPROVED', 'PAID', 'CLOSED')
         LIMIT 1`,
        [recordId, employeeId, userId],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Payslip not found or unavailable.",
        });
      }

      const payslip = result.rows[0];

      const formatMoney = (value) =>
        `KSh ${Number(value || 0).toLocaleString("en-KE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      const formatPdfDate = (value) =>
        value
          ? new Date(value).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })
          : "Not available";

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
      });

      const safeEmployeeNumber = String(payslip.employee_number).replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );

      const safePeriod = String(payslip.period_name).replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );

      const filename = `Payslip_${safeEmployeeNumber}_${safePeriod}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      doc.pipe(res);

      // Hospital heading
      doc
        .fillColor("#102A43")
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("ST TERESA HOSPITAL", { align: "center" });

      doc
        .fillColor("#F28C28")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("EMPLOYEE PAYSLIP", { align: "center" });

      doc.fillColor("#000000");

      doc.moveDown();

      doc.fontSize(11).font("Helvetica-Bold").text("Employee Information");

      doc.font("Helvetica").fontSize(10);

      doc.text(`Employee: ${payslip.first_name} ${payslip.last_name}`);
      doc.text(`Employee Number: ${payslip.employee_number}`);
      doc.text(`Department: ${payslip.department_name || "Not assigned"}`);
      if (payslip.email) {
        doc.text(`Email: ${payslip.email}`);
      }
      doc.text(`Payroll Period: ${payslip.period_name}`);
      doc.text(
        `Period: ${formatPdfDate(payslip.start_date)} - ${formatPdfDate(payslip.end_date)}`,
      );
      doc.text(`Payment Status: ${payslip.payment_status}`);
      doc.text(`Taxable Income: ${formatMoney(payslip.taxable_income)}`);
      doc.text(
        `Personal Relief: ${formatMoney(payslip.personal_relief_amount)}`,
      );
      doc.text(
        `Payment Date: ${
          payslip.payment_date
            ? formatPdfDate(payslip.payment_date)
            : "Not yet paid"
        }`,
      );

      if (payslip.payment_reference) {
        doc.text(`Payment Reference: ${payslip.payment_reference}`);
      }

      doc.moveDown();

      // Earnings
      doc.fontSize(11).font("Helvetica-Bold").text("EARNINGS");

      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(10);

      for (const item of payslip.payroll_items || []) {
        if (item.item_type === "EARNING") {
          doc.text(`${item.description}: ${formatMoney(item.amount)}`);
        }
      }

      doc.moveDown();

      doc
        .font("Helvetica-Bold")
        .text(`Gross Salary: ${formatMoney(payslip.gross_salary)}`);

      doc.moveDown();

      // Deductions
      doc.fontSize(11).text("DEDUCTIONS");
      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(10);

      for (const item of payslip.payroll_items || []) {
        if (item.item_type === "DEDUCTION") {
          doc.text(`${item.description}: ${formatMoney(item.amount)}`);
        }
      }

      doc.moveDown();

      doc
        .font("Helvetica-Bold")
        .text(`Total Deductions: ${formatMoney(payslip.total_deductions)}`);

      doc.moveDown();

      // Employer contributions
      doc.fontSize(11).text("EMPLOYER CONTRIBUTIONS");
      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(10);

      for (const item of payslip.payroll_items || []) {
        if (item.item_type === "EMPLOYER_CONTRIBUTION") {
          doc.text(`${item.description}: ${formatMoney(item.amount)}`);
        }
      }

      doc.moveDown();

      // Net salary
      if (doc.y > 700) {
        doc.addPage();
      }

      const netSalaryY = doc.y;

      doc.rect(50, netSalaryY, 495, 55).fill("#102A43");

      doc
        .fillColor("#FFFFFF")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          `NET SALARY: ${formatMoney(payslip.net_salary)}`,
          65,
          netSalaryY + 18,
          {
            width: 465,
            align: "center",
          },
        );

      doc.y = netSalaryY + 70;
      doc.fillColor("#000000");

      doc.moveDown(2);

      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          "This payslip is electronically generated by St Teresa Hospital HRMS.",
          { align: "center" },
        );

      doc.end();
    } catch (error) {
      console.error("Payslip PDF generation error:", error);

      if (!res.headersSent) {
        return res.status(500).json({
          status: "error",
          message: "Unable to generate payslip PDF.",
        });
      }

      res.destroy(error);
    }
  },
);

export default router;
