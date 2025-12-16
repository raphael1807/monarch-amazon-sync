import { useState } from 'react';
import { FaChevronDown, FaChevronUp, FaAmazon, FaWallet } from 'react-icons/fa';
import type { Order } from '@root/src/shared/api/amazonApi';
import type { MonarchTransaction } from '@root/src/shared/api/monarchApi';

interface UnmatchedProps {
  unmatchedAmazon: Order[];
  unmatchedMonarch: MonarchTransaction[];
}

export function UnmatchedTransactions({ unmatchedAmazon, unmatchedMonarch }: UnmatchedProps) {
  const [expandedAmazon, setExpandedAmazon] = useState(false);
  const [expandedMonarch, setExpandedMonarch] = useState(false);

  const totalUnmatched = unmatchedAmazon.length + unmatchedMonarch.length;

  if (totalUnmatched === 0) {
    return (
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
        <p className="text-sm font-medium text-green-800">✓ Perfect! All transactions matched</p>
        <p className="text-xs text-green-600 mt-1">No unmatched items found</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm font-medium text-yellow-800 text-center">
          ⚠️ {totalUnmatched} Unmatched Transaction{totalUnmatched > 1 ? 's' : ''}
        </p>
      </div>

      {/* Unmatched Amazon Orders */}
      {unmatchedAmazon.length > 0 && (
        <div className="border border-orange-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedAmazon(!expandedAmazon)}
            className="w-full px-4 py-3 bg-orange-50 flex items-center justify-between hover:bg-orange-100 transition-colors">
            <div className="flex items-center gap-2">
              <FaAmazon className="text-orange-600" />
              <span className="text-sm font-semibold text-orange-900">
                {unmatchedAmazon.length} Amazon Order{unmatchedAmazon.length > 1 ? 's' : ''} (No Monarch Match)
              </span>
            </div>
            {expandedAmazon ? (
              <FaChevronUp className="text-orange-600" />
            ) : (
              <FaChevronDown className="text-orange-600" />
            )}
          </button>

          {expandedAmazon && (
            <div className="max-h-60 overflow-y-auto">
              {unmatchedAmazon.map((order, idx) => (
                <UnmatchedAmazonItem key={order.id} order={order} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unmatched Monarch Transactions */}
      {unmatchedMonarch.length > 0 && (
        <div className="border border-purple-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedMonarch(!expandedMonarch)}
            className="w-full px-4 py-3 bg-purple-50 flex items-center justify-between hover:bg-purple-100 transition-colors">
            <div className="flex items-center gap-2">
              <FaWallet className="text-purple-600" />
              <span className="text-sm font-semibold text-purple-900">
                {unmatchedMonarch.length} Monarch Transaction{unmatchedMonarch.length > 1 ? 's' : ''} (No Amazon Match)
              </span>
            </div>
            {expandedMonarch ? (
              <FaChevronUp className="text-purple-600" />
            ) : (
              <FaChevronDown className="text-purple-600" />
            )}
          </button>

          {expandedMonarch && (
            <div className="max-h-60 overflow-y-auto">
              {unmatchedMonarch.map((txn, idx) => (
                <UnmatchedMonarchItem key={txn.id} transaction={txn} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-2 bg-gray-50 rounded text-center">
        <p className="text-xs text-gray-600">💡 Tip: Check dates and amounts - you may need to manually match these</p>
      </div>
    </div>
  );
}

function UnmatchedAmazonItem({ order, index }: { order: Order; index: number }) {
  const firstItem = order.items[0]?.title || 'No items';
  const amount = order.transactions[0]?.amount || 0;

  return (
    <div className="p-3 border-b border-orange-100 hover:bg-orange-50/50">
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-semibold text-orange-900">#{index + 1}</span>
        <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded">
          ${Math.abs(amount).toFixed(2)}
        </span>
      </div>
      <div className="text-xs text-gray-700 mb-1">
        {order.date} • Order {order.id}
      </div>
      <div className="text-xs text-gray-600 mb-2">
        {firstItem.substring(0, 60)}
        {firstItem.length > 60 && '...'}
        {order.items.length > 1 && ` +${order.items.length - 1} more`}
      </div>
      {order.invoiceUrls && order.invoiceUrls.length > 0 && (
        <div className="text-xs">
          <a
            href={order.invoiceUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline">
            📄 View Invoice
          </a>
          {order.invoiceUrls.length > 1 && (
            <span className="text-gray-500 ml-1">+{order.invoiceUrls.length - 1} more</span>
          )}
        </div>
      )}
      <div className="mt-2 text-xs text-yellow-700 italic">
        Reason: No Monarch transaction found within ±7 days with matching amount
      </div>
    </div>
  );
}

function UnmatchedMonarchItem({ transaction, index }: { transaction: MonarchTransaction; index: number }) {
  return (
    <div className="p-3 border-b border-purple-100 hover:bg-purple-50/50">
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-semibold text-purple-900">#{index + 1}</span>
        <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded">
          ${Math.abs(transaction.amount).toFixed(2)}
        </span>
      </div>
      <div className="text-xs text-gray-700 mb-1">
        {transaction.date} • {transaction.id}
      </div>
      {transaction.notes && (
        <div className="text-xs text-gray-600 mb-2">
          Current note: {transaction.notes.substring(0, 60)}
          {transaction.notes.length > 60 && '...'}
        </div>
      )}
      <div className="mt-2 text-xs text-yellow-700 italic">
        Reason: No Amazon order found with matching amount and date
      </div>
    </div>
  );
}

export default UnmatchedTransactions;
