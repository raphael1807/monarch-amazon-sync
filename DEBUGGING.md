# Debugging Guide - Monarch Amazon Sync (Canada 🇨🇦)

This guide explains how to access logs, interpret error messages, and debug issues with the extension.

---

## Table of Contents

1. [Quick Debug Checklist](#quick-debug-checklist)
2. [Accessing Logs](#accessing-logs)
3. [Understanding Log Messages](#understanding-log-messages)
4. [Common Error Patterns](#common-error-patterns)
5. [Chrome DevTools Guide](#chrome-devtools-guide)
6. [Network Debugging](#network-debugging)
7. [Reporting Issues](#reporting-issues)

---

## Quick Debug Checklist

When something goes wrong, check these in order:

```bash
✅ 1. Check extension popup - any error messages?
✅ 2. Open Chrome DevTools Console (F12)
✅ 3. Download debug logs from Options
✅ 4. Check Network tab for failed requests
✅ 5. Verify you're on amazon.ca (not .com)
✅ 6. Confirm both Amazon and Monarch show "Connected"
```

---

## Accessing Logs

### Method 1: Chrome DevTools Console (Real-Time)

**Best for:** Watching logs as they happen

1. **Open DevTools**: Press `F12` or `Cmd+Option+I` (Mac)
2. **Go to Console tab**
3. **Click extension icon** to trigger actions
4. **Watch logs appear** in real-time

**Log Format:**
```javascript
[timestamp] Message or object
```

### Method 2: Extension Debug Logs (Historical)

**Best for:** Reviewing what happened during a sync

1. **Click extension icon**
2. **Click "Options"** button
3. **Click "Download debug logs"**
4. **Open the downloaded .txt file**

**File contains:**
- All operations performed
- API responses
- Error messages
- Timestamps

### Method 3: Background Service Worker

**Best for:** Advanced debugging of background processes

1. Go to `chrome://extensions`
2. Find "Monarch / Amazon Sync"
3. Click **"service worker"** link (or "Inspect views: background page")
4. Console tab shows background logs

---

## Understanding Log Messages

### Amazon Connection Logs

#### ✅ Successful Connection

```javascript
"Checking Amazon auth"
"Got Amazon auth response 200"
"Amazon auth success"
```

**What it means:** Successfully connected to Amazon.ca, you're logged in.

#### ❌ Not Logged In

```javascript
"Checking Amazon auth"
"Got Amazon auth response 200"
"Amazon auth failed"
```

**What it means:** Reached Amazon but not logged in. Sign in page detected.

**Fix:** Log in to Amazon.ca and try again.

#### ❌ Connection Failure

```javascript
"Checking Amazon auth"
"Amazon auth failed with error: [error details]"
```

**Common errors:**
- `TypeError: Failed to fetch` - Network issue or CORS
- `403 Forbidden` - Amazon blocking requests
- `Timeout` - Amazon not responding

**Fix:**
- Check internet connection
- Try refreshing Amazon.ca page
- Clear cookies and re-login
- Wait a few minutes (Amazon may be rate-limiting)

---

### Amazon Order Fetching Logs

#### ✅ Successful Order Fetch

```javascript
"Fetching orders from https://www.amazon.ca/gp/css/order-history?timeFilter=year-2024"
"Got orders response 200"
"Found 15 orders"
"Fetching order invoice 123-4567890-1234567"
"Got order invoice response 200 for order 123-4567890-1234567"
```

**What it means:** 
- Successfully scanning Amazon pages
- Found orders in the selected year
- Downloading invoice details for each order

#### ⚠️ Wrong Domain

```javascript
"Fetching orders from https://www.amazon.com/..."  // ← .com not .ca!
```

**What it means:** Extension is using wrong domain!

**Fix:** This is a configuration error. Run `node test-amazon-urls.js` to verify URLs.

#### ❌ No Orders Found

```javascript
"Fetching orders from https://www.amazon.ca/..."
"Got orders response 200"
"Found 0 orders"
```

**What it means:** No orders in the selected year, or Amazon page structure changed.

**Fix:**
- Select a different year with known orders
- Check if you can see orders manually on Amazon.ca
- Amazon may have changed their HTML structure

#### ❌ Invoice Fetch Failed

```javascript
"Fetching order invoice 123-4567890-1234567"
"Got order invoice response 404 for order 123-4567890-1234567"
```

**What it means:** Order ID found but invoice not available.

**Fix:** 
- Order may be too old (archived)
- Order may be pending
- Try excluding this order

---

### Monarch Connection Logs

#### ✅ Successful Connection

```javascript
"Checking Monarch auth"
"Monarch auth success"
```

**What it means:** Connected to Monarch, API key captured.

#### ❌ Not Authenticated

```javascript
"Checking Monarch auth"
"Monarch auth failed: Not authenticated"
```

**What it means:** Can't find Monarch API key.

**Fix:**
1. Open Monarch Money in browser
2. Make sure you're logged in
3. Wait 10 seconds
4. Click extension icon again

#### ❌ API Key Invalid

```javascript
"Monarch API call failed: 401 Unauthorized"
```

**What it means:** API key expired or invalid.

**Fix:**
1. Click "Reset Connection" in Options
2. Refresh Monarch page
3. Wait for reconnection

---

### Transaction Matching Logs

#### ✅ Successful Match

```javascript
"Matching 15 Amazon orders with Monarch transactions"
"Found 12 matches"
"Updating transaction txn_abc123 with order details"
```

**What it means:**
- Successfully matched Amazon orders to Monarch transactions
- 12 out of 15 orders matched
- 3 orders didn't find matching transactions

#### ⚠️ No Matches

```javascript
"Matching 15 Amazon orders with Monarch transactions"
"Found 0 matches"
```

**What it means:** No Monarch transactions match the Amazon order dates/amounts.

**Fix:**
- Check if transactions exist in Monarch for those dates
- Verify amounts match (within $1-2)
- Transactions may take days to appear in Monarch

---

## Common Error Patterns

### 1. CORS / Network Errors

**Log:**
```javascript
TypeError: Failed to fetch
  at amazonApi.ts:42
```

**Cause:** Browser blocking cross-origin requests

**Fix:**
- Extension must be loaded as unpacked extension
- Check manifest permissions
- Restart Chrome

---

### 2. Wrong Amazon Domain

**Log:**
```javascript
"Fetching orders from https://www.amazon.com/..."
```

**Cause:** URLs not configured for Canada

**Fix:**
```bash
# Verify URLs
node test-amazon-urls.js

# If fails, check src/shared/api/amazonApi.ts
# All URLs should be amazon.ca not amazon.com
```

---

### 3. Rate Limiting

**Log:**
```javascript
"Got orders response 429"
or
"Got order invoice response 429"
```

**Cause:** Too many requests to Amazon in short time

**Fix:**
- Wait 15-30 minutes
- Amazon is rate-limiting your IP
- Try again later

---

### 4. Amazon Page Structure Changed

**Log:**
```javascript
"Found 0 orders"
"No order ID found in card"
"No items found in invoice"
```

**Cause:** Amazon changed their HTML structure

**Fix:**
- Check if you can manually see orders on Amazon.ca
- Report issue with example order URL
- May need code update to handle new structure

---

### 5. Monarch API Timeout

**Log:**
```javascript
"Fetching Monarch transactions..."
[long pause]
"Error: timeout"
```

**Cause:** Monarch API slow or down

**Fix:**
- Check if Monarch.com is accessible
- Try again in a few minutes
- Check Monarch status page

---

## Chrome DevTools Guide

### Console Tab

**Purpose:** See all logs in real-time

**How to use:**
1. Open DevTools (F12)
2. Click Console tab
3. **Filter logs:** Type "Amazon" or "Monarch" in filter box
4. **Clear console:** Click 🚫 icon
5. **Preserve logs:** Check "Preserve log" to keep logs across page loads

**Console Methods:**
```javascript
console.log()   // Info (blue)
console.warn()  // Warning (yellow)
console.error() // Error (red)
```

### Network Tab

**Purpose:** See all HTTP requests to Amazon and Monarch

**How to use:**
1. Open DevTools (F12)
2. Click Network tab
3. **Filter by domain:** Type "amazon.ca" or "monarch"
4. **Check status codes:**
   - 200 = Success ✅
   - 401 = Unauthorized ❌
   - 403 = Forbidden ❌
   - 404 = Not found ❌
   - 429 = Rate limited ❌
   - 500 = Server error ❌

**What to look for:**
```
✅ https://www.amazon.ca/gp/css/order-history → 200
✅ https://www.amazon.ca/gp/css/summary/print.html?orderID=... → 200
✅ https://app.monarchmoney.com/graphql → 200

❌ https://www.amazon.com/... → Wrong domain!
❌ Any request → 403/429 → Rate limited
❌ Any request → 404 → Resource not found
```

### Application Tab

**Purpose:** Inspect extension storage

**How to use:**
1. Open DevTools (F12)
2. Click Application tab
3. Expand **Storage → Local Storage**
4. Click on extension URL
5. **View stored data:**
   - `debug` - Debug logs
   - `app` - Amazon/Monarch connection status
   - `progress` - Sync progress
   - `transactions` - Cached transaction data

---

## Network Debugging

### Verify Correct Domain

**In Network tab, filter by:** `amazon`

**Look for:**
```
✅ www.amazon.ca/gp/css/order-history
✅ www.amazon.ca/gp/css/summary/print.html
✅ www.amazon.ca/spr/returns/cart

❌ www.amazon.com (wrong domain!)
```

### Check Request Headers

**Click on a request → Headers tab**

**Look for:**
```
Request URL: https://www.amazon.ca/...
Status Code: 200 OK
Request Headers:
  User-Agent: Mozilla/5.0...
  Cookie: session-id=...
```

**If missing cookies:** You're not logged in to Amazon

### Check Response

**Click on a request → Response tab**

**Look for:**
- HTML content with order data
- JSON with transaction data
- Error messages

**Common issues:**
```html
<!-- Amazon Sign In page - Not logged in -->
<h1>Sign in</h1>

<!-- Amazon error page -->
<h1>Sorry! Something went wrong!</h1>

<!-- Correct order page -->
<div class="order-card">...</div>
```

---

## Logging Best Practices

### When Requesting Help

**Always include:**

1. **Debug logs** (download from Options)
2. **Console screenshot** (DevTools Console tab)
3. **Network tab screenshot** (for failed requests)
4. **What you were doing** when error occurred
5. **Chrome version** and **OS**

### Example Bug Report

```markdown
## Issue: Amazon orders not syncing

**What I did:**
1. Clicked "Force sync"
2. Extension showed "Syncing..."
3. After 30 seconds, showed "Failed"

**Debug logs:**
[Attach debug-logs.txt]

**Console errors:**
```
TypeError: Failed to fetch
  at amazonApi.ts:42
```

**Network tab:**
- All requests to amazon.ca showing 403 Forbidden

**Environment:**
- Chrome Version: 120.0.6099.109
- OS: macOS 14.2
- Extension Version: 0.3.1
```

---

## Advanced Debugging

### Enable Verbose Logging

The extension automatically logs all operations. To see more detail:

1. Open `src/shared/storages/debugStorage.ts`
2. All `debugLog()` calls are captured
3. Add more logs if needed:

```typescript
await debugLog(`Processing order: ${orderId}`);
await debugLog(`Found ${items.length} items`);
await debugLog({ orderId, items }); // Log object
```

### Test Individual Functions

Open Console and test functions directly:

```javascript
// Test Amazon auth
const result = await checkAmazonAuth();
console.log(result);

// Test order fetch
const orders = await fetchOrders(2024);
console.log(orders);
```

### Clear All Extension Data

If extension is stuck:

```javascript
// In Console:
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
  location.reload();
});
```

---

## Diagnostic Checklist

Use this checklist when debugging:

### Amazon Connection
- [ ] Logged in to amazon.ca (not .com)
- [ ] Can see orders manually on Amazon
- [ ] Console shows "Amazon auth success"
- [ ] Network tab shows 200 responses from amazon.ca
- [ ] No CORS or network errors

### Monarch Connection
- [ ] Logged in to app.monarchmoney.com
- [ ] Console shows "Monarch auth success"
- [ ] Network tab shows 200 responses to /graphql
- [ ] API key visible in Application → Storage

### Order Fetching
- [ ] Console shows "Found X orders"
- [ ] Order count matches what you see on Amazon
- [ ] Invoice requests return 200
- [ ] Order IDs look correct (111-1234567-1234567)

### Transaction Matching
- [ ] Console shows "Found X matches"
- [ ] Match count seems reasonable
- [ ] Transactions exist in Monarch for those dates
- [ ] Amounts are close (within $1-2)

---

## Common Log Sequences

### ✅ Successful Sync

```javascript
// Step 1: Check connections
"Checking Amazon auth"
"Got Amazon auth response 200"
"Amazon auth success"
"Checking Monarch auth"
"Monarch auth success"

// Step 2: Fetch Amazon orders
"Fetching orders from https://www.amazon.ca/..."
"Got orders response 200"
"Found 15 orders"

// Step 3: Download order details
"Fetching order invoice 111-1234567-1234567"
"Got order invoice response 200 for order 111-1234567-1234567"
[...repeats for each order...]

// Step 4: Fetch Monarch transactions
"Fetching Monarch transactions for date range"
"Found 120 Monarch transactions"

// Step 5: Match and update
"Matching 15 Amazon orders with Monarch transactions"
"Found 12 matches"
"Updating transaction txn_abc123"
[...repeats for each match...]

// Done!
"Sync complete: 12 transactions updated"
```

### ❌ Failed Sync - Not Logged In

```javascript
"Checking Amazon auth"
"Got Amazon auth response 200"
"Amazon auth failed"  // ← Sign in page detected
[Sync stops]
```

**Fix:** Log in to Amazon.ca

### ❌ Failed Sync - Rate Limited

```javascript
"Fetching orders from https://www.amazon.ca/..."
"Got orders response 429"  // ← Too many requests
[Sync stops]
```

**Fix:** Wait 15-30 minutes, try again

### ❌ Failed Sync - No Matches

```javascript
"Fetching orders from https://www.amazon.ca/..."
"Found 15 orders"
"Fetching Monarch transactions"
"Found 120 Monarch transactions"
"Matching 15 Amazon orders with Monarch transactions"
"Found 0 matches"  // ← No transactions matched
```

**Fix:** Check if transactions exist in Monarch, verify dates/amounts

---

## Getting Help

If you can't resolve the issue:

1. **Download debug logs** (Options → Download debug logs)
2. **Take screenshots:**
   - Console errors
   - Network tab (failed requests)
   - Extension popup (error message)
3. **Open an issue** on GitHub with:
   - Clear description of problem
   - Steps to reproduce
   - Debug logs attached
   - Screenshots attached
   - Chrome version & OS

**Privacy Note:** Debug logs contain order IDs and dates but NOT:
- Credit card numbers
- Passwords
- API keys (masked)
- Personal item details

Review logs before sharing if concerned about privacy.

---

## Quick Reference

### Key Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| "Amazon auth success" | ✅ Connected to Amazon | Continue |
| "Amazon auth failed" | ❌ Not logged in | Log in to Amazon.ca |
| "Got orders response 200" | ✅ Orders fetched | Continue |
| "Found 0 orders" | ⚠️ No orders in year | Try different year |
| "Got order invoice response 404" | ❌ Invoice not found | Order may be archived |
| "Monarch auth success" | ✅ Connected to Monarch | Continue |
| "Found X matches" | ✅ Matched transactions | Check if X is reasonable |
| "TypeError: Failed to fetch" | ❌ Network error | Check connection/CORS |
| "403 Forbidden" | ❌ Blocked by Amazon | Wait, try later |
| "429 Too Many Requests" | ❌ Rate limited | Wait 15-30 min |

---

## Debug Mode Environment Variables

For development, you can enable additional logging:

```bash
# In manifest.js or environment
DEBUG=true
VERBOSE_LOGGING=true
```

This will log:
- Every API call with full request/response
- Every transaction comparison
- Every DOM query
- Timing information

---

**Happy debugging! 🐛🔍**

For more help, see:
- [TESTING.md](TESTING.md) - Testing procedures
- [README.md](README.md) - General documentation
- [GitHub Issues](https://github.com/raphael1807/monarch-amazon-sync/issues) - Report bugs

