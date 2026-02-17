import { Item, Order, OrderTransaction } from './amazonApi';
import { MonarchTransaction } from './monarchApi';
import { calculateMatchConfidence } from './matchConfidence';
import { parseFrenchDateToTimestamp } from '../utils/dateParser';

export type MatchedTransaction = {
  monarch: MonarchTransaction;
  amazon: OrderTransaction;
  items: Item[];
  confidence?: number;
  reason?: string;
};

const DAYS_7 = 1000 * 60 * 60 * 24 * 7;

function parseDate(dateStr: string): number | null {
  // Try French date parser first (for Amazon.ca)
  const frenchTimestamp = parseFrenchDateToTimestamp(dateStr);
  if (frenchTimestamp) return frenchTimestamp;

  // Fallback to standard Date parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date.getTime();

  console.warn('Could not parse date:', dateStr);
  return null;
}

export function matchTransactions(
  transactions: MonarchTransaction[],
  orders: Order[],
  override: boolean,
): MatchedTransaction[] {
  console.log('🔍 Matching:', transactions.length, 'Monarch ↔', orders.length, 'Amazon');

  const orderTransactions = orders.flatMap(order => {
    return (
      order.transactions?.map(transaction => {
        return {
          items: order.items,
          refund: transaction.refund,
          amount: transaction.refund ? transaction.amount : transaction.amount * -1,
          date: transaction.date,
          used: false,
          id: order.id,
        };
      }) ?? []
    );
  });

  const refundCount = orderTransactions.filter(t => t.refund).length;
  const purchaseCount = orderTransactions.filter(t => !t.refund).length;

  console.log('📦 Amazon transactions:', {
    total: orderTransactions.length,
    purchases: purchaseCount,
    refunds: refundCount,
  });

  console.log('💳 Monarch transactions:', {
    total: transactions.length,
  });

  // find monarch transactions that match amazon orders. don't allow duplicates
  const monarchAmazonTransactions = [];
  for (const monarchTransaction of transactions) {
    const monarchTimestamp = parseDate(monarchTransaction.date);
    if (!monarchTimestamp) {
      console.warn('Could not parse Monarch date:', monarchTransaction.date);
      continue;
    }

    let closestAmazon = null;
    let closestDistance = null;
    for (const amazonTransaction of orderTransactions) {
      // we already matched this transaction
      if (amazonTransaction.used) continue;

      const orderTimestamp = parseDate(amazonTransaction.date);
      if (!orderTimestamp) {
        console.warn('Could not parse Amazon date:', amazonTransaction.date);
        continue;
      }

      // look for Monarch transactions that are within 7 days of the Amazon transaction
      const lower = orderTimestamp - DAYS_7;
      const upper = orderTimestamp + DAYS_7;
      const matchesDate = monarchTimestamp >= lower && monarchTimestamp <= upper;

      // Check if amounts match
      // Use percentage-based tolerance: 5% or $0.50, whichever is larger
      // This prevents matching $5.65 to $14.48 (would need 155% tolerance!)
      const amountDiff = Math.abs(monarchTransaction.amount - amazonTransaction.amount);
      const baseAmount = Math.max(Math.abs(monarchTransaction.amount), Math.abs(amazonTransaction.amount));
      const percentTolerance = baseAmount * 0.05; // 5% of the larger amount
      const tolerance = Math.max(percentTolerance, 0.5); // At least $0.50, but scales with amount
      const amountsMatch = amountDiff <= tolerance;

      // Log potential matches for debugging
      if (matchesDate && amountsMatch) {
        console.log('🎯 Potential match found:', {
          monarchDate: monarchTransaction.date,
          amazonDate: amazonTransaction.date,
          monarchAmount: monarchTransaction.amount,
          amazonAmount: amazonTransaction.amount,
          amountDiff: amountDiff.toFixed(2),
          daysDiff: Math.floor(Math.abs(monarchTimestamp - orderTimestamp) / (1000 * 60 * 60 * 24)),
        });
      }

      // get the closest transaction by date and amount
      const distance = Math.abs(monarchTimestamp - orderTimestamp);
      if (amountsMatch && matchesDate && (closestDistance === null || distance < closestDistance)) {
        closestAmazon = amazonTransaction;
        closestDistance = distance;
      }
    }

    if (closestAmazon) {
      // Only match if the transaction doesn't have notes
      if (override || !monarchTransaction.notes) {
        monarchAmazonTransactions.push({
          monarch: monarchTransaction,
          amazon: closestAmazon,
        });
      }
      closestAmazon.used = true;
    }
  }

  return monarchAmazonTransactions
    .map(transaction => {
      // Calculate confidence for this match
      const orderForConfidence: Order = {
        id: transaction.amazon.id,
        date: transaction.amazon.date,
        items: transaction.amazon.items,
        transactions: [transaction.amazon],
      };

      const { confidence, reason } = calculateMatchConfidence(orderForConfidence, transaction.monarch);

      return {
        amazon: transaction.amazon,
        items: transaction.amazon.items,
        monarch: transaction.monarch,
        confidence,
        reason,
      };
    })
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0)); // Sort by confidence, highest first
}
