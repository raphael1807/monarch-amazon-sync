# Versioning & Change Log

## Current: v2.0.0 — Full Comptabilite Automation

**Date:** 2026-02-20
**Branch:** `main` (merged from `feat/compta-full-automation`)
**Commit:** `ab43110`

### What's New
10-step accounting pipeline in the Compta tab that automates the entire travailleur autonome workflow:

| Step | Feature | Status |
|------|---------|--------|
| Step 0 | Amazon Sync trigger | Done |
| Step 1 | Auto-Categorize (merchant rules + keyword matching) | Done |
| Step 1.5 | Auto-Tag (expenses, revenues, insurance tax, tax rates, bills) | Done |
| Step 2 | Bills processor (TPS/TVQ back-calculation from tags) | Done |
| Step 3 | Expenses to Google Sheets | Done |
| Step 4 | Revenues to Google Sheets | Done |
| Step 5 | Dime calculator (10% of gross revenue) | Done |
| Step 6 | Investment snapshots (net worth, investments, cash) | Done |
| Step 7 | Backup CSV export | Done |
| Step 8 | Quarterly TPS/TVQ summary (Q1-Q4 acomptes provisionnels) | Done |

### Technical Details
- 24 files changed, 2,895 insertions
- 74 unit tests across 6 test files
- Preview mode (default ON) generates CSV before applying changes
- Google Apps Script for Sheets integration + Gmail invoice search
- Validated with 3 rounds of preview against 6,832 real transactions

### Files Added
- `src/pages/popup/ComptabiliteTab.tsx` — Pipeline UI (1,174 lines)
- `src/shared/utils/autoTagger.ts` — Expense/revenue/insurance/bill auto-tagging
- `src/shared/utils/merchantRules.ts` — 63+ merchant-to-category mappings
- `src/shared/utils/taxRateLearner.ts` — Learn merchant tax rates from history
- `src/shared/utils/billProcessor.ts` — TPS/TVQ back-calculation
- `src/shared/utils/quarterlyTaxCalculator.ts` — Quarterly tax summaries
- `src/shared/utils/emailInvoiceFetcher.ts` — Gmail receipt search
- `src/shared/utils/sheetsExporter.ts` — Transform transactions to Sheet rows
- `src/shared/utils/previewExporter.ts` — Preview CSV generation
- `src/shared/api/googleSheetsApi.ts` — POST helper for Apps Script
- `src/shared/storages/snapshotStorage.ts` — Investment snapshot storage
- `google-apps-script/Code.gs` — Sheets + Gmail Apps Script
- `test-utils/vitest.setup.js` — Test infrastructure
- 6 test files (`*.test.ts`)

### One-Time Setup Required
1. Deploy `google-apps-script/Code.gs` to Google Sheets (Extensions > Apps Script)
2. Paste the Apps Script URL in Compta tab settings

---

## v1.7.0 — Transaction Note Quality

**Date:** 2025
**Commit:** `362dcdb`

- Improved transaction note formatting
- Polished confidence display for exact amount matches
- Removed redundant order date on refund notes

---

## v1.6.0 — Status Headers + Sort Tab

**Date:** 2025
**Commit:** `979c7d5`

- Added status header to transaction notes (VERIFIED / VERIFY / REFUND)
- Auto-categorize tab with keyword matching, Claude AI, and tag fallback
- Amazon Payments Page fallback for US + split invoice matching

---

## v1.2.0 — Invoice URLs

**Date:** 2025
**Commit:** `1125249`

- Always include invoice URL for all transactions
- Fixed language prefix in invoice URLs

---

## v1.1.0 — PDF Invoices + Refunds

**Date:** 2025
**Commit:** `c215b50`

- PDF invoice URLs added to Monarch notes
- Enhanced refund handling
- Unmatched transactions display

---

## v1.0.0 — Complete UX Overhaul

**Date:** 2025
**Commit:** `da3cff0`

- Clean minimal UI
- Professional logging system
- French date parser
- Dry-run mode

---

## v0.4.0 — French Language Support

**Date:** 2025
**Commit:** `4092e70`

- French language support for Amazon.ca invoice parsing

---

## v0.3.x — Stability & Debugging

- v0.3.3: Detailed logging for troubleshooting
- v0.3.2: Support for new Monarch domain (app.monarch.com)
- v0.3.1: Debug message logging
- v0.3.0: Improved Amazon fetch using invoice

---

## v0.2.0 — Auth Improvements

**Commit:** `7e32edb`

- Improved Amazon auth
- Firefox compatibility work begun

---

## v0.1.x — Initial Releases

- v0.1.5: Error logging + missing Amazon order IDs
- v0.1.4: Debug logging
- v0.1.3: Error handling for Amazon fetch
- v0.1.2: Per-item amounts in notes
- v0.1.1: Improved alarm for syncing
- v0.1.0: Initial release

---

## Thread Name

```
✅ FEATURE other: comptabilite-full-automation
```
