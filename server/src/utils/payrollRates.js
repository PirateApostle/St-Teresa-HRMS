import pool from "../config/db.js";

// ==========================================
// RETRIEVE EFFECTIVE STATUTORY PAYROLL RATES
// ==========================================

export async function getEffectivePayrollRates(payrollDate, db = pool) {
  if (
    typeof payrollDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payrollDate) ||
    Number.isNaN(Date.parse(`${payrollDate}T00:00:00Z`)) ||
    new Date(`${payrollDate}T00:00:00Z`).toISOString().slice(0, 10) !==
      payrollDate
  ) {
    throw new Error("Invalid payroll effective date.");
  }

  const requiredCodes = ["PAYE", "NSSF", "SHIF", "AHL"];

  const result = await db.query(
    `
   SELECT
      rate_code,
      rate_name,
      effective_from,
      effective_to,
      configuration
    FROM payroll_statutory_rates
    WHERE rate_code = ANY($1::varchar[])
      AND effective_from <= $2
      AND (
        effective_to IS NULL
        OR effective_to >= $2
      )
    ORDER BY
      rate_code,
      effective_from DESC
    `,
    [requiredCodes, payrollDate],
  );

  const rateCounts = {};

  for (const row of result.rows) {
    rateCounts[row.rate_code] = (rateCounts[row.rate_code] || 0) + 1;
  }

  const overlappingRates = Object.entries(rateCounts)
    .filter(([, count]) => count > 1)
    .map(([code]) => code);

  if (overlappingRates.length > 0) {
    throw new Error(
      `Overlapping statutory rate configurations for ${payrollDate}: ${overlappingRates.join(", ")}`,
    );
  }

  const rates = {};
  const snapshot = {};

  for (const row of result.rows) {
    rates[row.rate_code] = row.configuration;

    snapshot[row.rate_code] = {
      rate_name: row.rate_name,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      configuration: row.configuration,
    };
  }

  const missingRates = requiredCodes.filter((code) => !rates[code]);

  if (missingRates.length > 0) {
    throw new Error(
      `Missing statutory payroll rates for ${payrollDate}: ${missingRates.join(", ")}`,
    );
  }

  return {
    rates,
    snapshot,
  };
}
