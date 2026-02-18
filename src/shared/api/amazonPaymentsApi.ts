import { load } from 'cheerio';
import { logger } from '../utils/logger';
import { debugLog } from '../storages/debugStorage';

const PAYMENTS_URL = 'https://www.amazon.com/cpe/yourpayments/transactions';

export type PaymentTransaction = {
  date: string; // ISO date string (YYYY-MM-DD)
  card: string; // e.g. "Mastercard ****1673"
  amount: number; // absolute value
  currency: 'CAD' | 'USD';
  isRefund: boolean;
  orderId: string; // e.g. "112-1783946-8956267"
  orderUrl: string; // full URL to order details
  merchant: string; // e.g. "AMZN Mktp US", "Amazon.ca"
  marketplace: 'ca' | 'com' | 'unknown';
};

export type PaymentsPageResult = {
  transactions: PaymentTransaction[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPageFormData: PaginationFormData | null;
};

type PaginationFormData = {
  action: string;
  widgetState: string;
  eventName: string;
};

export async function checkPaymentsPageAuth(): Promise<boolean> {
  try {
    logger.step('Checking Amazon.com payments page auth');
    const res = await fetch(PAYMENTS_URL);
    const text = await res.text();
    const $ = load(text);

    const signIn = $('h1:contains("Sign in"), h1:contains("Sign-In")');
    if (signIn.length > 0) {
      logger.warning('Amazon.com payments page - not logged in');
      return false;
    }

    const hasTransactions = $('.apx-transactions-line-item-component-container').length > 0;
    if (hasTransactions) {
      logger.success('Amazon.com payments page authenticated');
      return true;
    }

    logger.warning('Amazon.com payments page - no transactions found (may not be logged in)');
    return false;
  } catch (e) {
    logger.error('Failed to check payments page auth', e);
    return false;
  }
}

export function parsePaymentsPage(html: string): PaymentsPageResult {
  const $ = load(html);
  const transactions: PaymentTransaction[] = [];

  let currentDate = '';

  // Walk through the transaction container in DOM order
  // Dates and line items are siblings within the main box
  const mainBox = $('div.a-box.a-spacing-base > div.a-box-inner.a-padding-none');

  mainBox.children('div').each((_, el) => {
    const $el = $(el);

    // Check if this is a date container
    if ($el.hasClass('apx-transaction-date-container') || $el.find('.apx-transaction-date-container').length > 0) {
      const dateEl = $el.hasClass('apx-transaction-date-container') ? $el : $el.find('.apx-transaction-date-container');
      const rawDate = dateEl.find('span').first().text().trim();
      if (rawDate) {
        currentDate = parseAmazonDate(rawDate);
      }
      return;
    }

    // Check for line item containers within this section
    const lineItems = $el.find('.apx-transactions-line-item-component-container');
    if (lineItems.length === 0) return;

    lineItems.each((_, item) => {
      const $item = $(item);
      const tx = parseLineItem($, $item, currentDate);
      if (tx) {
        transactions.push(tx);
      }
    });
  });

  // Parse pagination
  const { hasNextPage, hasPreviousPage, nextPageFormData } = parsePagination($);

  logger.info(`Parsed ${transactions.length} transactions from payments page`, {
    cadCount: transactions.filter(t => t.currency === 'CAD').length,
    usdCount: transactions.filter(t => t.currency === 'USD').length,
    refundCount: transactions.filter(t => t.isRefund).length,
    hasNextPage,
  });

  return { transactions, hasNextPage, hasPreviousPage, nextPageFormData };
}

function parseLineItem(
  $: ReturnType<typeof load>,
  $item: ReturnType<ReturnType<typeof load>>,
  currentDate: string,
): PaymentTransaction | null {
  // Card name: span.a-size-base.a-text-bold inside a-span9
  const card = $item.find('.a-column.a-span9 span.a-size-base.a-text-bold').first().text().trim();

  // Amount: span.a-size-base-plus.a-text-bold inside a-span3
  const amountText = $item.find('.a-column.a-span3 span.a-size-base-plus.a-text-bold').first().text().trim();

  // Order link: a.a-link-normal with href containing orderID
  const orderLink = $item.find('a.a-link-normal[href*="orderID"]').first();
  const orderText = orderLink.text().trim();
  const orderUrl = orderLink.attr('href') || '';

  // Merchant: last span.a-size-base (not bold)
  const merchant = $item.find('span.a-size-base').not('.a-text-bold').last().text().trim();

  if (!amountText || !orderText) return null;

  const { amount, currency, isRefund } = parseAmount(amountText);
  const orderId = extractOrderId(orderUrl, orderText);
  const marketplace = detectMarketplace(orderUrl, merchant);

  return {
    date: currentDate,
    card,
    amount,
    currency,
    isRefund: isRefund || orderText.toLowerCase().startsWith('refund'),
    orderId,
    orderUrl: orderUrl.startsWith('http') ? orderUrl : `https://www.amazon.com${orderUrl}`,
    merchant,
    marketplace,
  };
}

function parseAmount(text: string): { amount: number; currency: 'CAD' | 'USD'; isRefund: boolean } {
  const isRefund = text.startsWith('+');
  const isCAD = text.includes('CA$');
  const currency: 'CAD' | 'USD' = isCAD ? 'CAD' : 'USD';

  const cleaned = text.replace(/[+\-CA$,]/g, '').trim();
  const amount = parseFloat(cleaned) || 0;

  return { amount, currency, isRefund };
}

function extractOrderId(url: string, text: string): string {
  // Try URL first: ?orderID=xxx
  const urlMatch = url.match(/orderID=([^&#]+)/);
  if (urlMatch) return urlMatch[1];

  // Try text: "Order #xxx" or "Refund: Order #xxx"
  const textMatch = text.match(/#(\S+)/);
  if (textMatch) return textMatch[1];

  return '';
}

function detectMarketplace(orderUrl: string, merchant: string): 'ca' | 'com' | 'unknown' {
  if (orderUrl.includes('amazon.ca')) return 'ca';
  if (orderUrl.includes('amazon.com')) return 'com';

  const lowerMerchant = merchant.toLowerCase();
  if (lowerMerchant.includes(' ca') || lowerMerchant.includes('amazon.ca')) return 'ca';
  if (lowerMerchant.includes(' us') || lowerMerchant.includes('amazon retail')) return 'com';

  return 'unknown';
}

function parseAmazonDate(dateStr: string): string {
  // "March 22, 2025" → "2025-03-22"
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

function parsePagination($: ReturnType<typeof load>): {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPageFormData: PaginationFormData | null;
} {
  const form = $('form[action*="yourpayments/transactions"]');
  if (form.length === 0) {
    return { hasNextPage: false, hasPreviousPage: false, nextPageFormData: null };
  }

  const widgetState = (form.find('input[name="ppw-widgetState"]').val() as string) || '';
  const action = form.attr('action') || PAYMENTS_URL;

  const nextButton = form.find('input[name*="DefaultNextPageNavigationEvent"]');
  const prevButton = form.find('input[name*="DefaultPreviousPageNavigationEvent"]');

  const hasNextPage = nextButton.length > 0;
  const hasPreviousPage = prevButton.length > 0;

  let nextPageFormData: PaginationFormData | null = null;
  if (hasNextPage) {
    nextPageFormData = {
      action,
      widgetState,
      eventName: nextButton.attr('name') || '',
    };
  }

  return { hasNextPage, hasPreviousPage, nextPageFormData };
}

/**
 * Load a URL in a background tab, wait for it to load, then ask the
 * content script (amazonComExtractor.js) to send back the HTML.
 */
async function fetchHtmlViaTab(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }, tab => {
      if (!tab?.id) {
        reject(new Error('Failed to create tab'));
        return;
      }

      const tabId = tab.id;
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        reject(new Error('Tab load timeout (30s)'));
      }, 30000);

      const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);

        // Small delay to let content script initialize
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_HTML' }, response => {
            chrome.tabs.remove(tabId).catch(() => {});
            if (chrome.runtime.lastError) {
              reject(new Error('Content script not ready: ' + chrome.runtime.lastError.message));
              return;
            }
            if (response?.html) {
              resolve(response.html);
            } else {
              reject(new Error('No HTML received from content script'));
            }
          });
        }, 500);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

export async function fetchPaymentsPage(): Promise<PaymentsPageResult> {
  logger.step('Fetching Amazon payments page via tab');
  await debugLog('Fetching payments page via tab: ' + PAYMENTS_URL);

  try {
    const html = await fetchHtmlViaTab(PAYMENTS_URL);
    logger.info('Payments page loaded via tab', { size: html.length });
    return parsePaymentsPage(html);
  } catch (err) {
    logger.error('Failed to fetch payments page via tab', err);
    return { transactions: [], hasNextPage: false, hasPreviousPage: false, nextPageFormData: null };
  }
}

/**
 * Fetch next page by opening a tab, injecting a form, submitting it,
 * and extracting HTML after navigation completes.
 */
export async function fetchNextPaymentsPage(formData: PaginationFormData): Promise<PaymentsPageResult> {
  logger.step('Fetching next payments page via tab form submit');

  return new Promise(resolve => {
    const empty: PaymentsPageResult = {
      transactions: [],
      hasNextPage: false,
      hasPreviousPage: false,
      nextPageFormData: null,
    };

    chrome.tabs.create({ url: formData.action, active: false }, tab => {
      if (!tab?.id) {
        resolve(empty);
        return;
      }

      const tabId = tab.id;
      let navigated = false;
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tabId).catch(() => {});
        resolve(empty);
      }, 30000);

      const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;

        if (!navigated) {
          // First load complete (the initial page). Now inject form and submit.
          navigated = true;
          setTimeout(() => {
            chrome.tabs.sendMessage(
              tabId,
              {
                action: 'SUBMIT_FORM',
                widgetState: formData.widgetState,
                eventName: formData.eventName,
              },
              () => {
                // Form submitted, wait for next page load via onUpdated
                if (chrome.runtime.lastError) {
                  logger.error('Form submit failed', chrome.runtime.lastError.message);
                  chrome.tabs.onUpdated.removeListener(onUpdated);
                  clearTimeout(timeout);
                  chrome.tabs.remove(tabId).catch(() => {});
                  resolve(empty);
                }
              },
            );
          }, 500);
          return;
        }

        // Second load complete (after form submit). Extract HTML.
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);

        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_HTML' }, response => {
            chrome.tabs.remove(tabId).catch(() => {});
            if (response?.html) {
              const result = parsePaymentsPage(response.html);
              logger.info('Next payments page loaded via tab', { transactions: result.transactions.length });
              resolve(result);
            } else {
              resolve(empty);
            }
          });
        }, 500);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

export async function fetchAllPaymentTransactions(maxPages = 20): Promise<PaymentTransaction[]> {
  const allTransactions: PaymentTransaction[] = [];

  let result = await fetchPaymentsPage();
  allTransactions.push(...result.transactions);
  logger.info(`Page 1: ${result.transactions.length} transactions`);

  let page = 1;
  while (result.hasNextPage && result.nextPageFormData && page < maxPages) {
    page++;
    result = await fetchNextPaymentsPage(result.nextPageFormData);
    allTransactions.push(...result.transactions);
    logger.info(`Page ${page}: ${result.transactions.length} transactions`);

    if (result.transactions.length === 0) {
      logger.warning('Empty page detected, stopping pagination');
      break;
    }
  }

  logger.success(`Fetched all payment transactions`, {
    totalTransactions: allTransactions.length,
    pages: page,
    cadTransactions: allTransactions.filter(t => t.currency === 'CAD').length,
    usdTransactions: allTransactions.filter(t => t.currency === 'USD').length,
    refunds: allTransactions.filter(t => t.isRefund).length,
  });

  return allTransactions;
}

/**
 * Fetch item titles from an order page on either Amazon.ca or Amazon.com.
 * Uses the print invoice page which has a simpler, more parseable layout.
 */
export async function fetchOrderItems(
  orderId: string,
  marketplace: 'ca' | 'com' | 'unknown',
): Promise<{ items: string[]; orderDate: string }> {
  const baseUrl =
    marketplace === 'com'
      ? 'https://www.amazon.com/gp/css/summary/print.html'
      : 'https://www.amazon.ca/gp/css/summary/print.html';

  logger.step(`Fetching order items from ${marketplace}`, { orderId });

  try {
    let html: string;

    if (marketplace === 'com') {
      html = await fetchHtmlViaTab(`${baseUrl}?orderID=${orderId}`);
    } else {
      const res = await fetch(`${baseUrl}?orderID=${orderId}`);
      if (!res.ok) {
        logger.warning(`Order page returned ${res.status}`, { orderId });
        return { items: [], orderDate: '' };
      }
      html = await res.text();
    }

    const $ = load(html);

    const items: string[] = [];

    // New format: data-component="itemTitle"
    $('[data-component="itemTitle"] a').each((_, el) => {
      const title = $(el).text().trim();
      if (title) items.push(title);
    });

    // Fallback: old table-based invoice format
    if (items.length === 0) {
      $('i').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 5 && !text.includes('Qty:')) {
          items.push(text);
        }
      });
    }

    // Extract order date
    let orderDate = '';
    const dateEl = $('[data-component="orderDate"] span').first().text().trim();
    if (dateEl) {
      orderDate = dateEl;
    } else {
      const oldDate = $('td b:contains("Order Placed:")')
        .parent()
        .contents()
        .filter(function () {
          return this.type === 'text';
        })
        .text()
        .trim();
      if (oldDate) orderDate = oldDate;
    }

    logger.info(`Order ${orderId}: found ${items.length} items`, { marketplace, orderDate });
    return { items, orderDate };
  } catch (e) {
    logger.error(`Failed to fetch order items for ${orderId}`, e);
    return { items: [], orderDate: '' };
  }
}

/**
 * Find a payment transaction matching a given amount and approximate date.
 * Used to match unmatched Monarch transactions to Amazon payment records.
 */
export function findMatchingPayment(
  payments: PaymentTransaction[],
  targetAmount: number,
  targetDate: string,
  toleranceDays = 3,
  amountTolerancePercent = 5,
): PaymentTransaction | null {
  const targetTime = new Date(targetDate).getTime();
  const toleranceMs = toleranceDays * 24 * 60 * 60 * 1000;

  // For cross-currency matching, allow a percentage tolerance on amount
  const amountTolerance = targetAmount * (amountTolerancePercent / 100);

  let bestMatch: PaymentTransaction | null = null;
  let bestAmountDiff = Infinity;

  for (const payment of payments) {
    if (payment.isRefund) continue;

    const paymentTime = new Date(payment.date).getTime();
    const timeDiff = Math.abs(paymentTime - targetTime);
    if (timeDiff > toleranceMs) continue;

    const amountDiff = Math.abs(payment.amount - targetAmount);
    if (amountDiff > amountTolerance) continue;

    if (amountDiff < bestAmountDiff) {
      bestAmountDiff = amountDiff;
      bestMatch = payment;
    }
  }

  return bestMatch;
}
