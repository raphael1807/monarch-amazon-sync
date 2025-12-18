import { Order, fetchOrders } from '@root/src/shared/api/amazonApi';
import reloadOnUpdate from 'virtual:reload-on-update-in-background-script';
import 'webextension-polyfill';
import { MonarchTransaction, getTransactions, updateMonarchTransaction } from '@root/src/shared/api/monarchApi';
import progressStorage, { ProgressPhase, updateProgress } from '@root/src/shared/storages/progressStorage';
import transactionStorage, { TransactionStatus } from '@root/src/shared/storages/transactionStorage';
import { matchTransactions } from '@root/src/shared/api/matchUtil';
import appStorage, { AuthStatus, FailureReason, LastSync, Page } from '@root/src/shared/storages/appStorage';
import { Action } from '@root/src/shared/types';
import debugStorage, { debugLog } from '@root/src/shared/storages/debugStorage';
import { addSyncRecord } from '@root/src/shared/storages/syncHistoryStorage';
import { logger, timeOperation } from '@root/src/shared/utils/logger';
import {
  wasAlreadyProcessed,
  markAsProcessed,
  clearOldProcessedTransactions,
  getCacheStats,
} from '@root/src/shared/storages/processedTransactionsStorage';
import { initFileLogger, saveLogFile, logFinalStats, logToFile } from '@root/src/shared/utils/fileLogger';
import { calculateQuebecTaxes, formatTaxBreakdown } from '@root/src/shared/utils/taxCalculator';
import { calculateDateRange } from '@root/src/shared/utils/dateRangeCalculator';

reloadOnUpdate('pages/background');

// Log when service worker starts
logger.header('Monarch/Amazon Sync Extension v1.0.0 - Service Worker Started');
console.log('🚀 Monarch/Amazon Sync Extension Service Worker Started');
debugLog('Service worker started');

// Create context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sync-now',
    title: '🔄 Sync Now',
    contexts: ['action'],
  });
  chrome.contextMenus.create({
    id: 'view-history',
    title: '📜 View Sync History',
    contexts: ['action'],
  });
  chrome.contextMenus.create({
    id: 'open-settings',
    title: '⚙️ Settings',
    contexts: ['action'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async info => {
  if (info.menuItemId === 'sync-now') {
    const { amazonStatus, monarchStatus } = await appStorage.get();
    if (amazonStatus === AuthStatus.Success && monarchStatus === AuthStatus.Success) {
      await handleFullSync(undefined, () => {});
    }
  } else if (info.menuItemId === 'view-history') {
    await appStorage.patch({ page: Page.Default });
  } else if (info.menuItemId === 'open-settings') {
    await appStorage.patch({ page: Page.Options });
  }
});

async function checkAlarm() {
  const alarm = await chrome.alarms.get('sync-alarm');

  if (!alarm) {
    const { lastSync } = await appStorage.get();
    const lastTime = new Date(lastSync?.time || 0);
    const sinceLastSync = Date.now() - lastTime.getTime() / (1000 * 60);
    const delayInMinutes = Math.max(0, 24 * 60 - sinceLastSync);

    await chrome.alarms.create('sync-alarm', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60,
    });
  }
}

// Setup alarms for syncing
checkAlarm();
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'sync-alarm') {
    const { amazonStatus, monarchStatus, options } = await appStorage.get();
    if (options.syncEnabled && amazonStatus === AuthStatus.Success && monarchStatus === AuthStatus.Success) {
      await handleFullSync(undefined, () => {});
    }
  }
});

// Repopulate Monarch key when the tab is visited and the user is logged in
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab?.url?.startsWith('chrome://')) {
    return true;
  }
  if (changeInfo.url) {
    console.log('🔍 Tab URL changed:', changeInfo.url);
    const url = new URL(changeInfo.url);
    if (url.hostname === 'app.monarchmoney.com' || url.hostname === 'app.monarch.com') {
      await debugLog(`Detected Monarch page: ${url.hostname}`);
      const appData = await appStorage.get();
      const lastAuth = new Date(appData.lastMonarchAuth);
      if (
        !appData.monarchKey ||
        appData.monarchStatus !== AuthStatus.Success ||
        lastAuth < new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
      ) {
        await debugLog('Checking Monarch auth');
        // Execute script in the current tab
        const result = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => localStorage['persist:root'],
        });
        try {
          const key = JSON.parse(JSON.parse(result[0].result).user).token;
          if (key) {
            await debugLog('Monarch auth success');
            await appStorage.patch({ monarchKey: key, lastMonarchAuth: Date.now(), monarchStatus: AuthStatus.Success });
          } else {
            await debugLog('Monarch auth failed: No token found');
            await appStorage.patch({ monarchStatus: AuthStatus.NotLoggedIn });
          }
        } catch (ex) {
          await debugLog('Monarch auth failed with error: ' + ex);
          await appStorage.patch({ monarchStatus: AuthStatus.Failure });
          debugLog(ex);
        }
      } else {
        await debugLog('Monarch already authenticated, skipping');
      }
    }
  }
});

type Payload = {
  year?: string;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.url?.startsWith('chrome://')) {
    return true;
  }

  // Handle download trace request
  if (message.action === 'downloadTrace') {
    saveLogFile()
      .then(filename => {
        sendResponse({ success: true, filename });
      })
      .catch(error => {
        logger.error('Failed to save trace file', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true; // Keep channel open for async response
  }

  if (message.action === Action.DryRun) {
    handleDryRun(message.payload, sendResponse);
  } else if (message.action === Action.FullSync) {
    handleFullSync(message.payload, sendResponse);
  } else {
    console.warn(`Unknown action: ${message.action}`);
  }

  return true; // indicates we will send a response asynchronously
});

async function inProgress() {
  const progress = await progressStorage.get();
  return progress.phase !== ProgressPhase.Complete && progress.phase !== ProgressPhase.Idle;
}

async function handleDryRun(payload: Payload | undefined, sendResponse: (args: unknown) => void) {
  logger.header('DRY-RUN STARTED');
  logger.info('Mode: Dry-Run (Preview Only)', { year: payload?.year || 'Current' });

  if (await inProgress()) {
    logger.warning('Sync already in progress - aborting');
    sendResponse({ success: false });
    return;
  }

  if (await downloadAndStoreTransactions(payload?.year, true)) {
    logger.success('Dry-run completed successfully');
    sendResponse({ success: true });
    return;
  }

  logger.error('Dry-run failed');
  sendResponse({ success: false });
}

async function handleFullSync(payload: Payload | undefined, sendResponse: (args: unknown) => void) {
  const startTime = Date.now();
  if (await inProgress()) {
    sendResponse({ success: false });
    return;
  }
  if (await downloadAndStoreTransactions(payload?.year, false)) {
    if (await updateMonarchTransactions(startTime)) {
      sendResponse({ success: true });
      return;
    }
  }
  sendResponse({ success: false });
}

async function logSyncComplete(
  payload: Partial<LastSync> & {
    updated?: number;
    skipped?: number;
    cached?: number;
    helperNotesAdded?: number;
  },
  startTime?: number,
) {
  await debugLog('Sync complete');
  await progressStorage.patch({ phase: ProgressPhase.Complete });

  const syncData = {
    time: Date.now(),
    amazonOrders: payload.amazonOrders ?? 0,
    monarchTransactions: payload.monarchTransactions ?? 0,
    transactionsUpdated: payload.transactionsUpdated ?? 0,
    success: payload.success ?? false,
    failureReason: payload.failureReason,
    dryRun: payload.dryRun ?? false,
  };

  await appStorage.patch({ lastSync: syncData });

  // Add to sync history
  await addSyncRecord({
    success: syncData.success,
    dryRun: syncData.dryRun,
    amazonOrders: syncData.amazonOrders,
    monarchTransactions: syncData.monarchTransactions,
    matchesFound: syncData.transactionsUpdated,
    duration: startTime ? Date.now() - startTime : undefined,
    failureReason: syncData.failureReason,
  });

  // Send browser notification (using data URL for icon to avoid download error)
  const appData = await appStorage.get();

  // Simple 1x1 transparent PNG as data URL (to satisfy iconUrl requirement)
  const transparentIcon =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  if (appData.options.notifications !== false && syncData.success && syncData.transactionsUpdated > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: transparentIcon,
      title: syncData.dryRun ? '🔍 Dry-Run Complete' : '✓ Sync Complete!',
      message: `Found ${syncData.transactionsUpdated} matches! ${
        syncData.dryRun ? 'Click extension to download CSV.' : 'Check Monarch for updates.'
      }`,
      priority: 2,
    });
  } else if (appData.options.notifications !== false && !syncData.success) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: transparentIcon,
      title: '❌ Sync Failed',
      message: syncData.failureReason || 'Unknown error occurred',
      priority: 2,
    });
  }
}

async function downloadAndStoreTransactions(yearString?: string, dryRun: boolean = false) {
  const startTime = Date.now();
  await debugStorage.set({ logs: [] });

  // Initialize file logger
  initFileLogger();

  const appData = await appStorage.get();

  // Use date range from options instead of year parameter
  const rangeType = appData.options.dateRangeType || '3months';
  const { startDate, endDate } = calculateDateRange(
    rangeType,
    appData.options.customStartDate,
    appData.options.customEndDate,
  );

  // Auto-enable override for custom date ranges (user wants to re-sync specific period)
  const shouldOverride = rangeType === 'custom' || appData.options.overrideTransactions;

  // Log to both console and trace file
  const dateRangeInfo = {
    type: rangeType,
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
    customStart: appData.options.customStartDate,
    customEnd: appData.options.customEndDate,
    overrideMode: shouldOverride,
  };

  logger.info('📅 Date range selected', dateRangeInfo);
  logToFile(`\n📅 DATE RANGE SELECTION:`);
  logToFile(`   Type: ${rangeType}`);
  logToFile(`   Start: ${startDate.toISOString().split('T')[0]}`);
  logToFile(`   End: ${endDate.toISOString().split('T')[0]}`);
  if (rangeType === 'custom') {
    logToFile(`   Custom Start Input: ${appData.options.customStartDate || 'not set'}`);
    logToFile(`   Custom End Input: ${appData.options.customEndDate || 'not set'}`);
    logToFile(`   Override Mode: ENABLED (auto for custom ranges)`);
  }

  // Legacy: still support year parameter if provided
  const year = yearString && yearString !== 'recent' ? parseInt(yearString) : undefined;

  logger.step('Checking Monarch authentication', { hasKey: !!appData.monarchKey });

  if (!appData.monarchKey) {
    logger.error('No Monarch API key found - user not authenticated');
    await logSyncComplete({ success: false, failureReason: FailureReason.NoMonarchAuth }, startTime);
    return false;
  }

  await updateProgress(ProgressPhase.AmazonPageScan, 0, 0);

  let orders: Order[];
  try {
    orders = await timeOperation('Fetch Amazon Orders', async () => {
      logger.step('Fetching Amazon orders', { year: year || 'Current' });
      await debugLog('Fetching Amazon orders');
      return await fetchOrders(year);
    });

    logger.success('Amazon orders fetched', { count: orders.length });
  } catch (e) {
    await debugLog(e);
    logger.error('Failed to fetch Amazon orders', e);
    await logSyncComplete({ success: false, failureReason: FailureReason.AmazonError }, startTime);
    return false;
  }

  if (!orders || orders.length === 0) {
    await debugLog('No Amazon orders found');
    logger.warning('No Amazon orders found', { year });
    await logSyncComplete({ success: false, failureReason: FailureReason.NoAmazonOrders }, startTime);
    return false;
  }

  logger.info('Amazon orders summary', {
    total: orders.length,
    withItems: orders.filter(o => o.items.length > 0).length,
    withTransactions: orders.filter(o => o.transactions.length > 0).length,
  });

  await transactionStorage.patch({
    orders: orders,
  });

  await progressStorage.patch({ phase: ProgressPhase.MonarchDownload, total: 1, complete: 0 });

  // Use the startDate and endDate calculated above from date range selector
  // (No longer using year-based calculation)

  logger.step('Fetching Monarch transactions', {
    merchant: appData.options.amazonMerchant,
    dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
  });

  logToFile(`\n💳 MONARCH FETCH:`);
  logToFile(`   Merchant: ${appData.options.amazonMerchant}`);
  logToFile(`   Start: ${startDate.toISOString().split('T')[0]}`);
  logToFile(`   End: ${endDate.toISOString().split('T')[0]}`);

  let monarchTransactions: MonarchTransaction[];
  try {
    await debugLog('Fetching Monarch transactions');
    monarchTransactions = await timeOperation('Fetch Monarch Transactions', async () => {
      return await getTransactions(appData.monarchKey!, appData.options.amazonMerchant, startDate, endDate);
    });

    if (!monarchTransactions || monarchTransactions.length === 0) {
      logger.warning('No Monarch transactions found');
      await logSyncComplete({ success: false, failureReason: FailureReason.NoMonarchTransactions }, startTime);
      return false;
    }

    logger.success('Monarch transactions fetched', { count: monarchTransactions.length });
  } catch (ex) {
    await debugLog(ex);
    logger.error('Failed to fetch Monarch transactions', ex);
    await logSyncComplete({ success: false, failureReason: FailureReason.MonarchError }, startTime);
    return false;
  }

  await transactionStorage.patch({
    result: TransactionStatus.Success,
    transactions: monarchTransactions,
  });

  if (dryRun) {
    logger.step('Matching transactions (Dry-Run)');
    const matches = matchTransactions(monarchTransactions, orders, appData.options.overrideTransactions);

    // Find unmatched transactions
    const matchedAmazonIds = new Set(matches.map(m => m.amazon.id));
    const matchedMonarchIds = new Set(matches.map(m => m.monarch.id));

    const unmatchedOrders = orders.filter(order => {
      return !order.transactions.some(t => matchedAmazonIds.has(t.id));
    });

    const unmatchedTransactions = monarchTransactions.filter(txn => {
      // Don't show as unmatched if it already has notes (user may have manually added them)
      if (!appData.options.overrideTransactions && txn.notes) return false;
      return !matchedMonarchIds.has(txn.id);
    });

    logger.success('Matching complete', {
      amazonOrders: orders.length,
      monarchTransactions: monarchTransactions.length,
      matches: matches.length,
      unmatchedAmazon: unmatchedOrders.length,
      unmatchedMonarch: unmatchedTransactions.length,
      matchRate: `${((matches.length / orders.length) * 100).toFixed(1)}%`,
    });

    // Show top matches
    if (matches.length > 0) {
      logger.group('Top 5 Matches', () => {
        matches.slice(0, 5).forEach((match, idx) => {
          console.log(`${idx + 1}. ${match.amazon.id} → ${match.monarch.id}`, {
            confidence: `${match.confidence}%`,
            amount: `$${match.amazon.amount.toFixed(2)}`,
            items: match.items.length,
          });
        });
      });
    }

    // Show unmatched
    if (unmatchedOrders.length > 0) {
      logger.warning(`${unmatchedOrders.length} unmatched Amazon orders`, {
        sample: unmatchedOrders.slice(0, 3).map(o => ({
          date: o.date,
          amount: o.transactions[0]?.amount,
          id: o.id,
        })),
      });
    }

    if (unmatchedTransactions.length > 0) {
      logger.warning(`${unmatchedTransactions.length} unmatched Monarch transactions`, {
        sample: unmatchedTransactions.slice(0, 3).map(t => ({
          date: t.date,
          amount: t.amount,
          id: t.id,
        })),
      });
    }

    // Store unmatched for display
    await transactionStorage.patch({
      unmatchedOrders,
      unmatchedTransactions,
    });

    logger.summary({
      Mode: 'DRY-RUN',
      'Amazon Orders': orders.length,
      'Monarch Transactions': monarchTransactions.length,
      'Matches Found': matches.length,
      'Unmatched Amazon': unmatchedOrders.length,
      'Unmatched Monarch': unmatchedTransactions.length,
      'Match Rate': `${((matches.length / orders.length) * 100).toFixed(1)}%`,
      Duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });

    await logSyncComplete(
      {
        success: true,
        dryRun: true,
        amazonOrders: orders.length,
        monarchTransactions: monarchTransactions.length,
        transactionsUpdated: matches.length,
      },
      startTime,
    );
    return true;
  }

  // Pass override flag to update function
  await updateMonarchTransactions(startTime, shouldOverride);

  return true;
}

async function updateMonarchTransactions(startTime?: number, forceOverride: boolean = false) {
  logger.header('LIVE SYNC - Updating Monarch Transactions');

  // Auto-cleanup: Remove processed transactions older than 30 days
  const removed = await clearOldProcessedTransactions(30);
  if (removed > 0) {
    logger.info(`🧹 Cleaned ${removed} old cache entries (>30 days)`);
  }

  // Show cache stats
  const cacheStats = await getCacheStats();
  logger.info('💾 Transaction cache', {
    cached: cacheStats.total,
    oldestDays: cacheStats.oldest ? Math.floor((Date.now() - cacheStats.oldest) / (1000 * 60 * 60 * 24)) : 0,
  });

  await progressStorage.patch({ phase: ProgressPhase.MonarchUpload, total: 0, complete: 0 });

  const transactions = await transactionStorage.get();
  const appData = await appStorage.get();

  if (!appData.monarchKey) {
    logger.error('No Monarch API key');
    await logSyncComplete(
      {
        success: false,
        failureReason: FailureReason.NoMonarchAuth,
        amazonOrders: transactions.orders.length,
        monarchTransactions: transactions.transactions.length,
      },
      startTime,
    );
    return false;
  }

  // Use override mode (either from settings OR forced by custom date range)
  const effectiveOverride = forceOverride || appData.options.overrideTransactions;
  const matches = matchTransactions(transactions.transactions, transactions.orders, effectiveOverride);

  logger.step('Matching transactions', {
    amazonOrders: transactions.orders.length,
    monarchTransactions: transactions.transactions.length,
    matches: matches.length,
  });

  // Find orders with multiple PDFs that didn't match
  const matchedOrderIds = new Set(matches.map(m => m.amazon.id));
  const unmatchedWithPdfs = transactions.orders.filter(
    order => order.invoiceUrls && order.invoiceUrls.length > 1 && !matchedOrderIds.has(order.id),
  );

  if (unmatchedWithPdfs.length > 0) {
    logger.warning(`⚠️ ${unmatchedWithPdfs.length} order(s) have multiple invoices but no matches`);
    unmatchedWithPdfs.forEach(order => {
      logger.warning(`   Order ${order.id}: ${order.items.length} items, ${order.invoiceUrls?.length} PDFs`);
      console.log(`   💡 Check Monarch for transactions near: ${order.date}`);
      console.log(`   📄 PDF Links:`);
      order.invoiceUrls?.forEach((url, i) => {
        console.log(`      ${i + 1}. ${url}`);
      });
    });
  }

  let updated = 0;
  let skipped = 0;
  let cachedSkips = 0;

  for (const data of matches) {
    // Build item list
    const itemString = data.items
      .map(item => {
        return item.quantity + 'x ' + item.title + ' - $' + item.price.toFixed(2);
      })
      .join('\n\n')
      .trim();

    if (itemString.length === 0) {
      await debugLog('No items found for transaction ' + data.monarch.id);
      logger.warning(`Transaction ${data.monarch.id} has no items - skipping`);
      skipped++;
      continue;
    }

    // Find the order to get invoice URLs
    const order = transactions.orders.find(o => o.transactions.some(t => t.id === data.amazon.id));

    // Build complete note with items + tax breakdown + invoice URLs
    let fullNote = '';

    // Add refund indicator at the top if this is a refund
    if (data.amazon.refund) {
      fullNote = '🔄 REFUND - Same items as original order\n\n';
      logger.info('Processing refund transaction', {
        monarchId: data.monarch.id,
        amount: data.amazon.amount,
        originalOrderId: data.amazon.id,
      });
    }

    fullNote += itemString;

    // Add Quebec tax breakdown
    const itemsTotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxes = calculateQuebecTaxes(itemsTotal, Math.abs(data.monarch.amount));
    fullNote += formatTaxBreakdown(taxes);

    // Add invoice URLs if available
    if (order && order.invoiceUrls && order.invoiceUrls.length > 0) {
      fullNote += '\n\n📄 Invoice' + (order.invoiceUrls.length > 1 ? 's' : '') + ':\n';
      fullNote += order.invoiceUrls.map((url, i) => `${i + 1}. ${url}`).join('\n');

      // Add warning if multiple invoices
      if (order.invoiceUrls.length > 1) {
        fullNote += '\n\n⚠️ Multiple invoices - please verify total matches your transaction';
      }

      logger.info(`Adding ${order.invoiceUrls.length} invoice URL(s) + tax breakdown`, {
        orderId: order.id,
        monarchId: data.monarch.id,
        taxType: taxes.type,
      });
    }

    // Check if this transaction was already processed (unless override mode is on)
    if (!effectiveOverride) {
      const alreadyProcessed = await wasAlreadyProcessed(data.monarch.id, fullNote);
      if (alreadyProcessed) {
        logger.info(`💾 Transaction ${data.monarch.id} already processed (cached) - skipping`);
        cachedSkips++;
        skipped++;
        continue;
      }
    }

    if (data.monarch.notes === fullNote) {
      await debugLog('Transaction ' + data.monarch.id + ' already has correct note');
      logger.info(`Transaction ${data.monarch.id} already up to date - skipping`);
      skipped++;
      continue;
    }

    try {
      await updateMonarchTransaction(appData.monarchKey, data.monarch.id, fullNote);
      await debugLog('Updated transaction ' + data.monarch.id + ' with note ' + fullNote);

      // Mark as processed in cache
      await markAsProcessed(data.monarch.id, fullNote, data.amazon.id, data.monarch.amount);

      updated++;

      logger.success(`✓ Updated transaction ${updated}/${matches.length}`, {
        monarchId: data.monarch.id,
        items: data.items.length,
        hasInvoices: order?.invoiceUrls?.length || 0,
        isRefund: data.amazon.refund,
        confidence: `${data.confidence}%`,
      });

      // Show note preview for first 2 updates
      if (updated <= 2) {
        console.group(`📝 Note Preview (Transaction ${updated})`);
        console.log(fullNote);
        console.groupEnd();
      }
    } catch (error) {
      logger.error(`Failed to update transaction ${data.monarch.id}`, error);
      skipped++;
    }

    await progressStorage.patch({
      total: matches.length,
      complete: matches.indexOf(data) + 1,
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const duration = `${((Date.now() - (startTime || Date.now())) / 1000).toFixed(2)}s`;

  // Find unmatched Monarch transactions near split-invoice orders
  const matchedMonarchIds = new Set(matches.map(m => m.monarch.id));
  const unmatchedMonarch = transactions.transactions.filter(t => !matchedMonarchIds.has(t.id) && !t.notes);

  logToFile('\n🔍 Looking for split-invoice helper opportunities:');
  logToFile(`   Matched Monarch IDs: ${matchedMonarchIds.size}`);
  logToFile(`   Unmatched Monarch (no notes): ${unmatchedMonarch.length}`);
  console.log('\n🔍 Looking for split-invoice helper opportunities:');
  console.log(`   Matched Monarch IDs: ${matchedMonarchIds.size}`);
  console.log(`   Unmatched Monarch (no notes): ${unmatchedMonarch.length}`);
  unmatchedMonarch.forEach(t => {
    const line = `      $${t.amount} on ${t.date}`;
    console.log(line);
    logToFile(line);
  });

  // Find orders with multiple PDFs
  const splitInvoiceOrders = transactions.orders.filter(o => o.invoiceUrls && o.invoiceUrls.length > 1);
  logToFile(`   Orders with multiple PDFs: ${splitInvoiceOrders.length}`);
  console.log(`   Orders with multiple PDFs: ${splitInvoiceOrders.length}`);
  splitInvoiceOrders.forEach(o => {
    const line = `      Order ${o.id}: ${o.invoiceUrls?.length} PDFs, date: ${o.date}`;
    console.log(line);
    logToFile(line);
  });

  // Try to add helper notes for likely matches
  let helperNotesAdded = 0;
  for (const order of splitInvoiceOrders) {
    const orderDate = new Date(order.date).getTime();
    if (isNaN(orderDate)) continue;

    // Find Monarch transactions within ±7 days
    const candidates = unmatchedMonarch.filter(t => {
      const tDate = new Date(t.date).getTime();
      if (isNaN(tDate)) return false;

      const daysDiff = Math.abs(tDate - orderDate) / (1000 * 60 * 60 * 24);
      const orderTotal = order.transactions[0]?.amount || 0;
      const withinDateRange = daysDiff <= 7;
      const amountMakesSense = Math.abs(t.amount) <= Math.abs(orderTotal) * 1.1;

      const checkLine = `      Checking Monarch $${t.amount} (${t.date}): days=${daysDiff.toFixed(
        1,
      )}, amount ok=${amountMakesSense}, match=${withinDateRange && amountMakesSense}`;
      console.log(checkLine);
      logToFile(checkLine);

      return withinDateRange && amountMakesSense;
    });

    const foundLine = `   Found ${candidates.length} candidate(s) for order ${order.id}`;
    console.log(foundLine);
    logToFile(foundLine);

    // Add helper note to top 2 candidates (most likely matches)
    const topCandidates = candidates.slice(0, 2);

    for (const candidate of topCandidates) {
      try {
        const helperNote = `⚠️ POSSIBLE SPLIT INVOICE - VERIFY MANUALLY

This may be part of Amazon order:
Order #: ${order.id}
Order Date: ${order.date}
Order Total: $${Math.abs(order.transactions[0]?.amount || 0).toFixed(2)} (${order.items.length} items)

Your transaction: $${Math.abs(candidate.amount).toFixed(2)} (${candidate.date})

This order has ${order.invoiceUrls?.length} separate invoices.
One likely matches your transaction amount.

📄 Check Invoices:
${order.invoiceUrls?.map((url, i) => `${i + 1}. ${url}`).join('\n')}

💡 Open the PDFs to verify. If this matches:
   • Note which invoice matches
   • Enable "Override Transactions" in settings
   • Run sync again to get full item details`;

        await updateMonarchTransaction(appData.monarchKey, candidate.id, helperNote);
        helperNotesAdded++;
        logger.success(`Added helper note to transaction ${candidate.id}`, {
          monarchAmount: candidate.amount,
          amazonOrder: order.id,
          pdfCount: order.invoiceUrls?.length,
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Failed to add helper note to ${candidate.id}`, error);
      }
    }
  }

  logger.summary({
    'Amazon Orders': transactions.orders.length,
    'Monarch Transactions': transactions.transactions.length,
    'Matches Found': matches.length,
    Updated: updated,
    'Helper Notes Added': helperNotesAdded,
    'Skipped (already correct)': skipped - cachedSkips,
    'Skipped (cached)': cachedSkips,
    Duration: duration,
  });

  // Save final stats to file
  logFinalStats({
    amazonOrders: transactions.orders.length,
    monarchTransactions: transactions.transactions.length,
    matches: matches.length,
    updated,
    helperNotes: helperNotesAdded,
    skipped: skipped - cachedSkips,
    cached: cachedSkips,
    duration,
  });

  // Don't auto-download - user will click button when ready
  console.log(`\n✅ Sync complete! Click "Download Sync Trace" button to save detailed log.`);

  await logSyncComplete(
    {
      success: true,
      amazonOrders: transactions.orders.length,
      monarchTransactions: transactions.transactions.length,
      transactionsUpdated: matches.length,
      updated,
      skipped: skipped - cachedSkips,
      cached: cachedSkips,
      helperNotesAdded,
    },
    startTime,
  );
  await progressStorage.patch({ phase: ProgressPhase.Complete });

  return true;
}
