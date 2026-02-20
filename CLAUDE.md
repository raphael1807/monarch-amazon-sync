# monarch-amazon-sync

Chrome/Firefox extension that syncs Amazon.ca orders with Monarch Money and auto-categorizes transactions.

## Tech Stack
- TypeScript + React (browser extension)
- Vite build system
- No backend — all logic runs in browser popup/background scripts

## Claude API Usage
- **File:** `src/shared/utils/aiCategorizer.ts`
- **Model:** `claude-haiku-4-5`
- **Method:** Direct fetch to `https://api.anthropic.com/v1/messages` (no SDK — browser extension context)
- **Header required:** `anthropic-dangerous-direct-browser-access: true`
- **Purpose:** Batch categorize Amazon transactions (15 per batch) for Monarch Money
- **API key:** User-provided via Settings UI, stored in browser local storage as `aiApiKey`

## Key Files
- `src/shared/utils/aiCategorizer.ts` — Claude API integration
- `src/pages/popup/CategorizeTab.tsx` — UI that triggers AI categorization
- `src/pages/popup/components/EnhancedSettings.tsx` — API key config
- `src/shared/storages/appStorage.ts` — Storage schema
- `src/shared/api/monarchApi.ts` — Monarch GraphQL API
