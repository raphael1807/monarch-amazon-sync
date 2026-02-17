// Quebec Tax Calculator
const GST_RATE = 0.05; // 5%
const QST_RATE = 0.09975; // 9.975%
const TOLERANCE = 0.1; // 10 cents tolerance for rounding (multi-item orders compound rounding)

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

export function formatTaxBreakdown(tax: TaxBreakdown, isRefund: boolean = false): string {
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
    // Unknown - analyze the difference to give specific, actionable guidance
    const absDiff = Math.abs(tax.difference);
    const diffPercent = tax.subtotal > 0 ? (absDiff / tax.subtotal) * 100 : 0;

    // Calculate what expected taxes WOULD be for reference
    const expectedGST = tax.subtotal * GST_RATE;
    const expectedBoth = tax.subtotal * (GST_RATE + QST_RATE);

    if (isRefund) {
      // Refund scenarios
      if (tax.difference < 0 && absDiff > 1) {
        output += `Partial refund detected\n`;
        output += `Items total: $${tax.subtotal.toFixed(2)}\n`;
        output += `Refund amount: $${tax.actualTotal.toFixed(2)}\n`;
        output += '💡 Not all items may have been refunded';
      } else {
        output += `Refund: $${tax.actualTotal.toFixed(2)}\n`;
        output += `Expected (items): $${tax.subtotal.toFixed(2)}\n`;
        output += `Difference: $${tax.difference.toFixed(2)}`;
      }
    } else if (tax.difference < 0 && absDiff > 1) {
      // Negative difference on a purchase = coupon, cancelled item, or promo
      output += `Coupon/discount: -$${absDiff.toFixed(2)}\n`;
      output += `Total: $${tax.actualTotal.toFixed(2)}\n`;
      output += '💡 A coupon, promo code, or item cancellation likely reduced the total';
    } else if (diffPercent > 50) {
      // Very large discrepancy - likely wrong match or missing items
      output += `⚠️ Large discrepancy: +$${tax.difference.toFixed(2)}\n`;
      output += `Items total: $${tax.subtotal.toFixed(2)}\n`;
      output += `Charged: $${tax.actualTotal.toFixed(2)}\n`;
      output += '💡 Check invoice - items may be missing or wrong order matched';
    } else if (tax.difference > 0) {
      // Positive difference - taxes, shipping, or fees
      const expectedTaxGST = tax.subtotal + expectedGST;
      const expectedTaxBoth = tax.subtotal + expectedBoth;

      if (Math.abs(tax.actualTotal - expectedTaxBoth) < 1) {
        // Close to GST+QST -- likely mixed-tax items where per-item rounding differs
        output += `Est. GST (5%): $${expectedGST.toFixed(2)}\n`;
        output += `Est. QST (9.975%): $${(tax.subtotal * QST_RATE).toFixed(2)}\n`;
        output += `Total: $${tax.actualTotal.toFixed(2)} ~✓`;
      } else if (Math.abs(tax.actualTotal - expectedTaxGST) < 1) {
        // Close to GST only -- some items may be QST-exempt (vitamins, food, books)
        output += `Est. GST (5%): $${expectedGST.toFixed(2)}\n`;
        output += `Total: $${tax.actualTotal.toFixed(2)} ~✓\n`;
        output += '💡 Some items may be QST-exempt (vitamins, food, books)';
      } else if (absDiff < 5) {
        // Small extra charge - likely shipping
        output += `Subtotal + fees: $${tax.difference.toFixed(2)} extra\n`;
        output += `Total: $${tax.actualTotal.toFixed(2)}\n`;
        output += '💡 May include shipping or handling';
      } else {
        output += `Additional charges: $${tax.difference.toFixed(2)}\n`;
        output += `Total: $${tax.actualTotal.toFixed(2)}\n`;
        output += '💡 May include shipping, handling, or mixed tax rates';
      }
    } else {
      // Very small difference (close to zero but outside tolerance)
      output += `Rounding adjustment: $${tax.difference.toFixed(2)}\n`;
      output += `Total: $${tax.actualTotal.toFixed(2)} ~✓`;
    }
  }

  return output;
}
