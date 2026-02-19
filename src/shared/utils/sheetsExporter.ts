import type { MonarchTransaction } from '../api/monarchApi';
import { detectTaxTypeFromTags, calculateBillBreakdown } from './billProcessor';
import type { SheetRow } from '../api/googleSheetsApi';

export const EXPENSE_HEADERS: SheetRow = [
  'Date',
  'Merchant',
  'Category',
  'Subtotal',
  'TPS',
  'TVQ',
  'Total',
  'Account',
  'Entity',
  'Notes',
];
export const REVENUE_HEADERS: SheetRow = [
  'Date',
  'Merchant',
  'Category',
  'Subtotal',
  'TPS',
  'TVQ',
  'Total',
  'Account',
  'Notes',
];

type ExtendedTransaction = MonarchTransaction & {
  originalMerchant?: { id: string; name: string };
  account?: { id: string; displayName: string };
};

export function transactionToExpenseRow(tx: ExtendedTransaction, entity: string): SheetRow {
  const taxType = detectTaxTypeFromTags(tx.tags ?? []);
  const breakdown = taxType ? calculateBillBreakdown(tx.amount, taxType) : null;

  const merchant = tx.originalMerchant?.name ?? '—';
  const category = tx.category?.name ?? '—';
  const account = tx.account?.displayName ?? '—';
  const firstLineNote = (tx.notes ?? '').split('\n')[0].substring(0, 100);

  return [
    tx.date,
    merchant,
    category,
    breakdown?.subtotal ?? Math.abs(tx.amount),
    breakdown?.tps ?? 0,
    breakdown?.tvq ?? 0,
    Math.abs(tx.amount),
    account,
    entity,
    firstLineNote,
  ];
}

export function transactionToRevenueRow(tx: ExtendedTransaction): SheetRow {
  const taxType = detectTaxTypeFromTags(tx.tags ?? []);
  const breakdown = taxType ? calculateBillBreakdown(tx.amount, taxType) : null;

  const merchant = tx.originalMerchant?.name ?? '—';
  const category = tx.category?.name ?? '—';
  const account = tx.account?.displayName ?? '—';
  const firstLineNote = (tx.notes ?? '').split('\n')[0].substring(0, 100);

  return [
    tx.date,
    merchant,
    category,
    breakdown?.subtotal ?? Math.abs(tx.amount),
    breakdown?.tps ?? 0,
    breakdown?.tvq ?? 0,
    Math.abs(tx.amount),
    account,
    firstLineNote,
  ];
}
