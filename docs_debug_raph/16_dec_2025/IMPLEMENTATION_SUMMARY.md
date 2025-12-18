# Multi-Invoice Support Implementation

## Problem
Order `701-5875342-9445832` has 2 separate invoices (Facture 1 and Facture 2):
- **Facture 1**: Items shipped together
- **Facture 2**: $72.41 (shipped Dec 8, 2025)

The Monarch transaction ($72.41 on Dec 9) wasn't matching because the extension only parsed the HTML invoice summary, which missed Facture 2.

## Solution Implemented

### 1. Added PDF Parsing Support
- **Package**: `pdfjs-dist@3.11.174` (industry-standard PDF.js library)
- **Types**: `@types/pdfjs-dist@2.10.378`
- Runs in background script (no browser constraints in dev mode)

### 2. Enhanced Invoice Extraction Flow

#### New Functions Added to `amazonApi.ts`:

1. **`fetchInvoicePopover(orderId)`**
   - Fetches `/your-orders/invoice/popover?orderId={orderId}`
   - Returns HTML containing links to all invoices

2. **`extractPdfLinks(popoverHtml)`**
   - Parses popover HTML for PDF download links
   - Looks for: `invoice.pdf` and `documents/download` URLs
   - Converts relative URLs to absolute

3. **`downloadPdfAsArrayBuffer(url)`**
   - Downloads PDF as binary data
   - Uses native `fetch()` with session cookies

4. **`extractTextFromPdf(pdfData)`**
   - Uses `pdfjs-dist` to extract text from PDF
   - Processes all pages
   - Returns concatenated text

5. **`extractTransactionFromPdfText(pdfText, orderId)`**
   - Regex-based extraction:
     - **Amount**: `Total payable / Total à payer: $XX.XX`
     - **Date**: `Invoice date / Date de facturation: DD Month YYYY`
   - Returns `OrderTransaction` object

6. **`fetchTransactionsFromInvoicePopover(orderId)`**
   - Orchestrates the full flow:
     1. Fetch popover
     2. Extract PDF links
     3. Download each PDF (with 500ms delay between downloads)
     4. Parse transactions
   - Error handling: logs errors but continues with other PDFs

### 3. Language Support
- Fixed `Credit Card transactions` selector to support French:
  - English: `"div:contains('Credit Card transactions')"`
  - French: `"div:contains('Transactions de carte de crédit')"`

### 4. Smart PDF Download Logic
PDF parsing is triggered when:
```typescript
transactions.length === 0 || (items.length > 1 && transactions.length === 1)
```

**Meaning**:
- No transactions found in HTML, OR
- Multiple items but only one transaction (indicates split invoices)

This avoids downloading PDFs for every order (performance optimization).

## How It Works

### Before (Old Flow):
```
1. Fetch order list page
2. For each order:
   - Fetch HTML invoice summary
   - Parse items and transactions from HTML
   - Done
```

**Problem**: Missed Facture 2 because it's only in PDF format.

### After (New Flow):
```
1. Fetch order list page
2. For each order:
   - Fetch HTML invoice summary
   - Parse items and transactions from HTML
   - IF (no transactions OR multiple items with single transaction):
     a. Fetch invoice popover
     b. Extract PDF links (Facture 1, Facture 2, etc.)
     c. Download each PDF
     d. Parse PDF text for amount and date
     e. Add to transactions list
   - Done
```

## Matching Logic (Unchanged)

The matching algorithm in `matchUtil.ts` remains the same:
- **Date window**: ±7 days
- **Amount**: Exact match required
- **Priority**: Closest date within window

Now it will work because Facture 2 ($72.41, Dec 8) will be extracted and matched to Monarch ($72.41, Dec 9).

## Testing Recommendations

1. **Test with order `701-5875342-9445832`**:
   - Should now extract 2 transactions (Facture 1 + Facture 2)
   - Facture 2 ($72.41) should match Monarch transaction

2. **Test with single-invoice orders**:
   - Should NOT download PDFs (performance check)
   - Should work as before

3. **Test with no-match scenarios**:
   - Orders with gift cards
   - Orders with refunds
   - Orders with multiple shipments

## Performance Considerations

- **PDF downloads**: Only when needed (smart trigger)
- **Rate limiting**: 500ms delay between PDF downloads
- **Error handling**: Continues if one PDF fails
- **Logging**: Extensive debug logs for troubleshooting

## Files Modified

1. **`package.json`**: Added `pdfjs-dist` and `@types/pdfjs-dist`
2. **`src/shared/api/amazonApi.ts`**: 
   - Added 6 new functions
   - Enhanced `fetchOrderDataFromInvoice()` with PDF fallback
   - Fixed language support

## Next Steps

1. Run `pnpm install` (already done ✓)
2. Build extension: `pnpm build` (already done ✓)
3. Load extension in Chrome
4. Test sync with order `701-5875342-9445832`
5. Verify Facture 2 ($72.41) matches Monarch transaction

## Technical Notes

- **pdfjs-dist**: Uses CDN worker (`cdnjs.cloudflare.com`)
- **Text extraction**: Joins all text items with spaces
- **Regex patterns**: Support both English and French formats
- **Error resilience**: Each PDF is try-caught independently

