# Testing Guide: Multi-Invoice PDF Support

## ✅ Build Complete!

The extension has been successfully built with PDF invoice support.

## How to Test

### 1. Load the Extension

```bash
# The extension is already built in the dist/ folder
```

1. Open Chrome: `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select: `/Users/rapharemblay-bouchard/Desktop/rapha/code/monarch-amazon-sync/dist`

### 2. Open the Background Console (IMPORTANT!)

1. In `chrome://extensions/`, find **"Monarch Amazon Sync"**
2. Click **"background page"** or **"service worker"** (under "Inspect views")
3. **Keep this console open** - this is where all the detailed logs appear!

### 3. Run the Sync

1. Make sure you're logged into **Amazon.ca**
2. Click the extension icon in Chrome toolbar
3. Click **"Sync Transactions"**
4. **Watch the background console** (from step 2)

## What to Look For in the Console

### For Order 701-5875342-9445832 (Your Test Case):

```
============================================================
  📄 Processing order invoice
============================================================
ℹ️  HTML invoice loaded { status: 200 }
ℹ️  HTML extraction complete { orderId: '701-5875342-9445832', items: 2, transactions: 1, pdfLinks: 0 }
  💳 Transaction 1: $-106.89 on 7 décembre 2025

⚠️  ⚠️  Possible split invoices detected { items: 2, transactions: 1, reason: 'Multiple items but single transaction' }

============================================================
🔍 CHECKING FOR MULTIPLE PDF INVOICES
============================================================
🔍 Fetching invoice popover { orderId: '701-5875342-9445832' }
✅ Invoice popover fetched { status: 200 }
ℹ️  Searching for PDF links in popover...
  📎 Found PDF: ...f1c07fab-7d2f-4055-9f10-5f02158f8244/invoice.pdf
  📎 Found PDF: ...{another-id}/invoice.pdf
ℹ️  Found 2 PDF link(s)
✅ 📎 Found 2 PDF invoice(s) to process

📄 Processing PDF 1/2:
   URL: ...f1c07fab-7d2f-4055-9f10-5f02158f8244/invoice.pdf
ℹ️  ⬇️  Downloading PDF... { url: '...f1c07fab-7d2f-4055-9f10-5f02158f8244/invoice.pdf' }
✅ PDF downloaded { sizeKB: '45.2' }
ℹ️  📖 Parsing PDF document...
✅ Text extracted from PDF { pages: 2, chars: 1543 }
ℹ️  🔍 Parsing PDF text for transaction data...
  📝 PDF Preview: Invoice / Facture # Paid / Payé Sold by / Vendu par: ...
✅ Found amount in PDF: $72.41
✅ Found date in PDF: 08 December 2025
✅ PDF Transaction extracted { amount: -72.41, date: '08 December 2025' }

   ✅ SUCCESS: Extracted $-72.41 on 08 December 2025

📄 Processing PDF 2/2:
   ... (similar output for second PDF if exists)

============================================================
✅ PDF EXTRACTION COMPLETE: 1/2 successful
============================================================

✅ Added 1 transaction(s) from PDF invoices

📊 FINAL ORDER SUMMARY:
   Order: 701-5875342-9445832 (7 décembre 2025)
   Items: 2
   Transactions: 2
     1. $-106.89 on 7 décembre 2025
     2. $-72.41 on 08 December 2025  ← THIS IS FACTURE 2!
────────────────────────────────────────────────────────────
```

### Key Success Indicators:

1. ✅ **"Found 2 PDF link(s)"** - Multiple invoices detected
2. ✅ **"Extracted $-72.41 on 08 December 2025"** - Facture 2 parsed
3. ✅ **"Transactions: 2"** in final summary - Both invoices captured
4. ✅ **Monarch match** - The $72.41 transaction should now match

## What to Share With Me

### If It Works:
Copy and paste the **"FINAL ORDER SUMMARY"** section from the console, showing:
```
📊 FINAL ORDER SUMMARY:
   Order: 701-5875342-9445832 (...)
   Items: X
   Transactions: X
     1. $...
     2. $...
```

### If It Doesn't Work:

**Scenario A: No PDF links found**
```
⚠️  No PDF invoice links found
```
→ Share: The full console output + screenshot of the Amazon invoice popover

**Scenario B: PDF download fails**
```
❌ PDF download failed { status: 403 }
```
→ Share: The error message + the PDF URL

**Scenario C: Can't parse PDF**
```
❌ Could not find "Total payable / Total à payer" in PDF
  📝 PDF Preview: ... (first 200 chars)
```
→ Share: The "PDF Preview" line

**Scenario D: Date not found**
```
❌ Could not find date in PDF
```
→ Share: The full PDF parsing section

## Quick Debugging Commands

```bash
# Rebuild if you make changes
pnpm build

# Watch mode (auto-rebuild)
pnpm dev

# Check for errors
pnpm lint
```

## Expected Outcome

After successful sync:
1. Go to **Monarch → Transactions**
2. Find **December 9, 2025** transaction for **$72.41**
3. Notes should contain:
   ```
   1x LAFROI Men's 2-Pack Quick Dry... - $37.93
   1x LAFROI Men's Long Sleeve UPF 50+... - $34.48
   ```

## Pro Tips

- **Keep the background console open** during the entire sync
- **Scroll to the top** of the console to see the full log
- **Use Ctrl+F** to search for your order ID: `701-5875342-9445832`
- **Look for emojis**: 🔍 📄 ✅ ⚠️  ❌ make it easy to scan

Ready to test! 🚀

