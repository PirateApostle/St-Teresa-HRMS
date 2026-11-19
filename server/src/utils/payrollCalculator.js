/**
 * St Teresa Hospital HRMS
 * Payroll calculation utilities
 *
 * All monetary calculations are rounded to 2 decimal places.
 */

// ==========================================
// GENERAL MONEY UTILITIES
// ==========================================

export function roundMoney(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error("Invalid monetary amount.");
  }

  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// ==========================================
// PROGRESSIVE PAYE TAX CALCULATION
// ==========================================

export function calculateProgressiveTax(taxableIncome, bands) {
  const income = Number(taxableIncome);

  if (
    !Number.isFinite(income) ||
    income < 0 ||
    !Array.isArray(bands) ||
    bands.length === 0
  ) {
    throw new Error("Invalid PAYE income or tax bands.");
  }

  // Validate and normalize every tax band.
  const sortedBands = bands
    .map((band) => {
      const rate = Number(band.rate);

      const upperLimit =
        band.upper_limit === null ? Infinity : Number(band.upper_limit);

      if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 1 ||
        (upperLimit !== Infinity &&
          (!Number.isFinite(upperLimit) || upperLimit <= 0))
      ) {
        throw new Error("Invalid PAYE tax band configuration.");
      }

      return { upperLimit, rate };
    })
    .sort((a, b) => a.upperLimit - b.upperLimit);

  // Exactly one unlimited band must exist, and it must be last.
  const unlimitedBands = sortedBands.filter(
    (band) => band.upperLimit === Infinity,
  );

  if (
    unlimitedBands.length !== 1 ||
    sortedBands[sortedBands.length - 1].upperLimit !== Infinity
  ) {
    throw new Error(
      "PAYE configuration must contain exactly one final unlimited tax band.",
    );
  }

  // Reject duplicate or invalid band limits.
  let previousLimit = 0;

  for (const band of sortedBands) {
    if (band.upperLimit <= previousLimit) {
      throw new Error("PAYE tax bands must have increasing upper limits.");
    }

    previousLimit = band.upperLimit;
  }

  // Calculate tax progressively.
  let tax = 0;
  let lowerLimit = 0;

  for (const band of sortedBands) {
    const taxableInBand = Math.max(
      0,
      Math.min(income, band.upperLimit) - lowerLimit,
    );

    tax += taxableInBand * band.rate;

    lowerLimit = band.upperLimit;

    if (income <= band.upperLimit) {
      break;
    }
  }

  return roundMoney(tax);
}

// ==========================================
// PAYE INCLUDING PERSONAL RELIEF
// ==========================================

export function calculatePaye(taxableIncome, bands, personalRelief = 0) {
  const grossTax = calculateProgressiveTax(taxableIncome, bands);

  const relief = roundMoney(Math.max(0, Number(personalRelief)));

  const reliefApplied = Math.min(grossTax, relief);

  return {
    gross_tax: grossTax,
    personal_relief_applied: roundMoney(reliefApplied),
    paye: roundMoney(grossTax - reliefApplied),
  };
}

// ==========================================
// NSSF EMPLOYEE AND EMPLOYER CONTRIBUTIONS
// ==========================================

export function calculateNssf(pensionablePay, config) {
  const pay = Number(pensionablePay);

  if (!Number.isFinite(pay) || pay < 0) {
    throw new Error("Invalid NSSF pensionable pay.");
  }

  const lowerLimit = Number(config.lower_earnings_limit);
  const upperLimit = Number(config.upper_earnings_limit);

  const employeeRate = Number(config.employee_rate);
  const employerRate = Number(config.employer_rate);

  if (
    !Number.isFinite(lowerLimit) ||
    !Number.isFinite(upperLimit) ||
    !Number.isFinite(employeeRate) ||
    !Number.isFinite(employerRate) ||
    lowerLimit <= 0 ||
    upperLimit < lowerLimit
  ) {
    throw new Error("Invalid NSSF rate configuration.");
  }

  const tierOnePay = Math.min(pay, lowerLimit);

  const tierTwoPay = Math.max(0, Math.min(pay, upperLimit) - lowerLimit);

  const employeeContribution = (tierOnePay + tierTwoPay) * employeeRate;

  const employerContribution = (tierOnePay + tierTwoPay) * employerRate;

  return {
    tier_1_pay: roundMoney(tierOnePay),
    tier_2_pay: roundMoney(tierTwoPay),
    employee_contribution: roundMoney(employeeContribution),
    employer_contribution: roundMoney(employerContribution),
  };
}

// ==========================================
// SHIF CONTRIBUTION
// ==========================================

export function calculateShif(grossSalary, config) {
  const pay = Number(grossSalary);

  if (!Number.isFinite(pay) || pay < 0) {
    throw new Error("Invalid SHIF gross salary.");
  }

  const rate = Number(config.employee_rate);
  const minimum = Number(config.minimum_contribution);

  if (
    !Number.isFinite(rate) ||
    !Number.isFinite(minimum) ||
    rate < 0 ||
    minimum < 0
  ) {
    throw new Error("Invalid SHIF rate configuration.");
  }

  return roundMoney(Math.max(pay * rate, minimum));
}

// ==========================================
// AFFORDABLE HOUSING LEVY
// ==========================================

export function calculateHousingLevy(eligibleGrossSalary, config) {
  const pay = Number(eligibleGrossSalary);

  if (!Number.isFinite(pay) || pay < 0) {
    throw new Error("Invalid Housing Levy eligible gross salary.");
  }
  const employeeRate = Number(config.employee_rate);
  const employerRate = Number(config.employer_rate);

  if (
    !Number.isFinite(employeeRate) ||
    !Number.isFinite(employerRate) ||
    employeeRate < 0 ||
    employerRate < 0
  ) {
    throw new Error("Invalid Housing Levy rate configuration.");
  }

  return {
    employee_contribution: roundMoney(pay * employeeRate),
    employer_contribution: roundMoney(pay * employerRate),
  };
}

// ==========================================
// COMPLETE EMPLOYEE PAYROLL CALCULATION
// ==========================================

export function calculateEmployeePayroll({
  basicSalary,
  earningItems = [],
  deductionItems = [],
  rates,
  taxResident = true,
  personalReliefEligible = true,
  pensionablePay,
  shifSalary,
  housingLevySalary,
}) {
  if (!Array.isArray(earningItems) || !Array.isArray(deductionItems)) {
    throw new Error("Payroll earnings and deductions must be arrays.");
  }

  if (
    !rates ||
    !rates.PAYE ||
    !rates.NSSF ||
    !rates.SHIF ||
    !rates.AHL ||
    !Array.isArray(rates.PAYE.bands) ||
    rates.PAYE.bands.length === 0
  ) {
    throw new Error(
      "All four statutory rate configurations and valid PAYE tax bands are required.",
    );
  }
  const basic = roundMoney(basicSalary);

  if (!Number.isFinite(basic) || basic < 0) {
    throw new Error("Invalid basic salary.");
  }

  if (
    earningItems.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    ) ||
    deductionItems.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    throw new Error("Invalid payroll item.");
  }

  // Validate additional earnings.
  const additionalEarnings = earningItems.reduce((total, item) => {
    const amount = Number(item.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Invalid additional earning amount.");
    }

    return total + amount;
  }, 0);

  // Validate additional deductions.
  const additionalDeductions = deductionItems.reduce((total, item) => {
    const amount = Number(item.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Invalid additional deduction amount.");
    }

    return total + amount;
  }, 0);

  const grossSalary = roundMoney(basic + additionalEarnings);

  // Calculate statutory earnings bases.
  const eligibleEarnings = (flag) =>
    earningItems.reduce((total, item) => {
      const amount = Number(item.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Invalid additional earning amount.");
      }

      if (item[flag] !== undefined && typeof item[flag] !== "boolean") {
        throw new Error("Invalid payroll earning eligibility flag.");
      }

      return total + (item[flag] !== false ? amount : 0);
    }, 0);

  const payeTaxableEarnings = roundMoney(
    basic + eligibleEarnings("is_paye_taxable"),
  );

  const calculatedPensionablePay = roundMoney(
    basic + eligibleEarnings("is_pensionable"),
  );

  const calculatedShifSalary = roundMoney(
    basic + eligibleEarnings("is_shif_liable"),
  );

  const calculatedHousingLevySalary = roundMoney(
    basic + eligibleEarnings("is_housing_levy_liable"),
  );

  // Calculate NSSF.
  const finalPensionablePay = pensionablePay ?? calculatedPensionablePay;

  const nssf = calculateNssf(finalPensionablePay, rates.NSSF);

  // Calculate SHIF.
  const finalShifSalary = shifSalary ?? calculatedShifSalary;

  const shif = calculateShif(finalShifSalary, rates.SHIF);

  // Calculate Affordable Housing Levy.
  const finalHousingLevySalary =
    housingLevySalary ?? calculatedHousingLevySalary;

  const housingLevy = calculateHousingLevy(finalHousingLevySalary, rates.AHL);

  // Determine allowable deductions for PAYE.
  const pensionReliefLimit = Number(
    rates.PAYE.pension_deduction_limit ?? 30000,
  );

  if (!Number.isFinite(pensionReliefLimit) || pensionReliefLimit < 0) {
    throw new Error("Invalid pension deduction limit.");
  }

  const allowableNssf = Math.min(
    nssf.employee_contribution,
    pensionReliefLimit,
  );

  const taxableIncome = roundMoney(
    Math.max(
      0,
      payeTaxableEarnings -
        allowableNssf -
        shif -
        housingLevy.employee_contribution,
    ),
  );

  // Apply personal relief where eligible.
  if (
    typeof taxResident !== "boolean" ||
    typeof personalReliefEligible !== "boolean"
  ) {
    throw new Error("Invalid employee tax eligibility settings.");
  }

  const configuredPersonalRelief = Number(rates.PAYE.personal_relief ?? 2400);

  if (
    !Number.isFinite(configuredPersonalRelief) ||
    configuredPersonalRelief < 0
  ) {
    throw new Error("Invalid personal relief configuration.");
  }

  const personalRelief =
    taxResident && personalReliefEligible ? configuredPersonalRelief : 0;

  const payeResult = calculatePaye(
    taxableIncome,
    rates.PAYE.bands,
    personalRelief,
  );

  // Calculate employee statutory deductions.
  const statutoryDeductions = roundMoney(
    nssf.employee_contribution +
      shif +
      housingLevy.employee_contribution +
      payeResult.paye,
  );

  const totalDeductions = roundMoney(
    statutoryDeductions + additionalDeductions,
  );

  const netSalary = roundMoney(grossSalary - totalDeductions);

  if (
    !Number.isFinite(statutoryDeductions) ||
    !Number.isFinite(totalDeductions) ||
    !Number.isFinite(netSalary) ||
    statutoryDeductions < 0 ||
    totalDeductions < 0 ||
    netSalary < 0
  ) {
    throw new Error(
      "Invalid payroll totals. Review the earnings, deductions and statutory calculations.",
    );
  }

  // Employer contributions are not employee deductions.
  const employerContributions = roundMoney(
    nssf.employer_contribution + housingLevy.employer_contribution,
  );

  if (!Number.isFinite(employerContributions) || employerContributions < 0) {
    throw new Error("Invalid employer contribution total.");
  }
  return {
    basic_salary: basic,
    total_earnings: grossSalary,
    gross_salary: grossSalary,

    paye_taxable_earnings: payeTaxableEarnings,
    pensionable_pay: roundMoney(finalPensionablePay),
    shif_salary: roundMoney(finalShifSalary),
    housing_levy_salary: roundMoney(finalHousingLevySalary),

    taxable_income: taxableIncome,

    nssf_employee: nssf.employee_contribution,
    nssf_employer: nssf.employer_contribution,

    shif_employee: shif,

    housing_levy_employee: housingLevy.employee_contribution,
    housing_levy_employer: housingLevy.employer_contribution,

    paye: payeResult.paye,
    gross_paye: payeResult.gross_tax,
    personal_relief_applied: payeResult.personal_relief_applied,

    additional_deductions: roundMoney(additionalDeductions),

    total_deductions: totalDeductions,
    net_salary: netSalary,

    employer_contributions: employerContributions,
  };
}
