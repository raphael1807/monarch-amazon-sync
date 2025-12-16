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

async function logSyncComplete(payload: Partial<LastSync>, startTime?: number) {
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

  // Send browser notification
  if (syncData.success && syncData.transactionsUpdated > 0) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: syncData.dryRun ? '🔍 Dry-Run Complete' : '✓ Sync Complete!',
      message: `Found ${syncData.transactionsUpdated} matches! ${
        syncData.dryRun ? 'Click extension to download CSV.' : 'Check Monarch for updates.'
      }`,
      priority: 2,
    });
  } else if (!syncData.success) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: '❌ Sync Failed',
      message: syncData.failureReason || 'Unknown error occurred',
      priority: 2,
    });
  }
}

async function downloadAndStoreTransactions(yearString?: string, dryRun: boolean = false) {
  const startTime = Date.now();
  await debugStorage.set({ logs: [] });

  const appData = await appStorage.get();
  const year = yearString ? parseInt(yearString) : undefined;

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

  let startDate: Date;
  let endDate: Date;
  if (year) {
    startDate = new Date(year - 1, 11, 23);
    endDate = new Date(year + 1, 0, 8);
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    startDate.setDate(startDate.getDate() - 8);
    endDate = new Date();
    endDate.setDate(startDate.getDate() + 8);
  }

  logger.step('Fetching Monarch transactions', {
    merchant: appData.options.amazonMerchant,
    dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
  });

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

    logger.success('Matching complete', {
      amazonOrders: orders.length,
      monarchTransactions: monarchTransactions.length,
      matches: matches.length,
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

    logger.summary({
      Mode: 'DRY-RUN',
      'Amazon Orders': orders.length,
      'Monarch Transactions': monarchTransactions.length,
      'Matches Found': matches.length,
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

  return true;
}

async function updateMonarchTransactions(startTime?: number) {
  logger.header('LIVE SYNC - Updating Monarch Transactions');
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

  const matches = matchTransactions(
    transactions.transactions,
    transactions.orders,
    appData.options.overrideTransactions,
  );

  logger.step('Matching transactions', {
    amazonOrders: transactions.orders.length,
    monarchTransactions: transactions.transactions.length,
    matches: matches.length,
  });

  let updated = 0;
  let skipped = 0;

  for (const data of matches) {
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

    if (data.monarch.notes === itemString) {
      await debugLog('Transaction ' + data.monarch.id + ' already has correct note');
      logger.info(`Transaction ${data.monarch.id} already up to date - skipping`);
      skipped++;
      continue;
    }

    try {
      await updateMonarchTransaction(appData.monarchKey, data.monarch.id, itemString);
      await debugLog('Updated transaction ' + data.monarch.id + ' with note ' + itemString);
      updated++;

      logger.success(`Updated transaction ${updated}/${matches.length}`, {
        monarchId: data.monarch.id,
        items: data.items.length,
        confidence: `${data.confidence}%`,
      });
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

  logger.summary({
    'Amazon Orders': transactions.orders.length,
    'Monarch Transactions': transactions.transactions.length,
    'Matches Found': matches.length,
    Updated: updated,
    Skipped: skipped,
    Duration: `${((Date.now() - (startTime || Date.now())) / 1000).toFixed(2)}s`,
  });

  await logSyncComplete(
    {
      success: true,
      amazonOrders: transactions.orders.length,
      monarchTransactions: transactions.transactions.length,
      transactionsUpdated: matches.length,
    },
    startTime,
  );
  await progressStorage.patch({ phase: ProgressPhase.Complete });

  return true;
}
