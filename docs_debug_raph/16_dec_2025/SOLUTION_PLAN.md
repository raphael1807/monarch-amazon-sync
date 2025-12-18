# PDF Parsing Challenge - Service Worker Limitations

## The Problem

Chrome extensions use **Service Workers** for background scripts, which have strict limitations:
- ❌ No `document` object
- ❌ No `window` object  
- ❌ No `import()` dynamic imports (in some contexts)
- ❌ No `Buffer` (Node.js only)
- ❌ No `URL.createObjectURL()` 
- ❌ PDF.js requires web workers or `document`

## What We've Tried

1. ✅ **pdf-parse** - Failed: Requires Node.js `Buffer`
2. ✅ **pdfjs-dist v4** - Failed: Uses top-level await
3. ✅ **pdfjs-dist v3 with dynamic import** - Failed: Service Worker restriction
4. ✅ **pdfjs-dist v3 with static import** - Failed: Requires `document`
5. ✅ **disableWorker option** - Failed: Still tries to create fake worker with `document`

## Solutions Available

### Option A: Use Invoice Popover HTML (Recommended)
- The popover might have invoice amounts visible in HTML
- Parse the HTML directly without touching PDFs
- **Pros**: Fast, no libraries needed
- **Cons**: Need to verify popover has the data

### Option B: Store PDF URLs Only (Workaround)
- Don't parse PDFs, just save the URLs
- User manually checks PDFs when needed
- **Pros**: Simple, no compatibility issues
- **Cons**: Not fully automatic

### Option C: Offload PDF Parsing (Complex)
- Use a content script or separate page to parse PDFs
- Send results back to service worker
- **Pros**: Would work
- **Cons**: Requires architecture changes

### Option D: External API (Overkill)
- Set up a simple parsing service
- Service worker sends PDF URL, gets back text
- **Pros**: Would definitely work
- **Cons**: Requires external infrastructure

## Recommended: Option A + B Hybrid

1. **Try popover HTML first** - scrape invoice amounts if visible
2. **Store PDF URLs** in notes as fallback
3. **Add warning** for orders with multiple invoices
4. **User can manually verify** using the PDF links

This gives you:
- ✅ Automatic matching when possible
- ✅ PDF links for manual review
- ✅ No Service Worker issues
- ✅ Works TODAY

## Current Status

Your order `701-5875342-9445832`:
- ✅ Detection works: Found 2 PDF invoices
- ✅ Download works: Got the PDFs
- ❌ Parsing fails: Service Worker limitation
- ⚠️ Missing: $72.41 transaction from Facture 2

## Next Steps

Let me implement the hybrid approach - should we:
1. Check if popover HTML has invoice amounts?
2. Or just store PDF URLs and mark as "needs manual review"?

What's your preference?

