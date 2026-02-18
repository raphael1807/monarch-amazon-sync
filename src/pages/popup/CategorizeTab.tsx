import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'flowbite-react';
import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus, DateRangeOption } from '@root/src/shared/storages/appStorage';
import progressStorage, { ProgressPhase } from '@root/src/shared/storages/progressStorage';
import { Action } from '@root/src/shared/types';
import {
  getTransactions,
  getCategories,
  updateTransactionCategory,
  updateMonarchTransaction,
  getTags,
  createTag,
  setTransactionTags,
  MonarchCategory,
  MonarchTag,
} from '@root/src/shared/api/monarchApi';
import {
  parseItemsFromNotes,
  matchCategoryForItems,
  isUncategorized,
  buildCategoryLookup,
  resolveRuleCategoryId,
  getCategoryDisplayName,
  findSiblingItems,
  parseSplitInvoiceOrderInfo,
} from '@root/src/shared/utils/categoryMatcher';
import { FaSearch, FaCheck, FaExclamationTriangle, FaTag, FaRobot } from 'react-icons/fa';
import { aiCategorizeTransactions } from '@root/src/shared/utils/aiCategorizer';
import CategoryDropdown from './components/CategoryDropdown';

type ScanResult = {
  transactionId: string;
  date: string;
  amount: number;
  notes: string;
  itemTitles: string[];
  currentCategory: string | null;
  suggestedCategory: string;
  suggestedCategoryId: string;
  matchedKeyword: string;
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
};

type UnmatchedResult = {
  transactionId: string;
  date: string;
  amount: number;
  notes: string;
  currentCategory: string | null;
  hasNotes: boolean;
  existingTags: { id: string; name: string }[];
  manualCategoryId: string | null;
};

type ScanStats = {
  total: number;
  categorizable: number;
  alreadyDone: number;
  noMatch: number;
  emptyNotes: number;
};

const NEEDS_CATEGORY_TAG = 'needs-category';
const NEEDS_CATEGORY_NOTE_PREFIX = '⚠️ NEEDS CATEGORY\n';

function getDateRange(
  rangeType: DateRangeOption,
  customStart?: string,
  customEnd?: string,
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  switch (rangeType) {
    case '7days':
      start.setDate(start.getDate() - 7);
      break;
    case '14days':
      start.setDate(start.getDate() - 14);
      break;
    case '30days':
      start.setDate(start.getDate() - 30);
      break;
    case '3months':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6months':
      start.setMonth(start.getMonth() - 6);
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'lastYear':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end.setFullYear(now.getFullYear() - 1, 11, 31);
      break;
    case '2years':
      start.setFullYear(start.getFullYear() - 2);
      break;
    case '3years':
      start.setFullYear(start.getFullYear() - 3);
      break;
    case 'allTime':
      start = new Date(2020, 0, 1);
      break;
    case 'custom':
      if (customStart) start = new Date(customStart);
      if (customEnd) end.setTime(new Date(customEnd).getTime());
      break;
  }

  return { start, end };
}

export default function CategorizeTab() {
  const appData = useStorage(appStorage);

  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [markingUnmatched, setMarkingUnmatched] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedResult[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [categories, setCategories] = useState<MonarchCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState<{ done: number; total: number } | null>(null);
  const [applyComplete, setApplyComplete] = useState(false);
  const [markComplete, setMarkComplete] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeOption>('6months');
  const [skipCategorized, setSkipCategorized] = useState(true);
  const [activeSection, setActiveSection] = useState<'matched' | 'unmatched'>('matched');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null);
  const [aiResults, setAiResults] = useState<
    Map<string, { categoryId: string; categoryName: string; reasoning: string }>
  >(new Map());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const savedDateRange = useRef<{ type: DateRangeOption; start?: string; end?: string } | null>(null);
  const progress = useStorage(progressStorage);

  const monarchConnected = appData.monarchStatus === AuthStatus.Success;
  const amazonConnected = appData.amazonStatus === AuthStatus.Success;
  const hasApiKey = !!appData.options.aiApiKey;

  // Watch for sync completion to auto-re-scan
  useEffect(() => {
    if (syncing && progress.phase === ProgressPhase.Complete) {
      setSyncing(false);
      setSyncMessage('Sync complete! Re-scanning...');

      // Restore original date range
      if (savedDateRange.current) {
        const saved = savedDateRange.current;
        savedDateRange.current = null;
        appStorage.patch({
          options: {
            ...appData.options,
            dateRangeType: saved.type,
            customStartDate: saved.start,
            customEndDate: saved.end,
          },
        });
      }

      // Auto re-scan after a brief delay
      setTimeout(() => {
        setSyncMessage(null);
        handleScan();
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, progress.phase]);

  const handleScan = useCallback(async () => {
    if (!appData.monarchKey) return;

    setScanning(true);
    setError(null);
    setResults([]);
    setUnmatched([]);
    setStats(null);
    setApplyComplete(false);
    setMarkComplete(false);

    try {
      const { start, end } = getDateRange(dateRange, appData.options.customStartDate, appData.options.customEndDate);
      const merchant = appData.options.amazonMerchant || 'Amazon';

      const [fetchedCategories, transactions] = await Promise.all([
        getCategories(appData.monarchKey),
        getTransactions(appData.monarchKey, merchant, start, end),
      ]);

      setCategories(fetchedCategories);
      const categoryLookup = buildCategoryLookup(fetchedCategories);

      const scanResults: ScanResult[] = [];
      const unmatchedResults: UnmatchedResult[] = [];
      let alreadyDone = 0;
      let emptyNotes = 0;

      for (const txn of transactions) {
        const currentCatName = txn.category?.name ?? null;

        if (skipCategorized && !isUncategorized(currentCatName)) {
          alreadyDone++;
          continue;
        }

        let items = parseItemsFromNotes(txn.notes);

        // For split invoices with no items, try to find items from sibling transactions
        if (items.length === 0 && txn.notes && parseSplitInvoiceOrderInfo(txn.notes)) {
          const siblingItems = findSiblingItems(
            txn.notes,
            transactions.map(t => ({ notes: t.notes, date: t.date, amount: t.amount })),
          );
          if (siblingItems.length > 0) {
            items = siblingItems;
          }
        }

        if (items.length === 0) {
          emptyNotes++;
          unmatchedResults.push({
            transactionId: txn.id,
            date: txn.date,
            amount: txn.amount,
            notes: txn.notes || '',
            currentCategory: currentCatName,
            hasNotes: !!txn.notes && txn.notes.length > 0,
            existingTags: txn.tags || [],
            manualCategoryId: null,
          });
          continue;
        }

        const match = matchCategoryForItems(items, appData.options.categoryRules);
        if (!match) {
          unmatchedResults.push({
            transactionId: txn.id,
            date: txn.date,
            amount: txn.amount,
            notes: txn.notes || '',
            currentCategory: currentCatName,
            hasNotes: true,
            existingTags: txn.tags || [],
            manualCategoryId: null,
          });
          continue;
        }

        const categoryId = resolveRuleCategoryId(match.categoryName, categoryLookup);
        if (!categoryId) {
          unmatchedResults.push({
            transactionId: txn.id,
            date: txn.date,
            amount: txn.amount,
            notes: txn.notes || '',
            currentCategory: currentCatName,
            hasNotes: true,
            existingTags: txn.tags || [],
            manualCategoryId: null,
          });
          continue;
        }

        const resolvedCat = fetchedCategories.find(c => c.id === categoryId);
        if (resolvedCat && currentCatName === resolvedCat.name) {
          alreadyDone++;
          continue;
        }

        scanResults.push({
          transactionId: txn.id,
          date: txn.date,
          amount: txn.amount,
          notes: txn.notes || '',
          itemTitles: items.map(i => i.title),
          currentCategory: currentCatName,
          suggestedCategory: match.categoryName,
          suggestedCategoryId: categoryId,
          matchedKeyword: match.matchedKeyword,
          confidence: match.confidence,
          selected: true,
        });
      }

      setResults(scanResults);
      setUnmatched(unmatchedResults);
      setStats({
        total: transactions.length,
        categorizable: scanResults.length,
        alreadyDone,
        noMatch: unmatchedResults.length - emptyNotes,
        emptyNotes,
      });
    } catch (err) {
      console.error('Scan failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan transactions');
    } finally {
      setScanning(false);
    }
  }, [appData.monarchKey, appData.options, dateRange, skipCategorized]);

  const handleApply = useCallback(async () => {
    if (!appData.monarchKey) return;

    const selected = results.filter(r => r.selected);
    if (selected.length === 0) return;

    setApplying(true);
    setApplyProgress({ done: 0, total: selected.length });
    setError(null);

    let done = 0;
    let errors = 0;

    for (const result of selected) {
      try {
        await updateTransactionCategory(appData.monarchKey, result.transactionId, result.suggestedCategoryId);
        done++;
      } catch {
        errors++;
        done++;
      }
      setApplyProgress({ done, total: selected.length });
    }

    setApplying(false);

    if (errors > 0) {
      setError(`Completed with ${errors} error(s). ${done - errors} categorized successfully.`);
    }

    // Remove applied results from the list and switch to unmatched tab if there are any
    setResults(prev => prev.filter(r => !r.selected));
    if (unmatched.length > 0) {
      setActiveSection('unmatched');
    } else {
      setApplyComplete(true);
    }
  }, [appData.monarchKey, results, unmatched.length]);

  const handleApplyManual = useCallback(async () => {
    if (!appData.monarchKey) return;

    const withManual = unmatched.filter(u => u.manualCategoryId);
    if (withManual.length === 0) return;

    setApplying(true);
    setApplyProgress({ done: 0, total: withManual.length });

    let done = 0;
    for (const item of withManual) {
      try {
        await updateTransactionCategory(appData.monarchKey, item.transactionId, item.manualCategoryId!);
        done++;
      } catch {
        done++;
      }
      setApplyProgress({ done, total: withManual.length });
    }

    setApplying(false);
    setApplyComplete(true);
  }, [appData.monarchKey, unmatched]);

  const handleMarkUnmatched = useCallback(async () => {
    if (!appData.monarchKey) return;

    const toMark = unmatched.filter(u => !u.manualCategoryId);
    if (toMark.length === 0) return;

    setMarkingUnmatched(true);
    setError(null);

    try {
      // Find or create the "needs-category" tag
      const existingTags: MonarchTag[] = await getTags(appData.monarchKey);
      let tag = existingTags.find(t => t.name === NEEDS_CATEGORY_TAG);
      if (!tag) {
        tag = await createTag(appData.monarchKey, NEEDS_CATEGORY_TAG, '#FF6B6B');
      }

      for (const item of toMark) {
        try {
          const existingTagIds = item.existingTags.map(t => t.id);
          if (!existingTagIds.includes(tag.id)) {
            await setTransactionTags(appData.monarchKey, item.transactionId, [...existingTagIds, tag.id]);
          }

          if (item.notes && !item.notes.startsWith(NEEDS_CATEGORY_NOTE_PREFIX)) {
            const newNotes = NEEDS_CATEGORY_NOTE_PREFIX + item.notes;
            await updateMonarchTransaction(appData.monarchKey, item.transactionId, newNotes);
          } else if (!item.notes) {
            await updateMonarchTransaction(appData.monarchKey, item.transactionId, NEEDS_CATEGORY_NOTE_PREFIX.trim());
          }
        } catch (err) {
          console.error(`Failed to mark ${item.transactionId}:`, err);
        }
      }

      setMarkComplete(true);
      setMarkingUnmatched(false);
    } catch (err) {
      console.error('Mark unmatched failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark unmatched transactions');
      setMarkingUnmatched(false);
    }
  }, [appData.monarchKey, unmatched]);

  const handleSyncMissing = useCallback(async () => {
    const emptyNotes = unmatched.filter(u => !u.hasNotes);
    if (emptyNotes.length === 0 || !amazonConnected) return;

    // Find the date range covering all empty-notes transactions
    const dates = emptyNotes.map(u => new Date(u.date).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    minDate.setDate(minDate.getDate() - 14);
    maxDate.setDate(maxDate.getDate() + 7);

    const startStr = minDate.toISOString().split('T')[0];
    const endStr = maxDate.toISOString().split('T')[0];

    // Save current date range to restore later
    savedDateRange.current = {
      type: appData.options.dateRangeType || '14days',
      start: appData.options.customStartDate,
      end: appData.options.customEndDate,
    };

    // Set custom date range and trigger sync
    await appStorage.patch({
      options: {
        ...appData.options,
        dateRangeType: 'custom',
        customStartDate: startStr,
        customEndDate: endStr,
        overrideTransactions: true,
      },
    });

    setSyncing(true);
    setSyncMessage(`Syncing ${emptyNotes.length} transactions (${startStr} to ${endStr})...`);

    chrome.runtime.sendMessage({
      action: Action.FullSync,
      payload: {},
    });
  }, [unmatched, amazonConnected, appData.options]);

  const handleAICategorize = useCallback(async () => {
    if (!appData.options.aiApiKey || unmatched.length === 0) return;

    setAiRunning(true);
    setAiProgress({ done: 0, total: unmatched.length });
    setError(null);

    try {
      // Only send transactions that have notes (skip empty ones -- AI can't help without data)
      const withNotes = unmatched.filter(u => u.hasNotes && u.notes.length > 10);
      if (withNotes.length === 0) {
        setError('No transactions with item details to send to AI. Sync them first via the Sync tab.');
        setAiRunning(false);
        return;
      }

      const inputs = withNotes.map(u => ({
        transactionId: u.transactionId,
        itemDescription: u.notes.substring(0, 500),
        amount: u.amount,
        date: u.date,
      }));

      const aiData = await aiCategorizeTransactions(appData.options.aiApiKey, inputs, categories, (done, total) =>
        setAiProgress({ done, total }),
      );

      const newMap = new Map(aiResults);
      for (const result of aiData) {
        newMap.set(result.transactionId, {
          categoryId: result.suggestedCategoryId,
          categoryName: result.suggestedCategory,
          reasoning: result.reasoning,
        });
      }
      setAiResults(newMap);

      // Auto-fill manual category for AI results
      setUnmatched(prev =>
        prev.map(u => {
          const ai = newMap.get(u.transactionId);
          if (ai && !u.manualCategoryId) {
            return { ...u, manualCategoryId: ai.categoryId };
          }
          return u;
        }),
      );
    } catch (err) {
      console.error('AI categorize failed:', err);
      setError(err instanceof Error ? err.message : 'AI categorization failed');
    } finally {
      setAiRunning(false);
      setAiProgress(null);
    }
  }, [appData.options.aiApiKey, unmatched, categories, aiResults]);

  const toggleResult = (index: number) => {
    setResults(prev => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  };

  const overrideResultCategory = (index: number, categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    setResults(prev =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              suggestedCategoryId: categoryId,
              suggestedCategory: getCategoryDisplayName(cat),
              confidence: 'high' as const,
            }
          : r,
      ),
    );
  };

  const toggleAll = (selected: boolean) => {
    setResults(prev => prev.map(r => ({ ...r, selected })));
  };

  const setManualCategory = (index: number, categoryId: string | null) => {
    setUnmatched(prev => prev.map((u, i) => (i === index ? { ...u, manualCategoryId: categoryId } : u)));
  };

  const selectedCount = results.filter(r => r.selected).length;
  const manualCount = unmatched.filter(u => u.manualCategoryId).length;

  const confidenceColor = (c: 'high' | 'medium' | 'low') => {
    switch (c) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-orange-100 text-orange-800';
    }
  };

  const notePreview = (notes: string) => {
    if (!notes) return 'No notes';
    const first = notes
      .split('\n')
      .find(l => l.trim().length > 0 && !l.startsWith('✅') && !l.startsWith('⚠️') && !l.startsWith('🔄'));
    return first?.substring(0, 60) || notes.substring(0, 60);
  };

  if (!monarchConnected) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Monarch Not Connected</p>
              <p className="text-xs text-yellow-700 mt-1">Please connect to Monarch Money first from the Home tab.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Auto-Categorize</h2>
        <p className="text-xs text-gray-500 mt-1">
          Scan Amazon transactions and assign categories based on item descriptions.
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center">
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value as DateRangeOption)}
          title="Date range"
          aria-label="Date range"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="7days">Last 7 days</option>
          <option value="14days">Last 14 days</option>
          <option value="30days">Last 30 days</option>
          <option value="3months">Last 3 months</option>
          <option value="6months">Last 6 months</option>
          <option value="thisYear">This year ({new Date().getFullYear()})</option>
          <option value="lastYear">Last year ({new Date().getFullYear() - 1})</option>
          <option value="2years">Last 2 years</option>
          <option value="3years">Last 3 years</option>
          <option value="allTime">All time (since 2020)</option>
        </select>
        <Button
          color="blue"
          size="sm"
          onClick={handleScan}
          disabled={scanning || applying}
          className="whitespace-nowrap">
          {scanning ? (
            <>
              <span className="animate-spin mr-2">⏳</span> Scanning...
            </>
          ) : (
            <>
              <FaSearch className="mr-2" /> Scan
            </>
          )}
        </Button>
      </div>

      {/* Skip toggle */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-700">Skip already categorized</span>
        <button
          type="button"
          role="switch"
          aria-checked={skipCategorized ? 'true' : 'false'}
          aria-label="Skip already categorized"
          title="Skip already categorized"
          onClick={() => setSkipCategorized(!skipCategorized)}
          className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            skipCategorized ? 'bg-green-500' : 'bg-gray-300'
          }`}>
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
              skipCategorized ? 'translate-x-4' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-medium">
            {stats.total} scanned &bull; {stats.categorizable} auto-matched &bull; {stats.alreadyDone} already done
            {stats.noMatch > 0 && <> &bull; {stats.noMatch} no keyword match</>}
            {stats.emptyNotes > 0 && <> &bull; {stats.emptyNotes} empty notes</>}
          </p>
        </div>
      )}

      {/* Success messages */}
      {applyComplete && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <FaCheck className="text-green-600" />
          <p className="text-xs text-green-800 font-medium">Categories applied successfully!</p>
        </div>
      )}
      {markComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <FaTag className="text-green-600" />
          <p className="text-xs text-green-800 font-medium">
            Unmatched transactions tagged with &quot;{NEEDS_CATEGORY_TAG}&quot; and marked in notes!
          </p>
        </div>
      )}

      {/* Section Tabs */}
      {stats && (results.length > 0 || unmatched.length > 0) && !applyComplete && (
        <>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveSection('matched')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'matched' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              ⚡ Keywords ({results.length})
            </button>
            <button
              onClick={() => setActiveSection('unmatched')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeSection === 'unmatched' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              🤖 AI / Manual ({unmatched.length})
            </button>
          </div>
          <div className="flex gap-3 text-xs text-gray-400 px-1">
            <span>⚡ = keyword match</span>
            <span>🤖 = AI suggestion</span>
            <span>✋ = manual pick</span>
          </div>
        </>
      )}

      {/* MATCHED SECTION */}
      {activeSection === 'matched' && results.length > 0 && !applyComplete && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {selectedCount} of {results.length} selected
            </span>
            <div className="flex gap-2">
              <button onClick={() => toggleAll(true)} className="text-blue-600 hover:underline">
                Select all
              </button>
              <button onClick={() => toggleAll(false)} className="text-blue-600 hover:underline">
                Clear all
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={result.transactionId}
                className={`border rounded-lg p-3 transition-colors ${
                  result.selected ? 'border-blue-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={result.selected}
                    onChange={() => toggleResult(index)}
                    title={`Select ${result.itemTitles[0]}`}
                    aria-label={`Select ${result.itemTitles[0]}`}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.itemTitles[0]}
                      {result.itemTitles.length > 1 && (
                        <span className="text-gray-400 font-normal"> +{result.itemTitles.length - 1}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(result.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      &bull; ${Math.abs(result.amount).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">
                        {result.currentCategory || 'uncategorized'}
                      </span>
                      <span className="text-gray-400 text-xs">&rarr;</span>
                      <span className="text-xs">⚡</span>
                      <CategoryDropdown
                        categories={categories}
                        value={result.suggestedCategoryId}
                        onChange={id => id && overrideResultCategory(index, id)}
                        className={confidenceColor(result.confidence)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-200">
            {applyProgress && applying ? (
              <div className="space-y-2">
                <progress
                  className="w-full h-2 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-green-500"
                  value={applyProgress.done}
                  max={applyProgress.total}
                />
                <p className="text-xs text-center text-gray-600">
                  Applying {applyProgress.done}/{applyProgress.total}...
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  color="success"
                  size="sm"
                  onClick={handleApply}
                  disabled={selectedCount === 0 || applying}
                  className="flex-1">
                  <FaCheck className="mr-2" /> Apply {selectedCount} {selectedCount === 1 ? 'Category' : 'Categories'}
                </Button>
                <button
                  onClick={() => {
                    setResults([]);
                    setUnmatched([]);
                    setStats(null);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* UNMATCHED SECTION */}
      {activeSection === 'unmatched' && unmatched.length > 0 && !applyComplete && (
        <>
          <p className="text-xs text-gray-500">
            These transactions couldn&apos;t be auto-categorized. Use AI, pick manually, or mark for later.
          </p>

          {/* AI Categorize Button */}
          {hasApiKey && aiResults.size === 0 && (
            <Button
              color="purple"
              size="sm"
              onClick={handleAICategorize}
              disabled={aiRunning || unmatched.length === 0}
              className="w-full">
              {aiRunning ? (
                <>
                  <span className="animate-spin mr-2">⏳</span> AI analyzing {aiProgress?.done || 0}/
                  {aiProgress?.total || unmatched.length}...
                </>
              ) : (
                <>
                  <FaRobot className="mr-2" /> AI Categorize{' '}
                  {unmatched.filter(u => u.hasNotes && u.notes.length > 10).length} transactions
                </>
              )}
            </Button>
          )}
          {unmatched.some(u => !u.hasNotes) && !syncing && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 space-y-2">
              <p className="text-xs text-orange-700">
                {unmatched.filter(u => !u.hasNotes).length} transaction(s) have no item details.
              </p>
              {amazonConnected ? (
                <Button color="warning" size="xs" onClick={handleSyncMissing} className="w-full">
                  🔄 Auto-sync {unmatched.filter(u => !u.hasNotes).length} missing transactions
                </Button>
              ) : (
                <p className="text-xs text-orange-600">Connect to Amazon first (Home tab) to sync missing data.</p>
              )}
            </div>
          )}
          {syncing && syncMessage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs text-blue-700 font-medium">
                <span className="animate-pulse">🔄</span> {syncMessage}
              </p>
              {progress.phase !== ProgressPhase.Idle && progress.phase !== ProgressPhase.Complete && (
                <p className="text-xs text-blue-600 mt-1">
                  {progress.phase === ProgressPhase.AmazonPageScan && 'Scanning Amazon pages...'}
                  {progress.phase === ProgressPhase.AmazonOrderDownload &&
                    `Downloading orders: ${progress.complete}/${progress.total}`}
                  {progress.phase === ProgressPhase.MonarchDownload && 'Fetching Monarch transactions...'}
                  {progress.phase === ProgressPhase.MonarchUpload && `Updating: ${progress.complete}/${progress.total}`}
                </p>
              )}
            </div>
          )}
          {!hasApiKey && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
              <p className="text-xs text-purple-700">
                💡 Add an Anthropic API key in Settings to use Claude AI for unmatched transactions.
              </p>
            </div>
          )}
          {aiResults.size > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 flex items-center gap-2">
              <FaRobot className="text-purple-600" />
              <p className="text-xs text-purple-800 font-medium">
                AI suggested categories for {aiResults.size} transactions. Review below and apply.
              </p>
            </div>
          )}

          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {unmatched.map((item, index) => (
              <div
                key={item.transactionId}
                className={`border rounded-lg p-3 ${
                  aiResults.has(item.transactionId) ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
                }`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 truncate font-medium">
                    {item.hasNotes ? notePreview(item.notes) : '(no item details)'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    &bull; ${Math.abs(item.amount).toFixed(2)}
                    {!item.hasNotes && <span className="ml-1 text-orange-500">&bull; needs sync first</span>}
                  </p>
                  {aiResults.has(item.transactionId) && (
                    <p className="text-xs text-purple-700 mt-1">
                      <FaRobot className="inline mr-1" />
                      AI: {aiResults.get(item.transactionId)!.reasoning}
                    </p>
                  )}
                  <CategoryDropdown
                    categories={categories}
                    value={item.manualCategoryId}
                    onChange={id => setManualCategory(index, id)}
                    className={`mt-2 ${aiResults.has(item.transactionId) ? 'border-purple-300' : ''}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-200 space-y-2">
            {manualCount > 0 && (
              <Button color="success" size="sm" onClick={handleApplyManual} disabled={applying} className="w-full">
                <FaCheck className="mr-2" /> Apply {manualCount} Manual {manualCount === 1 ? 'Category' : 'Categories'}
              </Button>
            )}
            <Button
              color="light"
              size="sm"
              onClick={handleMarkUnmatched}
              disabled={markingUnmatched || markComplete}
              className="w-full">
              <FaTag className="mr-2" />
              {markingUnmatched
                ? 'Marking...'
                : markComplete
                  ? 'Marked!'
                  : `Tag ${unmatched.length - manualCount} as "${NEEDS_CATEGORY_TAG}"`}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Adds a &quot;{NEEDS_CATEGORY_TAG}&quot; tag + &quot;⚠️ NEEDS CATEGORY&quot; note prefix so you can filter
              them in Monarch.
            </p>
          </div>
        </>
      )}

      {/* Empty matched state */}
      {activeSection === 'matched' && stats && results.length === 0 && !applyComplete && (
        <div className="text-center py-6">
          <p className="text-gray-400 text-2xl mb-2">✅</p>
          <p className="text-sm text-gray-600 font-medium">No auto-matches found</p>
          <p className="text-xs text-gray-400 mt-1">
            {unmatched.length > 0
              ? `Check the Unmatched tab (${unmatched.length} transactions) to categorize manually.`
              : 'Try a wider date range or sync some transactions first.'}
          </p>
        </div>
      )}

      {/* Initial state */}
      {!stats && !scanning && (
        <div className="text-center py-6">
          <p className="text-gray-400 text-3xl mb-2">🏷️</p>
          <p className="text-sm text-gray-600">Select a date range and scan to find transactions to categorize.</p>
          <p className="text-xs text-gray-400 mt-1">
            Works best on transactions that have already been synced with item details.
          </p>
        </div>
      )}
    </div>
  );
}
