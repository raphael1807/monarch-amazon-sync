import { useState } from 'react';
import { Button } from 'flowbite-react';
import { FaChevronDown, FaChevronUp, FaDownload } from 'react-icons/fa';

interface MatchPreviewProps {
  matches: Array<{
    amazon: { id: string; date: string; amount: number; refund: boolean };
    monarch: { id: string; date: string; amount: number };
    items: Array<{ quantity: number; title: string; price: number }>;
    confidence?: number;
  }>;
  onDownloadCsv: () => void;
}

export function MatchPreview({ matches, onDownloadCsv }: MatchPreviewProps) {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const [showAll, setShowAll] = useState(false);

  const displayMatches = showAll ? matches : matches.slice(0, 5);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getConfidenceColor = (confidence: number = 100) => {
    if (confidence >= 95) return 'text-green-600 bg-green-50';
    if (confidence >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  const getConfidenceBadge = (confidence: number = 100) => {
    if (confidence >= 95) return '✓ Exact';
    if (confidence >= 85) return '~ Close';
    return '? Review';
  };

  return (
    <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
      <div className="sticky top-0 bg-white p-3 border-b-2 border-gray-200 z-10">
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg">
            {matches.length} Match{matches.length !== 1 ? 'es' : ''} Found
          </span>
          <Button size="sm" color="success" onClick={onDownloadCsv}>
            <FaDownload className="mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="space-y-2 px-2">
        {displayMatches.map((match, index) => {
          const isExpanded = expanded[match.amazon.id];
          const confidence = match.confidence || 100;

          return (
            <div key={match.amazon.id} className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
              {/* Match Header */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-700">#{index + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getConfidenceColor(confidence)}`}>
                      {getConfidenceBadge(confidence)} {confidence}%
                    </span>
                    {match.amazon.refund && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Refund</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {match.amazon.date} • ${match.amazon.amount.toFixed(2)}
                  </div>
                </div>
                <button onClick={() => toggleExpand(match.amazon.id)} className="text-gray-400 hover:text-gray-600 p-1">
                  {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {/* Items Preview (always visible) */}
              <div className="text-xs text-gray-500 mb-2">
                {match.items.length} item{match.items.length !== 1 ? 's' : ''}: {match.items[0]?.title.substring(0, 50)}
                {match.items.length > 1 && ` + ${match.items.length - 1} more`}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t pt-2 mt-2 space-y-2">
                  {/* Amazon Details */}
                  <div className="bg-orange-50 p-2 rounded">
                    <div className="text-xs font-semibold text-orange-800 mb-1">📦 Amazon Order</div>
                    <div className="text-xs text-gray-700">
                      <div>ID: {match.amazon.id}</div>
                      <div>Date: {match.amazon.date}</div>
                      <div>Amount: ${match.amazon.amount.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-blue-50 p-2 rounded">
                    <div className="text-xs font-semibold text-blue-800 mb-1">🛍️ Items ({match.items.length})</div>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {match.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span className="flex-1">
                            {item.quantity}x {item.title.substring(0, 60)}
                            {item.title.length > 60 && '...'}
                          </span>
                          <span className="font-medium ml-2">${item.price.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Monarch Details */}
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="text-xs font-semibold text-purple-800 mb-1">💳 Monarch Transaction</div>
                    <div className="text-xs text-gray-700">
                      <div>ID: {match.monarch.id}</div>
                      <div>Date: {match.monarch.date}</div>
                      <div>Amount: ${match.monarch.amount.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Match Explanation */}
                  {confidence < 100 && (
                    <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                      <div className="text-xs font-semibold text-yellow-800 mb-1">ℹ️ Match Details</div>
                      <div className="text-xs text-gray-700">
                        {Math.abs(match.amazon.amount - match.monarch.amount) < 0.5
                          ? '✓ Amount matches exactly'
                          : `Amount difference: $${Math.abs(match.amazon.amount - match.monarch.amount).toFixed(2)}`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show More Button */}
      {matches.length > 5 && (
        <div className="flex justify-center p-2">
          <Button size="sm" color="light" onClick={() => setShowAll(!showAll)}>
            {showAll ? (
              <>
                <FaChevronUp className="mr-2" />
                Show Less
              </>
            ) : (
              <>
                <FaChevronDown className="mr-2" />
                Show All {matches.length} Matches
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default MatchPreview;
