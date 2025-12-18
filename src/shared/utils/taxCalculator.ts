// Quebec Tax Calculator
const GST_RATE = 0.05; // 5%
const QST_RATE = 0.09975; // 9.975%
const TOLERANCE = 0.05; // 5 cents tolerance for rounding

export type TaxBreakdown = {
  subtotal: number;
  gst: number;
  qst: number;
  expectedTotal: number;
  actualTotal: number;
  difference: number;
  type: 'GST only' | 'QST only' | 'GST+QST' | 'No tax' | 'Unknown';
};

export function calculateQuebecTaxes(itemsTotal: number, monarchTotal: number): TaxBreakdown {
  const difference = monarchTotal - itemsTotal;

  // Calculate expected taxes
  const expectedGST = itemsTotal * GST_RATE;
  const expectedQST = itemsTotal * QST_RATE;
  const expectedBoth = itemsTotal * (GST_RATE + QST_RATE);

  // Check which scenario matches
  if (Math.abs(difference - expectedGST) <= TOLERANCE) {
    // GST only (books, certain groceries)
    return {
      subtotal: itemsTotal,
      gst: expectedGST,
      qst: 0,
      expectedTotal: itemsTotal + expectedGST,
      actualTotal: monarchTotal,
      difference: monarchTotal - (itemsTotal + expectedGST),
      type: 'GST only',
    };
  } else if (Math.abs(difference - expectedQST) <= TOLERANCE) {
    // QST only (very rare)
    return {
      subtotal: itemsTotal,
      gst: 0,
      qst: expectedQST,
      expectedTotal: itemsTotal + expectedQST,
      actualTotal: monarchTotal,
      difference: monarchTotal - (itemsTotal + expectedQST),
      type: 'QST only',
    };
  } else if (Math.abs(difference - expectedBoth) <= TOLERANCE) {
    // GST + QST (most common)
    return {
      subtotal: itemsTotal,
      gst: expectedGST,
      qst: expectedQST,
      expectedTotal: itemsTotal + expectedBoth,
      actualTotal: monarchTotal,
      difference: monarchTotal - (itemsTotal + expectedBoth),
      type: 'GST+QST',
    };
  } else if (Math.abs(difference) <= TOLERANCE) {
    // No tax
    return {
      subtotal: itemsTotal,
      gst: 0,
      qst: 0,
      expectedTotal: itemsTotal,
      actualTotal: monarchTotal,
      difference: 0,
      type: 'No tax',
    };
  } else {
    // Unknown - could be shipping, mixed tax rates, or discounts
    return {
      subtotal: itemsTotal,
      gst: 0,
      qst: 0,
      expectedTotal: itemsTotal,
      actualTotal: monarchTotal,
      difference: difference,
      type: 'Unknown',
    };
  }
}

export function formatTaxBreakdown(tax: TaxBreakdown): string {
  let output = '\n\n💰 Tax Breakdown:\n';
  output += `Subtotal: $${tax.subtotal.toFixed(2)}\n`;

  if (tax.type === 'GST only') {
    output += `GST (5%): $${tax.gst.toFixed(2)}\n`;
    output += `Total: $${tax.expectedTotal.toFixed(2)}`;
    if (Math.abs(tax.difference) > 0.01) {
      output += ` (Actual: $${tax.actualTotal.toFixed(2)})`;
    } else {
      output += ' ✓';
    }
  } else if (tax.type === 'QST only') {
    output += `QST (9.975%): $${tax.qst.toFixed(2)}\n`;
    output += `Total: $${tax.expectedTotal.toFixed(2)}`;
    if (Math.abs(tax.difference) > 0.01) {
      output += ` (Actual: $${tax.actualTotal.toFixed(2)})`;
    } else {
      output += ' ✓';
    }
  } else if (tax.type === 'GST+QST') {
    output += `GST (5%): $${tax.gst.toFixed(2)}\n`;
    output += `QST (9.975%): $${tax.qst.toFixed(2)}\n`;
    output += `Total: $${tax.expectedTotal.toFixed(2)}`;
    if (Math.abs(tax.difference) > 0.01) {
      output += ` (Actual: $${tax.actualTotal.toFixed(2)})`;
    } else {
      output += ' ✓';
    }
  } else if (tax.type === 'No tax') {
    output += 'No taxes applied\n';
    output += `Total: $${tax.actualTotal.toFixed(2)} ✓`;
  } else {
    // Unknown - show the difference
    output += `Other fees/taxes: $${tax.difference.toFixed(2)}\n`;
    output += `Total: $${tax.actualTotal.toFixed(2)}`;

    if (Math.abs(tax.difference) > 0.5) {
      output += '\n💡 May include shipping, discounts, or tax-exempt items';
    }
  }

  return output;
}
