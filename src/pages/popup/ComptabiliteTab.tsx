import { useCallback, useEffect, useState } from 'react';
import { Button } from 'flowbite-react';
import useStorage from '@root/src/shared/hooks/useStorage';
import appStorage, { AuthStatus } from '@root/src/shared/storages/appStorage';
import {
  getTransactionsByTag,
  getTransactionsByCategoryIds,
  getCategories,
  getTags,
  setTransactionTags,
  updateMonarchTransaction,
  updateTransactionCategory,
  createTag,
  getAccounts,
  MonarchTag,
  MonarchTransaction,
  MonarchCategory,
} from '@root/src/shared/api/monarchApi';
import {
  analyzeTransactionsForBills,
  formatBillNote,
  findTagByName,
  removeTagFromList,
  swapTag,
} from '@root/src/shared/utils/billProcessor';
import { transactionToExpenseRow, transactionToRevenueRow } from '@root/src/shared/utils/sheetsExporter';
import { postToGoogleSheet } from '@root/src/shared/api/googleSheetsApi';
import { addSnapshot, getLatestSnapshot, type Snapshot } from '@root/src/shared/storages/snapshotStorage';
import { findMerchantCategory } from '@root/src/shared/utils/merchantRules';
import {
  isUncategorized,
  matchCategoryForItems,
  parseItemsFromNotes,
  buildCategoryLookup,
} from '@root/src/shared/utils/categoryMatcher';
import { runAutoTagger, type AutoTagResult } from '@root/src/shared/utils/autoTagger';
import { buildMerchantTaxMap, applyLearnedTaxRates } from '@root/src/shared/utils/taxRateLearner';
import {
  calculateQuarterlyTax,
  type QuarterSummary,
  type TaxableItem,
} from '@root/src/shared/utils/quarterlyTaxCalculator';
import { Action } from '@root/src/shared/types';
import {
  FaPlay,
  FaCheck,
  FaSpinner,
  FaCog,
  FaFileInvoiceDollar,
  FaFileExport,
  FaChurch,
  FaChartLine,
  FaDownload,
  FaSync,
  FaTags,
  FaSearch,
} from 'react-icons/fa';

type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'review' | 'skipped';

type StepState = {
  status: StepStatus;
  message: string;
  count: number;
};

type PipelineState = {
  amazonSync: StepState;
  autoCategorize: StepState;
  autoTag: StepState;
  bills: StepState;
  expenses: StepState;
  revenues: StepState;
  dime: StepState & { grossRevenue?: number; dimeAmount?: number; dimeGiven?: number };
  snapshots: StepState & { current?: Snapshot; previous?: Snapshot };
  backup: StepState;
  quarterly: StepState & { quarters?: QuarterSummary[] };
};

const INITIAL_STEP: StepState = { status: 'idle', message: '', count: 0 };

const TAG_NAMES = {
  ADD_BILL: '🧾 add bill',
  EXPENSE_RAPHA_TO_ADD: '[-] rapha, expenses; to add',
  EXPENSE_RAPHA_ADDED: '[-] rapha, expenses; added',
  EXPENSE_FARMZZ_TO_ADD: '[-] farmzz, expenses; to add',
  EXPENSE_FARMZZ_ADDED: '[-] farmzz, expenses; added',
  REVENUE_TO_ADD: '[+] rapha, revenue; to add',
  REVENUE_ADDED: '[+] rapha, revenue; added',
} as const;

const INITIAL_PIPELINE: PipelineState = {
  amazonSync: { ...INITIAL_STEP },
  autoCategorize: { ...INITIAL_STEP },
  autoTag: { ...INITIAL_STEP },
  bills: { ...INITIAL_STEP },
  expenses: { ...INITIAL_STEP },
  revenues: { ...INITIAL_STEP },
  dime: { ...INITIAL_STEP },
  snapshots: { ...INITIAL_STEP },
  backup: { ...INITIAL_STEP },
  quarterly: { ...INITIAL_STEP },
};

function ComptabiliteTab() {
  const storage = useStorage(appStorage);
  const [pipeline, setPipeline] = useState<PipelineState>({ ...INITIAL_PIPELINE });
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [allTags, setAllTags] = useState<MonarchTag[]>([]);
  const [allCategories, setAllCategories] = useState<MonarchCategory[]>([]);
  const [settingsForm, setSettingsForm] = useState({
    googleScriptUrl: storage.options.googleScriptUrl ?? '',
    expenseSheetTab: storage.options.expenseSheetTab ?? "expenses '25 [-]",
    revenueSheetTab: storage.options.revenueSheetTab ?? "income '25 [+]",
    dimePercentage: storage.options.dimePercentage ?? 10,
  });

  useEffect(() => {
    setSettingsForm({
      googleScriptUrl: storage.options.googleScriptUrl ?? '',
      expenseSheetTab: storage.options.expenseSheetTab ?? "expenses '25 [-]",
      revenueSheetTab: storage.options.revenueSheetTab ?? "income '25 [+]",
      dimePercentage: storage.options.dimePercentage ?? 10,
    });
  }, [
    storage.options.googleScriptUrl,
    storage.options.expenseSheetTab,
    storage.options.revenueSheetTab,
    storage.options.dimePercentage,
  ]);

  const updateStep = useCallback((step: keyof PipelineState, update: Partial<StepState>) => {
    setPipeline(prev => ({ ...prev, [step]: { ...prev[step], ...update } }));
  }, []);

  const authKey = storage.monarchKey;
  const isConnected = storage.monarchStatus === AuthStatus.Success && !!authKey;

  const saveSettings = useCallback(async () => {
    await appStorage.patch({
      options: {
        ...storage.options,
        googleScriptUrl: settingsForm.googleScriptUrl,
        expenseSheetTab: settingsForm.expenseSheetTab,
        revenueSheetTab: settingsForm.revenueSheetTab,
        dimePercentage: settingsForm.dimePercentage,
      },
    });
    setShowSettings(false);
  }, [storage.options, settingsForm]);

  // --- Step 0: Amazon Sync ---
  const runAmazonSync = useCallback(async () => {
    updateStep('amazonSync', { status: 'running', message: 'Triggering Amazon sync...' });
    try {
      chrome.runtime.sendMessage({ action: Action.FullSync });
      updateStep('amazonSync', { status: 'done', message: 'Sync triggered (runs in background)', count: 1 });
    } catch (err) {
      updateStep('amazonSync', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [updateStep]);

  // --- Step 1: Auto-Categorize ---
  const runAutoCategorize = useCallback(async () => {
    if (!authKey) return;
    updateStep('autoCategorize', { status: 'running', message: 'Fetching categories...' });

    try {
      const categories = allCategories.length > 0 ? allCategories : await getCategories(authKey);
      if (allCategories.length === 0) setAllCategories(categories);
      const catLookup = buildCategoryLookup(categories);

      const uncatIds = categories.filter(c => isUncategorized(`${c.name} [${c.group?.name ?? ''}]`)).map(c => c.id);
      if (uncatIds.length === 0) {
        updateStep('autoCategorize', { status: 'done', message: 'No uncategorized categories found', count: 0 });
        return;
      }

      updateStep('autoCategorize', { message: 'Scanning uncategorized transactions...' });
      const txns = await getTransactionsByCategoryIds(authKey, uncatIds);

      let categorized = 0;
      for (const tx of txns) {
        const extended = tx as MonarchTransaction & { originalMerchant?: { name: string } };
        const merchantName = extended.originalMerchant?.name ?? '';

        let targetCategory = findMerchantCategory(merchantName);

        if (!targetCategory && tx.notes) {
          const items = parseItemsFromNotes(tx.notes);
          const match = matchCategoryForItems(items, storage.options.categoryRules);
          if (match) targetCategory = match.categoryName;
        }

        if (targetCategory) {
          const catEntry = catLookup.get(targetCategory.toLowerCase());
          if (catEntry) {
            await updateTransactionCategory(authKey, tx.id, catEntry.id);
            categorized++;
          }
        }
      }

      updateStep('autoCategorize', {
        status: 'done',
        message: `${categorized}/${txns.length} categorized`,
        count: categorized,
      });
    } catch (err) {
      updateStep('autoCategorize', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, allCategories, storage.options.categoryRules, updateStep]);

  // --- Step 1.5: Auto-Tag ---
  const runAutoTag = useCallback(async () => {
    if (!authKey) return;
    updateStep('autoTag', { status: 'running', message: 'Loading tags & categories...' });

    try {
      const tags = allTags.length > 0 ? allTags : await getTags(authKey);
      if (allTags.length === 0) setAllTags(tags);
      const categories = allCategories.length > 0 ? allCategories : await getCategories(authKey);
      if (allCategories.length === 0) setAllCategories(categories);

      const tagCache = new Map<string, MonarchTag>();
      tags.forEach(t => tagCache.set(t.name, t));

      const findOrCreate = async (name: string): Promise<MonarchTag> => {
        const existing = tagCache.get(name);
        if (existing) return existing;
        const created = await createTag(authKey, name, '#6B7280');
        tagCache.set(name, created);
        return created;
      };

      updateStep('autoTag', { message: 'Auto-tagging expenses, revenues, insurance, bills...' });
      const result: AutoTagResult = await runAutoTagger(
        authKey,
        tags,
        categories,
        getTransactionsByCategoryIds,
        setTransactionTags,
        findOrCreate,
      );

      // Also apply learned tax rates
      updateStep('autoTag', { message: 'Learning tax rates from history...' });
      const businessCatIds = categories
        .filter(c => ['rapha_business', 'farmzz'].includes(c.group?.name ?? ''))
        .map(c => c.id);
      if (businessCatIds.length > 0) {
        const allBusinessTxns = await getTransactionsByCategoryIds(authKey, businessCatIds);
        const merchantTaxMap = buildMerchantTaxMap(allBusinessTxns as never[]);
        const taxResult = await applyLearnedTaxRates(
          authKey,
          allBusinessTxns as never[],
          merchantTaxMap,
          findOrCreate,
          setTransactionTags,
        );
        const totalTagged =
          result.expensesTagged +
          result.revenuesTagged +
          result.insuranceTagged +
          result.billsTagged +
          taxResult.applied;
        updateStep('autoTag', {
          status: 'done',
          message: `${result.expensesTagged} expenses, ${result.revenuesTagged} revenues, ${result.insuranceTagged} insurance, ${taxResult.applied} tax rates, ${result.billsTagged} bills`,
          count: totalTagged,
        });
      } else {
        const totalTagged = result.expensesTagged + result.revenuesTagged + result.insuranceTagged + result.billsTagged;
        updateStep('autoTag', {
          status: 'done',
          message: `${result.expensesTagged} exp, ${result.revenuesTagged} rev, ${result.insuranceTagged} ins, ${result.billsTagged} bills`,
          count: totalTagged,
        });
      }
    } catch (err) {
      updateStep('autoTag', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, allTags, allCategories, updateStep]);

  // --- Step 2: Bills Processor ---
  const runBills = useCallback(async () => {
    if (!authKey) return;
    updateStep('bills', { status: 'running', message: 'Fetching tags...' });

    try {
      const tags = await getTags(authKey);
      setAllTags(tags);
      const billTag = findTagByName(tags, TAG_NAMES.ADD_BILL);
      if (!billTag) {
        updateStep('bills', { status: 'skipped', message: 'Tag "🧾 add bill" not found' });
        return;
      }

      updateStep('bills', { message: 'Fetching transactions...' });
      const transactions = await getTransactionsByTag(authKey, [billTag.id]);

      if (transactions.length === 0) {
        updateStep('bills', { status: 'done', message: 'No transactions to process', count: 0 });
        return;
      }

      const bills = analyzeTransactionsForBills(transactions);
      const toProcess = bills.filter(b => !b.alreadyProcessed);

      if (toProcess.length === 0) {
        updateStep('bills', { status: 'done', message: `All ${bills.length} already have bills`, count: 0 });
        return;
      }

      let processed = 0;
      for (const bill of toProcess) {
        updateStep('bills', { message: `Processing ${processed + 1}/${toProcess.length}...` });
        const newNotes = (bill.transaction.notes ?? '') + formatBillNote(bill.breakdown);
        await updateMonarchTransaction(authKey, bill.transaction.id, newNotes);

        const newTagIds = removeTagFromList(bill.transaction.tags ?? [], billTag.id);
        await setTransactionTags(authKey, bill.transaction.id, newTagIds);
        processed++;
      }

      updateStep('bills', { status: 'done', message: `${processed} bills added`, count: processed });
    } catch (err) {
      updateStep('bills', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, updateStep]);

  // --- Steps 3 & 4: Expenses & Revenues to Google Sheets ---
  const runExpenses = useCallback(async () => {
    if (!authKey) return;
    const scriptUrl = storage.options.googleScriptUrl;
    if (!scriptUrl) {
      updateStep('expenses', { status: 'error', message: 'Google Script URL not configured' });
      return;
    }

    updateStep('expenses', { status: 'running', message: 'Fetching tags...' });

    try {
      const tags = allTags.length > 0 ? allTags : await getTags(authKey);
      if (allTags.length === 0) setAllTags(tags);

      const raphaTag = findTagByName(tags, TAG_NAMES.EXPENSE_RAPHA_TO_ADD);
      const farmzzTag = findTagByName(tags, TAG_NAMES.EXPENSE_FARMZZ_TO_ADD);
      const raphaAddedTag = findTagByName(tags, TAG_NAMES.EXPENSE_RAPHA_ADDED);
      const farmzzAddedTag = findTagByName(tags, TAG_NAMES.EXPENSE_FARMZZ_ADDED);

      let raphaAddedId = raphaAddedTag?.id;
      if (!raphaAddedId) {
        const created = await createTag(authKey, TAG_NAMES.EXPENSE_RAPHA_ADDED, '#6B7280');
        raphaAddedId = created.id;
      }
      let farmzzAddedId = farmzzAddedTag?.id;
      if (!farmzzAddedId && farmzzTag) {
        const created = await createTag(authKey, TAG_NAMES.EXPENSE_FARMZZ_ADDED, '#6B7280');
        farmzzAddedId = created.id;
      }

      const tagIdsToQuery = [raphaTag?.id, farmzzTag?.id].filter(Boolean) as string[];
      if (tagIdsToQuery.length === 0) {
        updateStep('expenses', { status: 'skipped', message: 'No expense tags found' });
        return;
      }

      updateStep('expenses', { message: 'Fetching transactions...' });
      const transactions = await getTransactionsByTag(authKey, tagIdsToQuery);

      if (transactions.length === 0) {
        updateStep('expenses', { status: 'done', message: 'No expenses to export', count: 0 });
        return;
      }

      const rows = transactions.map(tx => {
        const isRapha = tx.tags?.some(t => t.name === TAG_NAMES.EXPENSE_RAPHA_TO_ADD);
        return transactionToExpenseRow(tx as never, isRapha ? 'rapha' : 'farmzz');
      });

      updateStep('expenses', { message: `Sending ${rows.length} rows to Sheets...` });
      const tab = storage.options.expenseSheetTab ?? "expenses '25 [-]";
      await postToGoogleSheet(scriptUrl, { tab, rows });

      updateStep('expenses', { message: 'Flipping tags...' });
      for (const tx of transactions) {
        const isRapha = tx.tags?.some(t => t.name === TAG_NAMES.EXPENSE_RAPHA_TO_ADD);
        const removeId = isRapha ? raphaTag!.id : farmzzTag!.id;
        const addId = isRapha ? raphaAddedId! : farmzzAddedId!;
        const newIds = swapTag(tx.tags ?? [], removeId, addId);
        await setTransactionTags(authKey, tx.id, newIds);
      }

      updateStep('expenses', { status: 'done', message: `${rows.length} expenses exported`, count: rows.length });
    } catch (err) {
      updateStep('expenses', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, storage.options, allTags, updateStep]);

  const runRevenues = useCallback(async () => {
    if (!authKey) return;
    const scriptUrl = storage.options.googleScriptUrl;
    if (!scriptUrl) {
      updateStep('revenues', { status: 'error', message: 'Google Script URL not configured' });
      return;
    }

    updateStep('revenues', { status: 'running', message: 'Fetching tags...' });

    try {
      const tags = allTags.length > 0 ? allTags : await getTags(authKey);
      if (allTags.length === 0) setAllTags(tags);

      const revenueTag = findTagByName(tags, TAG_NAMES.REVENUE_TO_ADD);
      const revenueAddedTag = findTagByName(tags, TAG_NAMES.REVENUE_ADDED);

      if (!revenueTag) {
        updateStep('revenues', { status: 'skipped', message: 'Revenue tag not found' });
        return;
      }

      let addedId = revenueAddedTag?.id;
      if (!addedId) {
        const created = await createTag(authKey, TAG_NAMES.REVENUE_ADDED, '#10B981');
        addedId = created.id;
      }

      updateStep('revenues', { message: 'Fetching transactions...' });
      const transactions = await getTransactionsByTag(authKey, [revenueTag.id]);

      if (transactions.length === 0) {
        updateStep('revenues', { status: 'done', message: 'No revenues to export', count: 0 });
        return;
      }

      const rows = transactions.map(tx => transactionToRevenueRow(tx as never));

      updateStep('revenues', { message: `Sending ${rows.length} rows to Sheets...` });
      const tab = storage.options.revenueSheetTab ?? "income '25 [+]";
      await postToGoogleSheet(scriptUrl, { tab, rows });

      updateStep('revenues', { message: 'Flipping tags...' });
      for (const tx of transactions) {
        const newIds = swapTag(tx.tags ?? [], revenueTag.id, addedId);
        await setTransactionTags(authKey, tx.id, newIds);
      }

      updateStep('revenues', { status: 'done', message: `${rows.length} revenues exported`, count: rows.length });
    } catch (err) {
      updateStep('revenues', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, storage.options, allTags, updateStep]);

  // --- Step 5: Dime Calculator ---
  const runDime = useCallback(async () => {
    if (!authKey) return;
    updateStep('dime', { status: 'running', message: 'Calculating dime...' });

    try {
      const tags = allTags.length > 0 ? allTags : await getTags(authKey);
      const revenueAddedTag = findTagByName(tags, TAG_NAMES.REVENUE_ADDED);
      const revenueToAddTag = findTagByName(tags, TAG_NAMES.REVENUE_TO_ADD);

      const tagIds = [revenueAddedTag?.id, revenueToAddTag?.id].filter(Boolean) as string[];

      let grossRevenue = 0;
      if (tagIds.length > 0) {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const revenueTxs = await getTransactionsByTag(authKey, tagIds, yearStart);
        grossRevenue = revenueTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      }

      const pct = (storage.options.dimePercentage ?? 10) / 100;
      const dimeAmount = Math.round(grossRevenue * pct * 100) / 100;

      setPipeline(prev => ({
        ...prev,
        dime: {
          ...prev.dime,
          status: 'review',
          message: `Revenus: $${grossRevenue.toFixed(2)} | Dîme (${
            storage.options.dimePercentage ?? 10
          }%): $${dimeAmount.toFixed(2)}`,
          count: 0,
          grossRevenue,
          dimeAmount,
        },
      }));
    } catch (err) {
      updateStep('dime', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, allTags, storage.options.dimePercentage, updateStep]);

  // --- Step 6: Investment Snapshots ---
  const runSnapshots = useCallback(async () => {
    if (!authKey) return;
    updateStep('snapshots', { status: 'running', message: 'Fetching accounts...' });

    try {
      const previous = await getLatestSnapshot();
      const accounts = await getAccounts(authKey);

      let netWorth = 0;
      let investments = 0;
      let cash = 0;

      const accountSnapshots = accounts.map(a => {
        netWorth += a.currentBalance;
        if (['brokerage', 'retirement'].includes(a.subtype?.name?.toLowerCase?.() ?? '')) {
          investments += a.currentBalance;
        }
        if (['checking', 'savings'].includes(a.subtype?.name?.toLowerCase?.() ?? '')) {
          cash += a.currentBalance;
        }
        return {
          id: a.id,
          name: a.displayName,
          balance: a.currentBalance,
          type: a.type?.name ?? '',
          subtype: a.subtype?.name ?? '',
        };
      });

      const current: Snapshot = {
        timestamp: Date.now(),
        accounts: accountSnapshots,
        netWorth: Math.round(netWorth * 100) / 100,
        investments: Math.round(investments * 100) / 100,
        cash: Math.round(cash * 100) / 100,
      };

      await addSnapshot(current);

      setPipeline(prev => ({
        ...prev,
        snapshots: {
          ...prev.snapshots,
          status: 'review',
          message: `Net worth: $${current.netWorth.toLocaleString()}`,
          count: accounts.length,
          current,
          previous: previous ?? undefined,
        },
      }));
    } catch (err) {
      updateStep('snapshots', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, updateStep]);

  // --- Step 7: Backup ---
  const runBackup = useCallback(async () => {
    if (!authKey) return;
    updateStep('backup', { status: 'running', message: 'Fetching all transactions...' });

    try {
      const transactions = await getTransactionsByTag(authKey, [], undefined, undefined, 10000);

      const csvHeader = 'Date,Merchant,Category,Amount,Notes,Tags\n';
      const csvRows = transactions
        .map(tx => {
          const extended = tx as MonarchTransaction & { originalMerchant?: { name: string } };
          const merchant = extended.originalMerchant?.name ?? '';
          const category = tx.category?.name ?? '';
          const tags = (tx.tags ?? []).map(t => t.name).join('; ');
          const notes = (tx.notes ?? '').replace(/"/g, '""').replace(/\n/g, ' ');
          return `${tx.date},"${merchant}","${category}",${tx.amount},"${notes}","${tags}"`;
        })
        .join('\n');

      const csv = csvHeader + csvRows;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];

      await chrome.downloads.download({ url, filename: `Monarch_Backup_${date}.csv`, saveAs: true });

      updateStep('backup', {
        status: 'done',
        message: `${transactions.length} transactions exported`,
        count: transactions.length,
      });
    } catch (err) {
      updateStep('backup', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, updateStep]);

  // --- Step 9: Quarterly Tax Summary ---
  const runQuarterly = useCallback(async () => {
    if (!authKey) return;
    updateStep('quarterly', { status: 'running', message: 'Calculating quarterly taxes...' });

    try {
      const categories = allCategories.length > 0 ? allCategories : await getCategories(authKey);

      const businessCatIds = categories
        .filter(c => ['rapha_business', 'farmzz'].includes(c.group?.name ?? ''))
        .map(c => c.id);
      const incomeCatIds = categories
        .filter(c =>
          ['paycheck [+]', 'rapha income [+]', 'other income [+]'].includes(`${c.name} [${c.group?.name ?? ''}]`),
        )
        .map(c => c.id);

      const year = new Date().getFullYear();
      const yearStart = new Date(year, 0, 1);

      const expenses =
        businessCatIds.length > 0 ? await getTransactionsByCategoryIds(authKey, businessCatIds, yearStart) : [];
      const revenues =
        incomeCatIds.length > 0 ? await getTransactionsByCategoryIds(authKey, incomeCatIds, yearStart) : [];

      const toTaxItem = (tx: MonarchTransaction): TaxableItem => {
        const taxTag = (tx.tags ?? []).find(t => t.name.startsWith('txs [') || t.name.startsWith('txs assur'));
        return { date: tx.date, amount: tx.amount, taxTag: taxTag?.name ?? '' };
      };

      const quarters = calculateQuarterlyTax(revenues.map(toTaxItem), expenses.map(toTaxItem), year);

      setPipeline(prev => ({
        ...prev,
        quarterly: { ...prev.quarterly, status: 'done', message: `${year} Q1-Q4 calculated`, count: 4, quarters },
      }));
    } catch (err) {
      updateStep('quarterly', { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [authKey, allTags, allCategories, updateStep]);

  // --- Run All Pipeline ---
  const runAll = useCallback(async () => {
    setRunning(true);
    setPipeline({ ...INITIAL_PIPELINE });

    await runAmazonSync();
    await runAutoCategorize();
    await runAutoTag();
    await runBills();
    await runExpenses();
    await runRevenues();
    await runDime();
    await runSnapshots();
    await runBackup();
    await runQuarterly();

    setRunning(false);
  }, [
    runAmazonSync,
    runAutoCategorize,
    runAutoTag,
    runBills,
    runExpenses,
    runRevenues,
    runDime,
    runSnapshots,
    runBackup,
    runQuarterly,
  ]);

  if (!isConnected) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 text-sm">Connect to Monarch Money first (visit monarchmoney.com)</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Comptabilité</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Settings">
            <FaCog size={14} />
          </button>
          <Button size="xs" color="dark" onClick={runAll} disabled={running}>
            {running ? (
              <>
                <FaSpinner className="animate-spin mr-1" /> Running...
              </>
            ) : (
              <>
                <FaPlay className="mr-1" /> Run All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
          <div>
            <label htmlFor="compta-script-url" className="block text-xs font-medium text-gray-600 mb-1">
              Google Apps Script URL
            </label>
            <input
              id="compta-script-url"
              type="text"
              value={settingsForm.googleScriptUrl}
              onChange={e => setSettingsForm(f => ({ ...f, googleScriptUrl: e.target.value }))}
              placeholder="https://script.google.com/macros/s/..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="compta-expense-tab" className="block text-xs font-medium text-gray-600 mb-1">
                Expense Tab
              </label>
              <input
                id="compta-expense-tab"
                type="text"
                value={settingsForm.expenseSheetTab}
                onChange={e => setSettingsForm(f => ({ ...f, expenseSheetTab: e.target.value }))}
                title="Expense sheet tab name"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="compta-revenue-tab" className="block text-xs font-medium text-gray-600 mb-1">
                Revenue Tab
              </label>
              <input
                id="compta-revenue-tab"
                type="text"
                value={settingsForm.revenueSheetTab}
                onChange={e => setSettingsForm(f => ({ ...f, revenueSheetTab: e.target.value }))}
                title="Revenue sheet tab name"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor="compta-dime-pct" className="block text-xs font-medium text-gray-600 mb-1">
              Dime % (of gross revenue)
            </label>
            <input
              id="compta-dime-pct"
              type="number"
              value={settingsForm.dimePercentage}
              onChange={e => setSettingsForm(f => ({ ...f, dimePercentage: Number(e.target.value) }))}
              min={0}
              max={100}
              title="Dime percentage"
              className="w-20 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button size="xs" color="dark" onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      )}

      {/* Pipeline Steps */}
      <div className="space-y-2">
        <StepCard
          icon={<FaSync />}
          label="Step 0: Amazon Sync"
          state={pipeline.amazonSync}
          onRun={runAmazonSync}
          disabled={running}
        />
        <StepCard
          icon={<FaSearch />}
          label="Step 1: Auto-Categorize"
          state={pipeline.autoCategorize}
          onRun={runAutoCategorize}
          disabled={running}
        />
        <StepCard
          icon={<FaTags />}
          label="Step 1.5: Auto-Tag"
          state={pipeline.autoTag}
          onRun={runAutoTag}
          disabled={running}
        />
        <StepCard
          icon={<FaFileInvoiceDollar />}
          label="Step 2: Bills (factures)"
          state={pipeline.bills}
          onRun={runBills}
          disabled={running}
        />
        <StepCard
          icon={<FaFileExport />}
          label="Step 3: Expenses → Sheets"
          state={pipeline.expenses}
          onRun={runExpenses}
          disabled={running}
        />
        <StepCard
          icon={<FaFileExport />}
          label="Step 4: Revenues → Sheets"
          state={pipeline.revenues}
          onRun={runRevenues}
          disabled={running}
        />
        <StepCard icon={<FaChurch />} label="Step 5: Dîme" state={pipeline.dime} onRun={runDime} disabled={running} />
        {pipeline.dime.status === 'review' && (
          <DimeReview
            grossRevenue={pipeline.dime.grossRevenue ?? 0}
            dimeAmount={pipeline.dime.dimeAmount ?? 0}
            percentage={storage.options.dimePercentage ?? 10}
            onConfirm={() => updateStep('dime', { status: 'done', message: pipeline.dime.message })}
          />
        )}
        <StepCard
          icon={<FaChartLine />}
          label="Step 6: Investment Snapshots"
          state={pipeline.snapshots}
          onRun={runSnapshots}
          disabled={running}
        />
        {pipeline.snapshots.status === 'review' && pipeline.snapshots.current && (
          <SnapshotReview
            current={pipeline.snapshots.current}
            previous={pipeline.snapshots.previous ?? null}
            onConfirm={() => updateStep('snapshots', { status: 'done', message: pipeline.snapshots.message })}
          />
        )}
        <StepCard
          icon={<FaDownload />}
          label="Step 7: Backup"
          state={pipeline.backup}
          onRun={runBackup}
          disabled={running}
        />
        <StepCard
          icon={<FaChartLine />}
          label="Step 8: Quarterly TPS/TVQ"
          state={pipeline.quarterly}
          onRun={runQuarterly}
          disabled={running}
        />
        {pipeline.quarterly.status === 'done' && pipeline.quarterly.quarters && (
          <QuarterlyDisplay quarters={pipeline.quarterly.quarters} />
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function StepCard({
  icon,
  label,
  state,
  onRun,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  state: StepState;
  onRun: () => void;
  disabled: boolean;
}) {
  const statusColors: Record<StepStatus, string> = {
    idle: 'bg-gray-50 border-gray-200',
    running: 'bg-blue-50 border-blue-300',
    done: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
    review: 'bg-amber-50 border-amber-300',
    skipped: 'bg-gray-50 border-gray-200',
  };

  const statusIcons: Record<StepStatus, React.ReactNode> = {
    idle: null,
    running: <FaSpinner className="animate-spin text-blue-500" size={12} />,
    done: <FaCheck className="text-green-500" size={12} />,
    error: <span className="text-red-500 text-xs font-bold">!</span>,
    review: <span className="text-amber-500 text-xs">👀</span>,
    skipped: <span className="text-gray-400 text-xs">—</span>,
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${statusColors[state.status]} transition-all`}>
      <span className="text-gray-500 text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800">{label}</div>
        {state.message && (
          <div className={`text-[10px] truncate ${state.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
            {state.message}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {state.count > 0 && (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
            {state.count}
          </span>
        )}
        {statusIcons[state.status]}
        {state.status === 'idle' && (
          <button
            onClick={onRun}
            disabled={disabled}
            className="text-[10px] px-2 py-1 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
            Run
          </button>
        )}
      </div>
    </div>
  );
}

function DimeReview({
  grossRevenue,
  dimeAmount,
  percentage,
  onConfirm,
}: {
  grossRevenue: number;
  dimeAmount: number;
  percentage: number;
  onConfirm: () => void;
}) {
  return (
    <div className="ml-6 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Revenus bruts</span>
          <div className="font-bold text-gray-800">
            ${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <span className="text-gray-500">Dîme ({percentage}%)</span>
          <div className="font-bold text-amber-700">
            ${dimeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <Button size="xs" color="warning" onClick={onConfirm} className="w-full">
        Confirm
      </Button>
    </div>
  );
}

function SnapshotReview({
  current,
  previous,
  onConfirm,
}: {
  current: Snapshot;
  previous: Snapshot | null;
  onConfirm: () => void;
}) {
  const delta = (curr: number, prev: number | undefined) => {
    if (prev === undefined) return null;
    const diff = curr - prev;
    const pct = prev !== 0 ? ((diff / Math.abs(prev)) * 100).toFixed(1) : '—';
    return { diff, pct, positive: diff >= 0 };
  };

  const nwDelta = delta(current.netWorth, previous?.netWorth);
  const invDelta = delta(current.investments, previous?.investments);
  const cashDelta = delta(current.cash, previous?.cash);

  return (
    <div className="ml-6 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <MetricCard label="Net Worth" value={current.netWorth} delta={nwDelta} />
        <MetricCard label="Investments" value={current.investments} delta={invDelta} />
        <MetricCard label="Cash" value={current.cash} delta={cashDelta} />
      </div>
      {previous && (
        <div className="text-[9px] text-gray-400">vs {new Date(previous.timestamp).toLocaleDateString()}</div>
      )}
      <Button size="xs" color="warning" onClick={onConfirm} className="w-full">
        Confirm
      </Button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: { diff: number; pct: string; positive: boolean } | null;
}) {
  return (
    <div>
      <span className="text-gray-500 text-[10px]">{label}</span>
      <div className="font-bold text-gray-800 text-xs">
        ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </div>
      {delta && (
        <div className={`text-[9px] font-semibold ${delta.positive ? 'text-green-600' : 'text-red-600'}`}>
          {delta.positive ? '+' : ''}
          {delta.diff.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({delta.pct}%)
        </div>
      )}
    </div>
  );
}

function QuarterlyDisplay({ quarters }: { quarters: QuarterSummary[] }) {
  return (
    <div className="ml-6 p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
      <div className="text-[10px] font-bold text-blue-800 mb-1">TPS/TVQ par trimestre</div>
      <div className="grid grid-cols-4 gap-1">
        {quarters.map(q => (
          <div key={q.quarter} className="text-center">
            <div className="text-[9px] font-bold text-blue-700">{q.label}</div>
            <div className="text-[8px] text-gray-500">
              TPS: <span className={q.netTps >= 0 ? 'text-red-600' : 'text-green-600'}>${q.netTps.toFixed(0)}</span>
            </div>
            <div className="text-[8px] text-gray-500">
              TVQ: <span className={q.netTvq >= 0 ? 'text-red-600' : 'text-green-600'}>${q.netTvq.toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[8px] text-gray-400 mt-1">Net positif = vous devez. Net négatif = remboursement.</div>
    </div>
  );
}

export default ComptabiliteTab;
