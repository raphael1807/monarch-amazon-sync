import type { MonarchTransaction } from './monarchApi';
import type { Order } from './amazonApi';

export interface MatchWithConfidence {
  amazon: Order;
  monarch: MonarchTransaction;
  items: Array<{ quantity: number; title: string; price: number }>;
  confidence: number;
  reason: string;
}

/**
 * Calculate confidence score for a match
 * 100 = Perfect match (exact amount, same day)
 * 95-99 = Excellent (exact amount, ±1 day)
 * 85-94 = Good (within $1, ±2 days)
 * 75-84 = Fair (within $2, ±3 days)
 * < 75 = Review needed
 */
export function calculateMatchConfidence(
  amazonOrder: Order,
  monarchTransaction: MonarchTransaction,
): { confidence: number; reason: string } {
  const amazonAmount = Math.abs(amazonOrder.transactions[0]?.amount || 0);
  const monarchAmount = Math.abs(monarchTransaction.amount);
  const amountDiff = Math.abs(amazonAmount - monarchAmount);

  const amazonDate = new Date(amazonOrder.date);
  const monarchDate = new Date(monarchTransaction.date);
  const daysDiff = Math.abs(Math.floor((amazonDate.getTime() - monarchDate.getTime()) / (1000 * 60 * 60 * 24)));

  let confidence = 100;
  const reasons: string[] = [];

  // Amount matching
  if (amountDiff === 0) {
    reasons.push('Exact amount match');
  } else if (amountDiff <= 0.5) {
    confidence -= 2;
    reasons.push(`Amount within $${amountDiff.toFixed(2)}`);
  } else if (amountDiff <= 1) {
    confidence -= 5;
    reasons.push(`Amount difference: $${amountDiff.toFixed(2)}`);
  } else if (amountDiff <= 2) {
    confidence -= 10;
    reasons.push(`Amount difference: $${amountDiff.toFixed(2)}`);
  } else {
    confidence -= 20;
    reasons.push(`Large amount difference: $${amountDiff.toFixed(2)}`);
  }

  // Date matching
  if (daysDiff === 0) {
    reasons.push('Same date');
  } else if (daysDiff === 1) {
    confidence -= 3;
    reasons.push('1 day apart');
  } else if (daysDiff === 2) {
    confidence -= 5;
    reasons.push('2 days apart');
  } else if (daysDiff === 3) {
    confidence -= 8;
    reasons.push('3 days apart');
  } else {
    confidence -= 15;
    reasons.push(`${daysDiff} days apart`);
  }

  // Refund handling
  if (amazonOrder.transactions[0]?.refund) {
    reasons.push('Refund transaction');
  }

  return {
    confidence: Math.max(0, confidence),
    reason: reasons.join(' • '),
  };
}
