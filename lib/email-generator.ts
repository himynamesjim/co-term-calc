// Professional Email Template Generator for Co-Term Calculator
// Can be used across all pages in the application

interface LicenseItem {
  id: string;
  serviceDescription: string;
  quantity: number;
  annualCost: number;
  additionalLicenses: number;
}

interface EmailData {
  projectName: string;
  agreementStartDate: string;
  agreementTermMonths: number;
  coTermStartDate: string;
  monthsRemaining: number;
  currentYearMonths: number;
  billingTerm: 'Monthly' | 'Annual' | 'Pre-Paid';
  licenses: LicenseItem[];
  results: {
    currentMonthlyCost: number;
    currentAnnualCost: number;
    updatedMonthlyCost: number;
    updatedAnnualCost: number;
    monthlyCostChange: number;
    costChange: number;
    costChangePercent: number;
    coTermCost: number;
  };
}

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const generateCoTermEmail = (data: EmailData): string => {
  const currentCost = data.billingTerm === 'Monthly' ? data.results.currentMonthlyCost : data.results.currentAnnualCost;
  const updatedCost = data.billingTerm === 'Monthly' ? data.results.updatedMonthlyCost : data.results.updatedAnnualCost;
  const costDiff = data.billingTerm === 'Monthly' ? data.results.monthlyCostChange : data.results.costChange;

  // Calculate table remaining total
  const tableRemainingTotal = data.licenses.reduce((sum, license) => {
    let monthlyRate = data.billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
    let remainingTotal;

    if (data.billingTerm === 'Annual') {
      const currentYearCost = monthlyRate * license.additionalLicenses * data.currentYearMonths;
      const remainingMonthsAfterCurrentYear = Math.floor(data.monthsRemaining - data.currentYearMonths);
      const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
      remainingTotal = currentYearCost + remainingYearsCost;
    } else {
      remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * data.monthsRemaining;
    }

    return sum + remainingTotal;
  }, 0);

  const totalCostOfOwnership = data.billingTerm === 'Monthly'
    ? (data.results.currentMonthlyCost * 12) + tableRemainingTotal
    : data.results.currentAnnualCost + tableRemainingTotal;

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate license rows
  const licenseRows = data.licenses.map(license => {
    const currentLicenseCost = data.billingTerm === 'Monthly'
      ? license.annualCost * license.quantity
      : license.annualCost * license.quantity;

    const updatedLicenseCost = data.billingTerm === 'Monthly'
      ? (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses)
      : (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses);

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left;">${license.serviceDescription || 'Unnamed Service'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${license.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${formatCurrency(license.annualCost)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${license.additionalLicenses > 0 ? `+${license.additionalLicenses}` : '0'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${formatCurrency(currentLicenseCost)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">$${formatCurrency(updatedLicenseCost)}</td>
      </tr>
    `;
  }).join('');

  // Calculate totals
  const totalQty = data.licenses.reduce((sum, l) => sum + l.quantity, 0);
  const totalAdditional = data.licenses.reduce((sum, l) => sum + l.additionalLicenses, 0);
  const totalCurrent = data.licenses.reduce((sum, l) => {
    const cost = data.billingTerm === 'Monthly'
      ? l.annualCost * l.quantity
      : l.annualCost * l.quantity;
    return sum + cost;
  }, 0);
  const totalUpdated = data.licenses.reduce((sum, l) => {
    const cost = data.billingTerm === 'Monthly'
      ? (l.annualCost * l.quantity) + (l.annualCost * l.additionalLicenses)
      : (l.annualCost * l.quantity) + (l.annualCost * l.additionalLicenses);
    return sum + cost;
  }, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Co-Term Analysis Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" style="max-width: 700px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Co-Term Analysis Report</h1>
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px;">${reportDate}</p>
              ${data.projectName ? `<p style="margin: 12px 0 0 0; color: #ffffff; font-size: 16px; font-weight: 600;">Project: ${data.projectName}</p>` : ''}
              <p style="margin: 8px 0 0 0; color: #e0e7ff; font-size: 13px;">${data.billingTerm} Billing</p>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e40af; font-size: 20px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Executive Summary</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="50%" style="padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Current ${data.billingTerm}</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">$${formatCurrency(currentCost)}</p>
                  </td>
                  <td width="20"></td>
                  <td width="50%" style="padding: 16px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #3b82f6;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Updated ${data.billingTerm}</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e40af;">$${formatCurrency(updatedCost)}</p>
                  </td>
                </tr>
                <tr><td colspan="3" height="12"></td></tr>
                <tr>
                  <td width="50%" style="padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Cost Change</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #64748b;">+$${formatCurrency(costDiff)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">+${data.results.costChangePercent.toFixed(1)}%</p>
                  </td>
                  <td width="20"></td>
                  <td width="50%" style="padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Remaining Term</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">$${formatCurrency(tableRemainingTotal)}</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${data.monthsRemaining.toFixed(1)} months</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Agreement Details -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #1e40af; font-size: 20px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Agreement Details</h2>

              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Agreement Start Date:</strong><br>
                    <span style="color: #1e293b;">${data.agreementStartDate}</span>
                  </td>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Agreement Term:</strong><br>
                    <span style="color: #1e293b;">${data.agreementTermMonths} months</span>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Co-Term Start Date:</strong><br>
                    <span style="color: #1e293b;">${data.coTermStartDate}</span>
                  </td>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Months Remaining:</strong><br>
                    <span style="color: #1e293b;">${data.monthsRemaining.toFixed(2)} months</span>
                  </td>
                </tr>
                ${data.billingTerm === 'Annual' ? `
                <tr>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Current Year Months:</strong><br>
                    <span style="color: #1e293b;">${data.currentYearMonths.toFixed(2)} months</span>
                  </td>
                  <td width="50%" style="font-size: 14px;">
                    <strong style="color: #475569;">Co-Term Cost:</strong><br>
                    <span style="color: #1e293b;">$${formatCurrency(data.results.coTermCost)}</span>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- License Breakdown -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #1e40af; font-size: 20px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">License Breakdown</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #1e40af; color: #ffffff;">
                    <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 600;">Service Description</th>
                    <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600;">Current Qty</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600;">${data.billingTerm} Rate</th>
                    <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 600;">Additional</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600;">Current ${data.billingTerm}</th>
                    <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600;">Updated ${data.billingTerm}</th>
                  </tr>
                </thead>
                <tbody style="background-color: #ffffff;">
                  ${licenseRows}
                  <tr style="background-color: #f1f5f9; font-weight: 600;">
                    <td style="padding: 12px; text-align: left; color: #1e40af;">TOTAL</td>
                    <td style="padding: 12px; text-align: center; color: #1e40af;">${totalQty}</td>
                    <td style="padding: 12px; text-align: right; color: #1e40af;"></td>
                    <td style="padding: 12px; text-align: center; color: #1e40af;">+${totalAdditional}</td>
                    <td style="padding: 12px; text-align: right; color: #1e40af;">$${formatCurrency(totalCurrent)}</td>
                    <td style="padding: 12px; text-align: right; color: #1e40af;">$${formatCurrency(totalUpdated)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Financial Summary -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #1e40af; font-size: 20px; font-weight: 700; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Financial Summary</h2>

              <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="font-size: 14px; color: #475569; font-weight: 600;">Current ${data.billingTerm} Cost:</td>
                  <td style="font-size: 14px; color: #1e293b; text-align: right;">$${formatCurrency(currentCost)}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #475569; font-weight: 600;">Updated ${data.billingTerm} Cost:</td>
                  <td style="font-size: 14px; color: #1e293b; text-align: right; font-weight: 700;">$${formatCurrency(updatedCost)}</td>
                </tr>
                <tr>
                  <td style="font-size: 14px; color: #475569; font-weight: 600;">${data.billingTerm} Cost Increase:</td>
                  <td style="font-size: 14px; color: #64748b; text-align: right;">+$${formatCurrency(costDiff)} (+${data.results.costChangePercent.toFixed(1)}%)</td>
                </tr>
                ${data.billingTerm === 'Annual' ? `
                <tr>
                  <td style="font-size: 14px; color: #475569; font-weight: 600;">Current Year Co-Term Cost:</td>
                  <td style="font-size: 14px; color: #1e293b; text-align: right;">$${formatCurrency(data.results.coTermCost)} <span style="font-size: 12px; color: #64748b;">(${data.currentYearMonths.toFixed(1)} months until year end)</span></td>
                </tr>
                ` : ''}
                <tr>
                  <td style="font-size: 14px; color: #475569; font-weight: 600;">Remaining Term Total:</td>
                  <td style="font-size: 14px; color: #1e293b; text-align: right;">$${formatCurrency(tableRemainingTotal)} <span style="font-size: 12px; color: #64748b;">(${data.monthsRemaining.toFixed(1)} months remaining)</span></td>
                </tr>
                <tr style="background-color: #eff6ff;">
                  <td style="font-size: 15px; color: #1e40af; font-weight: 700;">Total Cost of Ownership:</td>
                  <td style="font-size: 15px; color: #1e40af; text-align: right; font-weight: 700;">$${formatCurrency(totalCostOfOwnership)} <span style="font-size: 12px; color: #3b82f6;">(${data.agreementTermMonths} month agreement)</span></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">${reportDate}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export const generateCoTermEmailText = (data: EmailData): string => {
  const currentCost = data.billingTerm === 'Monthly' ? data.results.currentMonthlyCost : data.results.currentAnnualCost;
  const updatedCost = data.billingTerm === 'Monthly' ? data.results.updatedMonthlyCost : data.results.updatedAnnualCost;
  const costDiff = data.billingTerm === 'Monthly' ? data.results.monthlyCostChange : data.results.costChange;

  // Calculate table remaining total
  const tableRemainingTotal = data.licenses.reduce((sum, license) => {
    let monthlyRate = data.billingTerm === 'Monthly' ? license.annualCost : license.annualCost / 12;
    let remainingTotal;

    if (data.billingTerm === 'Annual') {
      const currentYearCost = monthlyRate * license.additionalLicenses * data.currentYearMonths;
      const remainingMonthsAfterCurrentYear = Math.floor(data.monthsRemaining - data.currentYearMonths);
      const remainingYearsCost = monthlyRate * (license.quantity + license.additionalLicenses) * remainingMonthsAfterCurrentYear;
      remainingTotal = currentYearCost + remainingYearsCost;
    } else {
      remainingTotal = (monthlyRate * (license.quantity + license.additionalLicenses)) * data.monthsRemaining;
    }

    return sum + remainingTotal;
  }, 0);

  const totalCostOfOwnership = data.billingTerm === 'Monthly'
    ? (data.results.currentMonthlyCost * 12) + tableRemainingTotal
    : data.results.currentAnnualCost + tableRemainingTotal;

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Generate license table rows
  const licenseLines = data.licenses.map(license => {
    const currentLicenseCost = data.billingTerm === 'Monthly'
      ? license.annualCost * license.quantity
      : license.annualCost * license.quantity;

    const updatedLicenseCost = data.billingTerm === 'Monthly'
      ? (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses)
      : (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses);

    return `  ${license.serviceDescription || 'Unnamed Service'}
    Quantity: ${license.quantity} | Rate: $${formatCurrency(license.annualCost)} | Additional: ${license.additionalLicenses > 0 ? `+${license.additionalLicenses}` : '0'}
    Current ${data.billingTerm}: $${formatCurrency(currentLicenseCost)} | Updated ${data.billingTerm}: $${formatCurrency(updatedLicenseCost)}`;
  }).join('\n\n');

  // Calculate totals
  const totalQty = data.licenses.reduce((sum, l) => sum + l.quantity, 0);
  const totalAdditional = data.licenses.reduce((sum, l) => sum + l.additionalLicenses, 0);
  const totalCurrent = data.licenses.reduce((sum, l) => {
    const cost = data.billingTerm === 'Monthly'
      ? l.annualCost * l.quantity
      : l.annualCost * l.quantity;
    return sum + cost;
  }, 0);
  const totalUpdated = data.licenses.reduce((sum, l) => {
    const cost = data.billingTerm === 'Monthly'
      ? (l.annualCost * l.quantity) + (l.annualCost * l.additionalLicenses)
      : (l.annualCost * l.quantity) + (l.annualCost * l.additionalLicenses);
    return sum + cost;
  }, 0);

  return `
CO-TERM ANALYSIS REPORT
Generated: ${reportDate}
${data.projectName ? `Project: ${data.projectName}` : ''}
Billing Term: ${data.billingTerm}

================================================================================
EXECUTIVE SUMMARY
================================================================================

Current ${data.billingTerm} Cost:        $${formatCurrency(currentCost)}
Updated ${data.billingTerm} Cost:        $${formatCurrency(updatedCost)}
Cost Change:                   +$${formatCurrency(costDiff)} (+${data.results.costChangePercent.toFixed(1)}%)
Remaining Term Total:          $${formatCurrency(tableRemainingTotal)} (${data.monthsRemaining.toFixed(1)} months)

================================================================================
AGREEMENT DETAILS
================================================================================

Agreement Start Date:          ${data.agreementStartDate}
Agreement Term:                ${data.agreementTermMonths} months
Co-Term Start Date:            ${data.coTermStartDate}
Months Remaining:              ${data.monthsRemaining.toFixed(2)} months
${data.billingTerm === 'Annual' ? `Current Year Months:           ${data.currentYearMonths.toFixed(2)} months
Co-Term Cost:                  $${formatCurrency(data.results.coTermCost)}` : ''}

================================================================================
LICENSE BREAKDOWN
================================================================================

${licenseLines}

--------------------------------------------------------------------------------
TOTALS
  Total Quantity: ${totalQty} | Additional: +${totalAdditional}
  Current ${data.billingTerm}: $${formatCurrency(totalCurrent)} | Updated ${data.billingTerm}: $${formatCurrency(totalUpdated)}

================================================================================
FINANCIAL SUMMARY
================================================================================

Current ${data.billingTerm} Cost:                $${formatCurrency(currentCost)}
Updated ${data.billingTerm} Cost:                $${formatCurrency(updatedCost)}
${data.billingTerm} Cost Increase:               +$${formatCurrency(costDiff)} (+${data.results.costChangePercent.toFixed(1)}%)
${data.billingTerm === 'Annual' ? `
Current Year Co-Term Cost:               $${formatCurrency(data.results.coTermCost)}
                                         (${data.currentYearMonths.toFixed(1)} months until year end)` : ''}

Remaining Term Total:                    $${formatCurrency(tableRemainingTotal)}
                                         (${data.monthsRemaining.toFixed(1)} months remaining)

Total Cost of Ownership:                 $${formatCurrency(totalCostOfOwnership)}
                                         (${data.agreementTermMonths} month agreement)

================================================================================

Report Generated: ${reportDate}
  `.trim();
};
