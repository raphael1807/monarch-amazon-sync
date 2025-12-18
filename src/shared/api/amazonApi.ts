import { ProgressPhase, updateProgress } from '../storages/progressStorage';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import * as Throttle from 'promise-parallel-throttle';
import { debugLog } from '../storages/debugStorage';
import { AuthStatus } from '../storages/appStorage';
import { logger } from '../utils/logger';
import { logToFile, logOrderProcessing, logPdfExtraction } from '../utils/fileLogger';

const ORDER_PAGES_URL = 'https://www.amazon.ca/gp/css/order-history?disableCsd=no-js';
const ORDER_RETURNS_URL = 'https://www.amazon.ca/spr/returns/cart';
const ORDER_INVOICE_URL = 'https://www.amazon.ca/gp/css/summary/print.html';
const ORDER_INVOICE_POPOVER_URL = 'https://www.amazon.ca/your-orders/invoice/popover';
const AMAZON_BASE_URL = 'https://www.amazon.ca';

export type AmazonInfo = {
  status: AuthStatus;
  startingYear?: number;
};

// Orders are placed on a single date, but can be paid for with multiple transactions
export type Order = {
  id: string;
  date: string;
  items: Item[];
  transactions: OrderTransaction[];
  invoiceUrls?: string[]; // PDF invoice URLs
};

export type Item = {
  quantity: number;
  title: string;
  price: number;
};

export type OrderTransaction = {
  id: string;
  amount: number;
  date: string;
  refund: boolean;
};

export async function checkAmazonAuth(): Promise<AmazonInfo> {
  try {
    logger.step('Checking Amazon.ca authentication');
    debugLog('Checking Amazon auth');
    const res = await fetch(ORDER_PAGES_URL);
    await debugLog('Got Amazon auth response' + res.status);
    logger.info('Amazon response received', { status: res.status, url: ORDER_PAGES_URL });

    const text = await res.text();
    const $ = load(text);

    const signIn = $('h1:contains("Sign in")');

    if (signIn.length > 0) {
      await debugLog('Amazon auth failed');
      logger.warning('Amazon sign-in page detected - not logged in');
      return {
        status: AuthStatus.NotLoggedIn,
      };
    }

    const yearOptions: string[] = [];
    $('#time-filter')
      .find('option')
      .each((_, el) => {
        if ($(el).attr('value')?.includes('year')) {
          yearOptions.push(el.attribs.value?.trim().replace('year-', ''));
        }
      });
    // find the lowest year
    const lowestYear = Math.min(...yearOptions.map(x => parseInt(x)));

    await debugLog('Amazon auth success');
    logger.success('Amazon authenticated', { oldestYear: lowestYear, yearsAvailable: yearOptions.length });
    return {
      status: AuthStatus.Success,
      startingYear: lowestYear,
    };
  } catch (e) {
    await debugLog('Amazon auth failed with error: ' + e);
    logger.error('Amazon authentication failed', e);
    return {
      status: AuthStatus.Failure,
    };
  }
}

export async function fetchOrders(year: number | undefined): Promise<Order[]> {
  let url = ORDER_PAGES_URL;
  if (year) {
    url += `&timeFilter=year-${year}`;
  }

  logger.step('Fetching orders from Amazon.ca', { year: year || 'Current', url });
  await debugLog('Fetching orders from ' + url);
  const res = await fetch(url);
  await debugLog('Got orders response ' + res.status);
  logger.info('Amazon page loaded', { status: res.status });

  const text = await res.text();
  const $ = load(text);

  let endPage = 1;
  $('.a-pagination li').each((_, el) => {
    const page = $(el).text().trim();
    if (!Number.isNaN(page)) {
      const numPage = parseInt(page);
      if (numPage > endPage) {
        endPage = numPage;
      }
    }
  });

  logger.info('Pagination detected', { totalPages: endPage });
  await updateProgress(ProgressPhase.AmazonPageScan, endPage, 0);

  let orderCards = orderCardsFromPage($);
  await debugLog('Found ' + orderCards.length + ' orders');
  logger.success(`Page 1: Found ${orderCards.length} orders`);

  await updateProgress(ProgressPhase.AmazonPageScan, endPage, 1);

  for (let i = 2; i <= endPage; i++) {
    const ordersPage = await processOrders(year, i);
    logger.info(`Page ${i}: Found ${ordersPage.length} orders`);
    orderCards = orderCards.concat(ordersPage);
    await updateProgress(ProgressPhase.AmazonPageScan, endPage, i);
  }

  logger.success('All pages scanned', { totalOrders: orderCards.length, pages: endPage });

  const allOrders: Order[] = [];

  const processOrder = async (orderCard: OrderCard) => {
    try {
      const orderData = await fetchOrderDataFromInvoice(orderCard.id);
      if (orderCard.hasRefund) {
        const refundData = await fetchRefundTransactions(orderCard.id);
        if (refundData) {
          orderData.transactions = orderData.transactions.concat(refundData);
        }
      }
      if (orderData) {
        allOrders.push(orderData);
        if (allOrders.length % 5 === 0) {
          logger.info(`Downloaded ${allOrders.length}/${orderCards.length} order details`);
        }
      }
    } catch (e: unknown) {
      await debugLog(e);
      logger.error(`Failed to process order ${orderCard.id}`, e);
    }

    await updateProgress(ProgressPhase.AmazonOrderDownload, orderCards.length, allOrders.length);
  };

  await Throttle.all(orderCards.map(orderCard => () => processOrder(orderCard)));

  logger.success('All order details downloaded', {
    total: allOrders.length,
    withItems: allOrders.filter(o => o.items.length > 0).length,
    withTransactions: allOrders.filter(o => o.transactions.length > 0).length,
  });

  console.log(allOrders);

  return allOrders;
}

async function processOrders(year: number | undefined, page: number) {
  const index = (page - 1) * 10;
  let url = ORDER_PAGES_URL + '&startIndex=' + index;
  if (year) {
    url += `&timeFilter=year-${year}`;
  }
  await debugLog('Fetching orders from ' + url);
  const res = await fetch(url);
  await debugLog('Got orders response ' + res.status + ' for page ' + page);
  const text = await res.text();
  const $ = load(text);
  return orderCardsFromPage($);
}

type OrderCard = {
  id: string;
  hasRefund: boolean;
};

// Returns a list of order IDs on the page and whether the order contains a refund
function orderCardsFromPage($: CheerioAPI): OrderCard[] {
  const orders: OrderCard[] = [];
  $('.js-order-card').each((_, el) => {
    try {
      const id = $(el)
        .find('a[href*="orderID="]')
        ?.attr('href')
        ?.replace(/.*orderID=([^&#]+).*/, '$1');
      if (id) {
        const hasRefund = $(el).find('span:contains("Return complete"), span:contains("Refunded")').length > 0;
        orders.push({ id, hasRefund });
      }
    } catch (e: unknown) {
      debugLog(e);
    }
  });
  return orders;
}

async function fetchRefundTransactions(orderId: string): Promise<OrderTransaction[]> {
  await debugLog('Fetching refund details for ' + orderId);
  logger.step('Checking for refunds', { orderId });

  const res = await fetch(ORDER_RETURNS_URL + '?orderID=' + orderId);
  await debugLog('Got refund page response ' + res.status + ' for order ' + orderId);
  const text = await res.text();
  const $ = load(text);

  // Parse refund transactions
  const transactions: OrderTransaction[] = [];
  $('span.a-color-secondary:contains("refund issued on"), span:contains("remboursement émis")').each((_, el) => {
    const refundLine = $(el).text();
    const refundAmount = refundLine.split(/refund|remboursement/i)[0].trim();
    const refundDate = refundLine.split(/on|le/i)[1]?.replace('.', '').trim();

    if (refundDate) {
      const amount = moneyToNumber(refundAmount);
      transactions.push({
        id: orderId,
        date: refundDate,
        amount: amount,
        refund: true,
      });

      logger.success('Refund found', { orderId, amount, date: refundDate });
    }
  });

  if (transactions.length === 0) {
    logger.info('No refunds found for order', { orderId });
  }

  return transactions;
}

async function fetchOrderDataFromInvoice(orderId: string): Promise<Order> {
  logger.step('📄 Processing order invoice', { orderId });

  const res = await fetch(ORDER_INVOICE_URL + '?orderID=' + orderId);
  logger.info('HTML invoice loaded', { status: res.status });

  const text = await res.text();
  const $ = load(text);

  // Amazon.ca uses data-component attributes for the new order details page
  // Extract date from data-component="orderDate"
  let date = $('[data-component="orderDate"] span')
    .first()
    .text()
    .trim()
    .replace(/\s*<i.*<\/i>\s*/g, ''); // Remove separator icons

  // Fallback: Try old format if date not found
  if (!date) {
    const dateElement =
      $('td b:contains("Order Placed:")').length > 0
        ? $('td b:contains("Order Placed:")')
        : $('td b:contains("Commande effectuée")'); // French

    date = dateElement
      .parent()
      .contents()
      .filter(function () {
        return this.type === 'text';
      })
      .text()
      .trim();
  }

  const order = {
    id: orderId,
    date: date,
  };
  console.log(order);

  const items: Item[] = [];
  const transactions: OrderTransaction[] = [];

  // Extract items from data-component="itemTitle" and data-component="unitPrice"
  $('[data-component="itemTitle"]').each((i, el) => {
    const itemName = $(el).find('a').text().trim();

    // Find the corresponding price element (next unitPrice component)
    const priceEl = $(el)
      .closest('.a-fixed-left-grid')
      .find('[data-component="unitPrice"] .a-price .a-offscreen')
      .first();

    const priceText = priceEl.text().trim();

    if (itemName && priceText) {
      items.push({
        quantity: 1, // Amazon.ca doesn't show quantity in this view, defaulting to 1
        title: itemName,
        price: moneyToNumber(priceText),
      });
    }
  });

  // Fallback: Try old table-based format if no items found
  if (items.length === 0) {
    const itemsSection =
      $('#pos_view_section:contains("Items Ordered")').length > 0
        ? $('#pos_view_section:contains("Items Ordered")')
        : $('#pos_view_section:contains("Articles commandés")');

    itemsSection
      .find('table')
      .find('table')
      .find('table')
      .find('table')
      .each((i, table) => {
        $(table)
          .find('tbody tr')
          .each((j, tr) => {
            if (j === 0) return;

            const quantity = $(tr)
              .find('td')
              .eq(0)
              .contents()
              .filter(function () {
                return this.type === 'text';
              })
              .text()
              .replace('of:', '')
              .trim();
            const item = $(tr).find('td').eq(0).find('i').text().trim();
            const price = $(tr).find('td').eq(1).text().trim();
            if (item && price) {
              items.push({
                quantity: parseInt(quantity) || 1,
                title: item,
                price: moneyToNumber(price),
              });
            }
          });
      });
  }

  // Extract total amount (use "Montant total" or "Total")
  const totalElement =
    $('span:contains("Montant total pour ces articles")').length > 0
      ? $('span:contains("Montant total pour ces articles")')
      : $('span:contains("Total")');

  const totalText = totalElement.closest('.a-row').find('.a-text-bold').last().text().trim();

  if (totalText) {
    transactions.push({
      id: orderId,
      amount: moneyToNumber(totalText),
      date: order.date,
      refund: false,
    });
  }

  // Find any gift card transactions (English and French)
  const giftCardElement =
    $('td:contains("Gift Card Amount")').length > 0
      ? $('td:contains("Gift Card Amount")')
      : $('td:contains("Montant de la carte-cadeau")'); // French

  const giftCardAmount = moneyToNumber(giftCardElement.siblings().last().text());
  if (giftCardAmount) {
    transactions.push({
      id: orderId,
      date: order.date,
      amount: giftCardAmount * -1,
      refund: false,
    });
  }

  // Try old credit card transaction format as fallback
  if (transactions.length === 0) {
    const creditCardSection =
      $("div:contains('Credit Card transactions')").length > 0
        ? $("div:contains('Credit Card transactions')")
        : $("div:contains('Transactions par carte de crédit')");

    creditCardSection
      .parent()
      .siblings()
      .last()
      .find('tr')
      .each((i, tr) => {
        const transactionDate = $(tr).find('td:first').text().trim().split(':')[1]?.replace(':', '').trim();
        const total = $(tr).find('td:last').text().trim();
        if (transactionDate && total) {
          transactions.push({
            id: orderId,
            amount: moneyToNumber(total),
            date: transactionDate,
            refund: false,
          });
        }
      });
  }

  // Extract invoice PDF URLs from the page
  const invoiceUrls: string[] = [];

  // Look for invoice download links (usually in a dropdown or links section)
  $('a[href*="/documents/download/"], a[href*="invoice.pdf"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('invoice.pdf')) {
      const fullUrl = href.startsWith('http') ? href : `https://www.amazon.ca${href}`;
      invoiceUrls.push(fullUrl);
    }
  });

  // Fallback: try to construct invoice URLs based on common patterns
  if (invoiceUrls.length === 0) {
    // Check for data attributes or script tags that might contain invoice URLs
    const scripts = $('script:contains("invoice")');
    scripts.each((i, el) => {
      const scriptContent = $(el).html() || '';
      const matches = scriptContent.match(/\/documents\/download\/[\w-]+\/invoice\.pdf/g);
      if (matches) {
        matches.forEach(match => {
          invoiceUrls.push(`https://www.amazon.ca${match}`);
        });
      }
    });
  }

  logger.info(`HTML extraction complete`, {
    orderId,
    items: items.length,
    transactions: transactions.length,
    pdfLinks: invoiceUrls.length,
  });

  // Log to file
  logOrderProcessing(orderId, items.length, transactions.length, invoiceUrls.length);

  // Always show transactions found (important for debugging)
  transactions.forEach((t, i) => {
    const line = `  💳 ${i + 1}. $${t.amount} on ${t.date}${t.refund ? ' (REFUND)' : ''}`;
    console.log(line);
    logToFile(line);
  });

  // Check if we should fetch additional PDF invoices
  // Trigger if: no transactions found OR multiple items with single transaction
  const shouldFetchPdfs = transactions.length === 0 || (items.length > 1 && transactions.length === 1);

  if (shouldFetchPdfs) {
    logger.warning('⚠️  Possible split invoices detected', {
      items: items.length,
      transactions: transactions.length,
      reason: transactions.length === 0 ? 'No transactions found' : 'Multiple items but single transaction',
    });

    console.log('🔍 Triggering PDF invoice popover fetch...');
    const pdfResult = await fetchTransactionsFromInvoicePopover(orderId);

    // Save PDF URLs to order object for later use
    if (pdfResult.pdfUrls.length > 0) {
      invoiceUrls.push(...pdfResult.pdfUrls);
      logger.success(`✅ Found ${pdfResult.pdfUrls.length} PDF URL(s) - will be added to notes`);
    }

    if (pdfResult.transactions.length > 0) {
      transactions.push(...pdfResult.transactions);
      logger.success(`✅ Added ${pdfResult.transactions.length} transaction(s) from PDF invoices`);
    } else {
      logger.warning('⚠️  No additional transactions found from PDF invoices');
    }
  } else {
    console.log('✅ HTML extraction sufficient - skipping PDF fetch');
  }

  // Summary for ALL orders (important for debugging)
  console.log(`\n📊 ORDER: ${orderId} | ${items.length} items → ${transactions.length} transactions`);
  if (transactions.length > 1) {
    transactions.forEach((t, i) => {
      console.log(`   ${i + 1}. $${t.amount} on ${t.date}`);
    });
    console.log(''); // Extra line for readability
  }

  return {
    ...order,
    transactions,
    items,
    invoiceUrls: invoiceUrls.length > 0 ? invoiceUrls : undefined,
  };
}

async function fetchInvoicePopover(orderId: string): Promise<string> {
  logger.step('🔍 Fetching invoice popover', { orderId });
  const res = await fetch(ORDER_INVOICE_POPOVER_URL + '?orderId=' + orderId);

  if (!res.ok) {
    logger.error('Failed to fetch popover', { status: res.status });
    return '';
  }

  logger.success('Invoice popover fetched', { status: res.status });
  return await res.text();
}

function extractPdfLinks(popoverHtml: string): string[] {
  logger.info('Searching for PDF links in popover...');
  const $ = load(popoverHtml);
  const pdfLinks: string[] = [];

  // Find all links ending in invoice.pdf or documents/download
  $('a[href*="invoice.pdf"], a[href*="documents/download"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const absoluteUrl = href.startsWith('http') ? href : AMAZON_BASE_URL + href;
      pdfLinks.push(absoluteUrl);
      console.log(`  📎 Found PDF: ${absoluteUrl.substring(absoluteUrl.length - 50)}`);
    }
  });

  logger.info(`Found ${pdfLinks.length} PDF link(s)`);
  return pdfLinks;
}

// PDF parsing functions removed - Service Workers don't support PDF.js
// Instead we extract PDF URLs and add them to transaction notes for manual review

async function fetchTransactionsFromInvoicePopover(orderId: string): Promise<{
  transactions: OrderTransaction[];
  pdfUrls: string[];
}> {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CHECKING FOR MULTIPLE PDF INVOICES');
    console.log('='.repeat(60));
    logToFile('\n🔍 PDF EXTRACTION STARTED');

    const popoverHtml = await fetchInvoicePopover(orderId);
    if (!popoverHtml) {
      logger.warning('Empty popover response');
      return { transactions: [], pdfUrls: [] };
    }

    const pdfLinks = extractPdfLinks(popoverHtml);

    if (pdfLinks.length === 0) {
      logger.warning('No PDF invoices found in popover');
      return { transactions: [], pdfUrls: [] };
    }

    logger.success(`📎 Found ${pdfLinks.length} PDF invoice(s)`);
    logPdfExtraction(orderId, pdfLinks.length);

    // PDF parsing is not supported in Service Workers
    // Instead, we'll return the PDF URLs so they can be saved to the order
    logger.warning('⚠️  PDF parsing not supported in Service Workers');
    logToFile(`   ⚠️  Cannot parse PDFs in Service Worker - PDF URLs will be added to notes`);
    console.log('   ℹ️  PDF URLs will be added to transaction notes for manual review');

    // Return the PDF URLs so they can be saved to order.invoiceUrls
    return { transactions: [], pdfUrls: pdfLinks };
  } catch (e) {
    logger.error('Failed to process invoice popover', e);
    return { transactions: [], pdfUrls: [] };
  }
}

export function moneyToNumber(money: string, absoluteValue = true) {
  if (!money) return 0;

  // Handle French format: replace comma with dot for decimal
  // "106,89 $" → "106.89"
  let cleaned = money.replace(/[$\s]/g, ''); // Remove $ and spaces

  // Replace comma with dot (French decimal separator)
  cleaned = cleaned.replace(',', '.');

  // Handle minus sign
  if (absoluteValue) {
    cleaned = cleaned.replace(/-/g, '');
  }

  const result = parseFloat(cleaned);
  console.log(`💰 Parsed amount: "${money}" → ${result}`);
  return result;
}
