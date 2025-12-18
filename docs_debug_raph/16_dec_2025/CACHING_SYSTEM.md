# Transaction Caching System

## Problem Solved
Without caching, every sync would:
- Re-download all Amazon orders
- Re-match all transactions
- **Re-update ALL Monarch transactions** (even if unchanged)
- Take 5-10 minutes for 100+ transactions

## Solution: Smart Caching

### What Gets Cached
```typescript
{
  "monarch-txn-id-123": {
    noteHash: "a1b2c3d4...",      // SHA-256 hash of note content
    lastUpdated: 1734567890000,   // Unix timestamp
    amazonOrderId: "701-xxx",     // For reference
    amount: -72.41                // For debugging
  }
}
```

### How It Works

#### 1. Before Updating a Transaction:
```
1. Build the note content (items + invoice URLs)
2. Compute SHA-256 hash of the note
3. Check cache: Does this transaction ID exist?
   - NO → Update Monarch + cache it
   - YES → Compare hashes:
     - Same hash → SKIP (already processed)
     - Different hash → Update Monarch + update cache
```

#### 2. Override Mode:
- When "Override Transactions" is enabled in settings
- **Ignores cache** and updates everything
- Still updates cache after processing

#### 3. Auto-Cleanup:
- Runs at start of each sync
- Removes cache entries older than **30 days**
- Prevents cache from growing indefinitely

## Performance Impact

### First Sync (No Cache):
```
100 transactions → 100 API calls → ~50 seconds (500ms delay each)
```

### Second Sync (With Cache):
```
100 transactions → 0 API calls → ~2 seconds (just matching)
✅ 100% faster!
```

### Partial Changes:
```
100 transactions, 5 changed → 5 API calls → ~5 seconds
✅ 90% faster!
```

## Console Output

### Cache Hit (Skipped):
```
💾 Transaction abc123 already processed (cached) - skipping
```

### Cache Miss (Updating):
```
✅ Updated transaction 1/50 { monarchId: 'abc123', items: 2, hasInvoices: 1 }
```

### Cache Stats (At Start):
```
💾 Transaction cache { cached: 47, oldestDays: 12 }
🧹 Cleaned 3 old cache entries (>30 days)
```

### Final Summary:
```
┌─────────────────────────────┬────────┐
│ Amazon Orders               │ 26     │
│ Monarch Transactions        │ 52     │
│ Matches Found               │ 48     │
│ Updated                     │ 5      │
│ Skipped (already correct)   │ 3      │
│ Skipped (cached)            │ 40     │ ← CACHE WORKING!
│ Duration                    │ 8.23s  │
└─────────────────────────────┴────────┘
```

## Cache Invalidation

### Automatic:
- **30 days**: Old entries auto-deleted
- **Note changes**: If Amazon items change, hash changes → cache miss → updates

### Manual (Future Feature):
Add a "Clear Cache" button in settings:
```typescript
chrome.storage.local.remove('processedTransactions');
```

## Storage Location

- **Chrome Local Storage**: `chrome.storage.local`
- **Key**: `processedTransactions`
- **Size**: ~100 bytes per transaction
- **Limit**: Chrome allows 10MB (can cache ~100,000 transactions)

## What Gets Cached vs. What Doesn't

### ✅ Cached:
- Monarch transaction ID
- Note content hash
- Last update timestamp
- Amazon order ID (for reference)

### ❌ NOT Cached:
- Amazon orders (re-fetched each time)
- Monarch transactions (re-fetched each time)
- Match algorithm results (re-run each time)

**Why?** We want fresh data from both systems, but avoid redundant API calls to update notes that haven't changed.

## Edge Cases Handled

### 1. Amazon Items Change:
- User returns an item
- Amazon order now has fewer items
- Note content changes → Hash changes → Cache miss → Updates ✓

### 2. Invoice URLs Added:
- First sync: No PDF invoices found
- Second sync: PDF invoices now available
- Note content changes → Hash changes → Cache miss → Updates ✓

### 3. Override Mode:
- User enables "Override Transactions" in settings
- Cache is ignored
- All transactions update
- Cache is refreshed with new hashes ✓

### 4. Refunds:
- Refund transactions have "🔄 REFUND" prefix
- Different hash than original purchase
- Treated as separate cache entry ✓

## Debugging Cache Issues

### Check Cache Contents:
```javascript
// In background console:
chrome.storage.local.get('processedTransactions', (data) => {
  console.log('Cache:', data.processedTransactions);
  console.log('Total cached:', Object.keys(data.processedTransactions.processedTransactions).length);
});
```

### Clear Cache Manually:
```javascript
// In background console:
chrome.storage.local.remove('processedTransactions', () => {
  console.log('✅ Cache cleared!');
});
```

### Force Re-Update:
1. Go to extension settings
2. Enable "Override Transactions"
3. Run sync
4. Disable "Override Transactions"

## Future Enhancements

1. **UI Button**: "Clear Transaction Cache" in settings
2. **Cache Stats**: Show in UI (X transactions cached, oldest: Y days)
3. **Selective Clear**: Clear cache for specific date range
4. **Export/Import**: Backup and restore cache

## Technical Details

- **Hash Algorithm**: SHA-256 (first 16 chars)
- **Collision Probability**: ~1 in 10^19 (effectively zero)
- **Storage Format**: JSON in Chrome Local Storage
- **Thread-Safe**: Chrome storage API handles concurrency

