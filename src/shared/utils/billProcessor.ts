import type { MonarchTransaction, MonarchTag } from '../api/monarchApi';

export type TaxType = 'none' | 'insurance' | 'gst_only' | 'qst_only' | 'gst_qst';

export type BillBreakdown = {
  taxType: TaxType;
  taxLabel: string;
  total: number;
  subtotal: number;
  tps: number;
  tvq: number;
  rate: number;
};

const TAX_TAG_PATTERNS: { pattern: RegExp; type: TaxType; rate: number; label: string }[] = [
  { pattern: /txs \[sans \[0%\]\]/, type: 'none', rate: 0, label: 'Sans taxes (0%)' },
  { pattern: /txs assur \[9%\]/, type: 'insurance', rate: 0.09, label: 'Assurances (9%)' },
  { pattern: /txs \[tps inclus \[5%\]\]/, type: 'gst_only', rate: 0.05, label: 'TPS inclus (5%)' },
  { pattern: /txs \[tvq inclus \[9\.975%\]\]/, type: 'qst_only', rate: 0.09975, label: 'TVQ inclus (9.975%)' },
  { pattern: /txs \[tps \+ tvq \[14\.975%\]\]/, type: 'gst_qst', rate: 0.14975, label: 'TPS + TVQ (14.975%)' },
];

export function detectTaxTypeFromTags(tags: { id: string; name: string }[]): TaxType | null {
  for (const tag of tags) {
    for (const { pattern, type } of TAX_TAG_PATTERNS) {
      if (pattern.test(tag.name)) return type;
    }
  }
  return null;
}

export function getTaxTagName(tags: { id: string; name: string }[]): string | null {
  for (const tag of tags) {
    for (const { pattern, label } of TAX_TAG_PATTERNS) {
      if (pattern.test(tag.name)) return label;
    }
  }
  return null;
}

export function calculateBillBreakdown(totalAmount: number, taxType: TaxType): BillBreakdown {
  const absTotal = Math.abs(totalAmount);

  switch (taxType) {
    case 'none':
      return { taxType, taxLabel: 'Sans taxes', total: absTotal, subtotal: absTotal, tps: 0, tvq: 0, rate: 0 };

    case 'insurance': {
      const subtotal = round2(absTotal / 1.09);
      const tax = round2(absTotal - subtotal);
      return { taxType, taxLabel: 'Taxe assurances (9%)', total: absTotal, subtotal, tps: 0, tvq: tax, rate: 0.09 };
    }

    case 'gst_only': {
      const subtotal = round2(absTotal / 1.05);
      const tps = round2(absTotal - subtotal);
      return { taxType, taxLabel: 'TPS (5%)', total: absTotal, subtotal, tps, tvq: 0, rate: 0.05 };
    }

    case 'qst_only': {
      const subtotal = round2(absTotal / 1.09975);
      const tvq = round2(absTotal - subtotal);
      return { taxType, taxLabel: 'TVQ (9.975%)', total: absTotal, subtotal, tps: 0, tvq, rate: 0.09975 };
    }

    case 'gst_qst': {
      const subtotal = round2(absTotal / 1.14975);
      const tps = round2(subtotal * 0.05);
      const tvq = round2(subtotal * 0.09975);
      return { taxType, taxLabel: 'TPS + TVQ (14.975%)', total: absTotal, subtotal, tps, tvq, rate: 0.14975 };
    }
  }
}

export function formatBillNote(breakdown: BillBreakdown): string {
  const lines = ['\n\n--- Facture ---'];
  lines.push(`Sous-total: ${fmt(breakdown.subtotal)}`);

  if (breakdown.taxType === 'gst_only' || breakdown.taxType === 'gst_qst') {
    lines.push(`TPS (5%): ${fmt(breakdown.tps)}`);
  }
  if (breakdown.taxType === 'qst_only' || breakdown.taxType === 'gst_qst') {
    lines.push(`TVQ (9.975%): ${fmt(breakdown.tvq)}`);
  }
  if (breakdown.taxType === 'insurance') {
    lines.push(`Taxe assurances (9%): ${fmt(breakdown.tvq)}`);
  }
  if (breakdown.taxType === 'none') {
    lines.push('Aucune taxe applicable');
  }

  lines.push(`Total: ${fmt(breakdown.total)}`);
  return lines.join('\n');
}

export function transactionAlreadyHasBill(notes: string): boolean {
  return notes.includes('--- Facture ---');
}

export function findTagByName(allTags: MonarchTag[], name: string): MonarchTag | undefined {
  return allTags.find(t => t.name === name);
}

export function swapTag(currentTags: { id: string; name: string }[], removeTagId: string, addTagId: string): string[] {
  const ids = currentTags.map(t => t.id).filter(id => id !== removeTagId);
  if (!ids.includes(addTagId)) ids.push(addTagId);
  return ids;
}

export function removeTagFromList(currentTags: { id: string; name: string }[], removeTagId: string): string[] {
  return currentTags.map(t => t.id).filter(id => id !== removeTagId);
}

export type ProcessableBill = {
  transaction: MonarchTransaction & {
    originalMerchant?: { id: string; name: string };
    account?: { id: string; displayName: string };
  };
  taxType: TaxType;
  breakdown: BillBreakdown;
  alreadyProcessed: boolean;
};

export function analyzeTransactionsForBills(transactions: MonarchTransaction[]): ProcessableBill[] {
  return transactions.map(tx => {
    const taxType = detectTaxTypeFromTags(tx.tags ?? []);
    const alreadyProcessed = transactionAlreadyHasBill(tx.notes ?? '');
    const breakdown = taxType ? calculateBillBreakdown(tx.amount, taxType) : calculateBillBreakdown(tx.amount, 'none');

    return {
      transaction: tx,
      taxType: taxType ?? 'none',
      breakdown,
      alreadyProcessed,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}
