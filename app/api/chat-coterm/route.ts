import { NextRequest, NextResponse } from 'next/server';

function parseDate(dateStr: string): string | null {
  // Try to parse various date formats
  const patterns = [
    // MM/DD/YYYY or M/D/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // Month DD, YYYY or Month DD YYYY
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      if (pattern.source.includes('january|february')) {
        // Month name format
        const months: { [key: string]: string } = {
          january: '01', february: '02', march: '03', april: '04',
          may: '05', june: '06', july: '07', august: '08',
          september: '09', october: '10', november: '11', december: '12'
        };
        const month = months[match[1].toLowerCase()];
        const day = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      } else {
        // MM/DD/YYYY format
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  return null;
}

function extractNumber(text: string, context: string): number | null {
  // Look for numbers near the context word
  const regex = new RegExp(`${context}\\s*:?\\s*(\\d+)`, 'i');
  const match = text.match(regex);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try to find standalone numbers
  const numbers = text.match(/\b\d+\b/g);
  if (numbers && numbers.length === 1) {
    return parseInt(numbers[0], 10);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, licenseData } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get the user's question (last message)
    const userMessage = messages[messages.length - 1]?.content || '';
    const lowerMessage = userMessage.toLowerCase();

    let response = '';
    const actions: any[] = [];

    // Check for date setting actions
    if (lowerMessage.includes('set') && (lowerMessage.includes('start date') || lowerMessage.includes('agreement date'))) {
      const parsedDate = parseDate(userMessage);
      if (parsedDate) {
        actions.push({
          type: 'set_agreement_start_date',
          data: { date: parsedDate }
        });
        response = `I've set the agreement start date to ${parsedDate}.`;
      } else {
        response = `I couldn't parse the date. Please use a format like "10/12/2024" or "October 12, 2024".`;
      }
    }
    // Check for co-term date setting
    else if (lowerMessage.includes('set') && lowerMessage.includes('co-term')) {
      const parsedDate = parseDate(userMessage);
      if (parsedDate) {
        actions.push({
          type: 'set_coterm_date',
          data: { date: parsedDate }
        });
        response = `I've set the Co-Term date to ${parsedDate}.`;
      } else {
        response = `I couldn't parse the date. Please use a format like "10/12/2024" or "October 12, 2024".`;
      }
    }
    // Check for agreement term setting
    else if (lowerMessage.includes('set') && lowerMessage.includes('term')) {
      const months = extractNumber(userMessage, 'term');
      if (months) {
        actions.push({
          type: 'set_agreement_term',
          data: { months }
        });
        response = `I've set the agreement term to ${months} months.`;
      } else {
        response = `I couldn't find the number of months. Please specify like "set term to 36 months".`;
      }
    }
    // Check for adding licenses
    else if (lowerMessage.includes('add') && (lowerMessage.includes('license') || lowerMessage.includes('line item'))) {
      // Try to extract license details
      const quantityMatch = userMessage.match(/(\d+)\s+(license|user|seat)/i);
      const costMatch = userMessage.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
      const annualCost = costMatch ? parseFloat(costMatch[1].replace(/,/g, '')) : 0;

      // Extract service name (simple heuristic)
      let serviceName = 'New License';
      const forMatch = userMessage.match(/(?:for|called|named)\s+([^,]+)/i);
      if (forMatch) {
        serviceName = forMatch[1].trim();
      }

      actions.push({
        type: 'add_license',
        data: {
          serviceDescription: serviceName,
          quantity: quantity,
          annualCost: annualCost,
          additionalLicenses: 0
        }
      });
      response = `I've added a license: ${serviceName} with ${quantity} license(s)${annualCost > 0 ? ` at $${annualCost.toLocaleString()}/year` : ''}.`;
    }
    // Informational queries
    else if (lowerMessage.includes('total') || lowerMessage.includes('cost')) {
      if (licenseData && licenseData.licenses && licenseData.licenses.length > 0) {
        const totalLicenses = licenseData.licenses.reduce((sum: number, item: any) =>
          sum + (item.quantity || 0) + (item.additionalLicenses || 0), 0
        );
        const totalAnnualCost = licenseData.licenses.reduce((sum: number, item: any) =>
          sum + (item.annualCost || 0), 0
        );

        response = `You have ${totalLicenses} total licenses with an annual cost of $${totalAnnualCost.toLocaleString()}.`;

        if (licenseData.billingTerm === 'Monthly') {
          response += ` With monthly billing, that's approximately $${(totalAnnualCost / 12).toFixed(2)}/month.`;
        }
      } else {
        response = `You don't have any licenses added yet. Would you like to add some?`;
      }
    }
    else if (lowerMessage.includes('date') || lowerMessage.includes('when')) {
      response = 'Current dates:\n';
      if (licenseData?.agreementStartDate) {
        response += `- Agreement Start: ${licenseData.agreementStartDate}\n`;
      }
      if (licenseData?.coTermStartDate) {
        response += `- Co-Term Date: ${licenseData.coTermStartDate}\n`;
      }
      if (licenseData?.agreementTermMonths) {
        response += `- Term: ${licenseData.agreementTermMonths} months\n`;
      }
      if (!licenseData?.agreementStartDate && !licenseData?.coTermStartDate) {
        response += 'No dates set yet. You can ask me to set them!';
      }
    }
    else {
      response = `I can help you with your Co-Term calculation! I can:\n\n` +
        `• Set dates (e.g., "set start date to 10/12/2024")\n` +
        `• Add licenses (e.g., "add 100 licenses for Umbrella at $5000")\n` +
        `• Check totals (e.g., "what's my total cost?")\n` +
        `• Update terms (e.g., "set term to 36 months")\n\n` +
        `What would you like to do?`;
    }

    return NextResponse.json({
      message: response,
      actions: actions.length > 0 ? actions : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
