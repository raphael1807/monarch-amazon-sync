const GST_RATE = 0.05;
const QST_RATE = 0.09975;

export type TaxableItem = {
  date: string;
  amount: number;
  taxTag: string;
};

export type QuarterSummary = {
  quarter: number;
  label: string;
  tpsCollected: number;
  tvqCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  netTps: number;
  netTvq: number;
  revenueTotal: number;
  expenseTotal: number;
};

export function getQuarter(dateStr: string): number {
  const month = parseInt(dateStr.split('-')[1], 10) - 1;
  return Math.floor(month / 3) + 1;
}

function backCalcTax(total: number, taxTag: string): { tps: number; tvq: number } {
  const abs = Math.abs(total);

  if (taxTag.includes('tps + tvq') || taxTag.includes('14.975')) {
    const subtotal = abs / 1.14975;
    return { tps: round2(subtotal * GST_RATE), tvq: round2(subtotal * QST_RATE) };
  }
  if (taxTag.includes('tps inclus') || taxTag.includes('5%]')) {
    const subtotal = abs / 1.05;
    return { tps: round2(subtotal * GST_RATE), tvq: 0 };
  }
  if (taxTag.includes('tvq inclus') || taxTag.includes('9.975%]')) {
    const subtotal = abs / 1.09975;
    return { tps: 0, tvq: round2(subtotal * QST_RATE) };
  }
  return { tps: 0, tvq: 0 };
}

export function calculateQuarterlyTax(
  revenues: TaxableItem[],
  expenses: TaxableItem[],
  year: number,
): QuarterSummary[] {
  const quarters: QuarterSummary[] = [1, 2, 3, 4].map(q => ({
    quarter: q,
    label: `Q${q} ${year}`,
    tpsCollected: 0,
    tvqCollected: 0,
    tpsPaid: 0,
    tvqPaid: 0,
    netTps: 0,
    netTvq: 0,
    revenueTotal: 0,
    expenseTotal: 0,
  }));

  for (const rev of revenues) {
    if (!rev.date.startsWith(String(year))) continue;
    const qi = getQuarter(rev.date) - 1;
    const tax = backCalcTax(rev.amount, rev.taxTag);
    quarters[qi].tpsCollected += tax.tps;
    quarters[qi].tvqCollected += tax.tvq;
    quarters[qi].revenueTotal += Math.abs(rev.amount);
  }

  for (const exp of expenses) {
    if (!exp.date.startsWith(String(year))) continue;
    const qi = getQuarter(exp.date) - 1;
    const tax = backCalcTax(exp.amount, exp.taxTag);
    quarters[qi].tpsPaid += tax.tps;
    quarters[qi].tvqPaid += tax.tvq;
    quarters[qi].expenseTotal += Math.abs(exp.amount);
  }

  for (const q of quarters) {
    q.tpsCollected = round2(q.tpsCollected);
    q.tvqCollected = round2(q.tvqCollected);
    q.tpsPaid = round2(q.tpsPaid);
    q.tvqPaid = round2(q.tvqPaid);
    q.netTps = round2(q.tpsCollected - q.tpsPaid);
    q.netTvq = round2(q.tvqCollected - q.tvqPaid);
  }

  return quarters;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
