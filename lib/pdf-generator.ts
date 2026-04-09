// Professional PDF Generator for Co-Term Calculator
// Can be used across all pages in the application

interface LicenseItem {
  id: string;
  serviceDescription: string;
  quantity: number;
  annualCost: number;
  additionalLicenses: number;
}

interface PDFData {
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
  companyLogo?: string | null;
}

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const generateCoTermPDF = async (data: PDFData): Promise<void> => {
  try {
    // Dynamic import jsPDF and autoTable together
    const [jsPDFModule, autoTableModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);

    const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    const doc = new jsPDF() as any;

    // Get the autoTable function - try both default and named export
    const autoTableFn = autoTableModule.default || (autoTableModule as any).applyPlugin;

    // Manually attach autoTable to doc instance with proper binding
    if (!doc.autoTable && autoTableFn) {
      doc.autoTable = function(options: any) {
        return autoTableFn(doc, options);
      };
    }
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // ========== PROFESSIONAL HEADER ==========
    // Header background with gradient effect (simulated with rectangles)
    doc.setFillColor(30, 64, 175); // Dark blue
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFillColor(59, 130, 246); // Lighter blue
    doc.rect(0, 35, pageWidth, 10, 'F');

    // Add logo if uploaded
    if (data.companyLogo) {
      try {
        doc.addImage(data.companyLogo, 'PNG', 15, 12, 40, 20);
      } catch (err) {
        console.log('Logo could not be added');
      }
    }

    // Title and Date on Header
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Co-Term Analysis Report', data.companyLogo ? 60 : 15, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(240, 240, 240);
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Generated: ${reportDate}`, data.companyLogo ? 60 : 15, 32);

    // Project Name if available
    if (data.projectName) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`Project: ${data.projectName}`, pageWidth - 15, 22, { align: 'right' });
    }

    // Billing Term Badge
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.billingTerm} Billing`, pageWidth - 15, 32, { align: 'right' });

    yPos = 55;

    // ========== EXECUTIVE SUMMARY SECTION ==========
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Executive Summary', 15, yPos);
    yPos += 2;

    // Underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 75, yPos);
    yPos += 10;

    // Calculate the table's remaining total for PDF (used in multiple places)
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

    // Key Metrics Cards with professional styling
    const currentCost = data.billingTerm === 'Monthly' ? data.results.currentMonthlyCost : data.results.currentAnnualCost;
    const updatedCost = data.billingTerm === 'Monthly' ? data.results.updatedMonthlyCost : data.results.updatedAnnualCost;
    const costDiff = data.billingTerm === 'Monthly' ? data.results.monthlyCostChange : data.results.costChange;

    const cardWidth = 45;
    const cardHeight = 26;
    const cardSpacing = 2;
    const cardsPerRow = 4;
    const totalCardsWidth = (cardWidth * cardsPerRow) + (cardSpacing * (cardsPerRow - 1));
    const cardStartX = (pageWidth - totalCardsWidth) / 2;

    // Card data - professional color scheme
    const cards = [
      {
        label: `Current ${data.billingTerm}`,
        value: `$${formatCurrency(currentCost)}`,
        color: [71, 85, 105] // Slate gray
      },
      {
        label: `Updated ${data.billingTerm}`,
        value: `$${formatCurrency(updatedCost)}`,
        color: [30, 64, 175] // Professional blue
      },
      {
        label: 'Cost Change',
        value: `+$${formatCurrency(costDiff)}`,
        sublabel: `+${data.results.costChangePercent.toFixed(1)}%`,
        color: [100, 116, 139] // Medium slate
      },
      {
        label: 'Remaining Term',
        value: `$${formatCurrency(tableRemainingTotal)}`,
        sublabel: `${data.monthsRemaining.toFixed(1)} months`,
        color: [51, 65, 85] // Dark slate
      }
    ];

    cards.forEach((card, index) => {
      const x = cardStartX + (index * (cardWidth + cardSpacing));

      // Card shadow
      doc.setFillColor(220, 220, 220);
      doc.roundedRect(x + 0.5, yPos + 0.5, cardWidth, cardHeight, 2, 2, 'F');

      // Card background
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'F');

      // Card border - subtle gray
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'S');

      // Colored top accent - thinner and more subtle
      doc.setFillColor(...card.color);
      doc.rect(x, yPos, cardWidth, 2, 'F');

      // Label
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(card.label, x + cardWidth / 2, yPos + 10, { align: 'center' });

      // Value
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(card.value, x + cardWidth / 2, yPos + 17, { align: 'center' });

      // Sublabel if exists
      if (card.sublabel) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text(card.sublabel, x + cardWidth / 2, yPos + 22, { align: 'center' });
      }
    });

    yPos += cardHeight + 15;

    // ========== AGREEMENT DETAILS SECTION ==========
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Agreement Details', 15, yPos);
    yPos += 2;

    // Underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 75, yPos);
    yPos += 8;

    // Agreement info box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, yPos, pageWidth - 30, 32, 2, 2, 'FD');

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.setFont('helvetica', 'normal');

    // Two columns for agreement info
    const col1X = 20;
    const col2X = pageWidth / 2 + 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Agreement Start Date:', col1X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.agreementStartDate, col1X + 50, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Agreement Term:', col2X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.agreementTermMonths} months`, col2X + 40, yPos);

    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Co-Term Start Date:', col1X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.coTermStartDate, col1X + 50, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Months Remaining:', col2X, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.monthsRemaining.toFixed(2)} months`, col2X + 40, yPos);

    yPos += 7;

    if (data.billingTerm === 'Annual') {
      doc.setFont('helvetica', 'bold');
      doc.text('Current Year Months:', col1X, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.currentYearMonths.toFixed(2)} months`, col1X + 50, yPos);

      doc.setFont('helvetica', 'bold');
      doc.text('Co-Term Cost:', col2X, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(`$${formatCurrency(data.results.coTermCost)}`, col2X + 40, yPos);
      yPos += 7;
    }

    yPos += 10;

    // ========== LICENSE DETAILS TABLE ==========
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('License Breakdown', 15, yPos);
    yPos += 2;

    // Underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 75, yPos);
    yPos += 6;

    const tableData = data.licenses.map(license => {
      const currentLicenseCost = data.billingTerm === 'Monthly'
        ? license.annualCost * license.quantity
        : license.annualCost * license.quantity;

      const updatedLicenseCost = data.billingTerm === 'Monthly'
        ? (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses)
        : (license.annualCost * license.quantity) + (license.annualCost * license.additionalLicenses);

      return [
        license.serviceDescription || 'Unnamed Service',
        license.quantity.toString(),
        `$${formatCurrency(license.annualCost)}`,
        license.additionalLicenses > 0 ? `+${license.additionalLicenses}` : '0',
        `$${formatCurrency(currentLicenseCost)}`,
        `$${formatCurrency(updatedLicenseCost)}`
      ];
    });

    // Add totals row
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

    tableData.push([
      'TOTAL',
      totalQty.toString(),
      '',
      `+${totalAdditional}`,
      `$${formatCurrency(totalCurrent)}`,
      `$${formatCurrency(totalUpdated)}`
    ]);

    doc.autoTable({
      startY: yPos,
      head: [[
        'Service Description',
        'Current Qty',
        `${data.billingTerm} Rate`,
        'Additional',
        `Current ${data.billingTerm}`,
        `Updated ${data.billingTerm}`
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'normal' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 15, right: 15 },
      didParseCell: function(data: any) {
        // Style the totals row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [226, 232, 240];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [30, 64, 175];
        }
      }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Check if we need a new page for the cost breakdown
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }

    // ========== FINANCIAL SUMMARY SECTION ==========
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', 15, yPos);
    yPos += 2;

    // Underline
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, yPos, 75, yPos);
    yPos += 8;

    // Summary box - dynamic height based on content
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);

    // Build summary items based on billing term - only show costs for the selected billing term
    const summaryItems: any[] = [];

    // Show current and updated costs for the selected billing term only
    summaryItems.push(
      { label: `Current ${data.billingTerm} Cost:`, value: `$${formatCurrency(currentCost)}` },
      { label: `Updated ${data.billingTerm} Cost:`, value: `$${formatCurrency(updatedCost)}`, bold: true },
      { label: `${data.billingTerm} Cost Increase:`, value: `+$${formatCurrency(costDiff)} (+${data.results.costChangePercent.toFixed(1)}%)`, color: [100, 116, 139] }
    );

    // For Annual billing, show co-term cost
    if (data.billingTerm === 'Annual') {
      summaryItems.push({
        label: 'Current Year Co-Term Cost:',
        value: `$${formatCurrency(data.results.coTermCost)}`,
        sublabel: `(${data.currentYearMonths.toFixed(1)} months until year end)`
      });
    }

    // Remaining term total
    summaryItems.push({
      label: 'Remaining Term Total:',
      value: `$${formatCurrency(tableRemainingTotal)}`,
      sublabel: `(${data.monthsRemaining.toFixed(1)} months remaining)`
    });

    // Total cost of ownership
    const totalCostOfOwnership = data.billingTerm === 'Monthly'
      ? (data.results.currentMonthlyCost * 12) + tableRemainingTotal
      : data.results.currentAnnualCost + tableRemainingTotal;

    summaryItems.push({
      label: 'Total Cost of Ownership:',
      value: `$${formatCurrency(totalCostOfOwnership)}`,
      sublabel: `(${data.agreementTermMonths} month agreement)`,
      bold: true,
      highlight: true
    });

    const summaryHeight = (summaryItems.length * 7) + 8;
    doc.roundedRect(15, yPos, pageWidth - 30, summaryHeight, 2, 2, 'FD');

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);

    summaryItems.forEach((item: any) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 51, 51);
      doc.text(item.label, 20, yPos);

      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      if (item.color) {
        doc.setTextColor(...item.color);
      } else if (item.highlight) {
        doc.setTextColor(30, 64, 175);
      } else {
        doc.setTextColor(51, 51, 51);
      }

      let valueText = item.value;
      if (item.sublabel) {
        valueText += ` ${item.sublabel}`;
      }

      doc.text(valueText, pageWidth - 20, yPos, { align: 'right' });
      yPos += 7;
    });

    // ========== FOOTER ==========
    const footerY = pageHeight - 15;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page 1 of 1`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(reportDate, pageWidth / 2, footerY + 4, { align: 'center' });

    // Save the PDF with project name if available
    const fileName = data.projectName
      ? `${data.projectName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-coterm-analysis-${new Date().toISOString().split('T')[0]}.pdf`
      : `co-term-analysis-${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
