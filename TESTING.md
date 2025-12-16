# Testing Guide - Monarch Amazon Sync (Canada 🇨🇦)

This guide will help you test the extension before using it with real Monarch data.

## Quick Test Summary

```bash
# 1. Run URL configuration test
node test-amazon-urls.js

# 2. Build the extension
pnpm build

# 3. Load in Chrome and test connections
# 4. Run a dry-run backfill to verify functionality
```

---

## Detailed Testing Steps

### Step 1: Pre-Installation Tests

#### A. Verify Amazon.ca URL Configuration

```bash
# Run the automated URL test
node test-amazon-urls.js
```

**Expected Output:**
```
🎉 All tests passed! Amazon.ca URLs are correctly configured.
```

**If this fails**, the extension will try to connect to Amazon.com instead of Amazon.ca!

#### B. Build the Extension

```bash
# Install dependencies
pnpm install

# Build the extension
pnpm build

# Verify build output
ls -la dist/
```

**Expected Output:**
- `dist/` folder should exist
- Should contain `manifest.json`, `assets/`, `src/` folders
- No build errors in console

#### C. Verify Manifest

```bash
cat dist/manifest.json | grep -E "name|version|permissions"
```

**Expected:**
- Name: "Monarch / Amazon Sync"
- Version: 0.3.1 or higher
- Permissions include: storage, alarms, webRequest

---

### Step 2: Install Extension in Chrome

1. **Open Chrome Extensions page**:
   - Navigate to `chrome://extensions`
   - Or: Menu → Extensions → Manage Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" in top-right corner

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `dist` folder
   - Extension should appear in the list

4. **Check for Errors**:
   - Look for red error messages on the extension card
   - If errors appear, check Chrome DevTools console

5. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Monarch / Amazon Sync" for easy access

---

### Step 3: Test Amazon.ca Connection

**Prerequisites:**
- Must be logged in to Amazon.ca (not .com!)

**Steps:**

1. **Open Amazon.ca**:
   ```
   https://www.amazon.ca/gp/css/order-history
   ```

2. **Wait for page to load** (5 seconds)

3. **Click the extension icon** in Chrome toolbar

4. **Check Connection Status**:
   - Should show: **✅ Amazon: Connected**
   - Should display your oldest order year

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| ❌ Amazon: Not logged in | Log in to Amazon.ca and refresh |
| ❌ Amazon: Failure | Check Console for errors (F12) |
| Shows Amazon.com URLs | URL configuration failed - run test again |

**Verify in DevTools:**

```javascript
// Open Console (F12) and check for:
// Should see: "Amazon auth success" in console logs
```

---

### Step 4: Test Monarch Connection

**Prerequisites:**
- Must have a Monarch Money account

**Steps:**

1. **Open Monarch Money**:
   ```
   https://app.monarchmoney.com
   ```

2. **Log in** to your account

3. **Wait 10 seconds** for extension to detect the API key

4. **Click the extension icon**

5. **Check Connection Status**:
   - Should show: **✅ Monarch: Connected**

**Troubleshooting:**

| Issue | Solution |
|-------|----------|
| ❌ Monarch: Not authenticated | Refresh Monarch page and wait |
| ❌ Monarch: Failure | Click "Reset Connection" in options |
| Connection times out | Try closing/reopening Monarch tab |

---

### Step 5: Safe Dry-Run Test ⚠️ (CRITICAL)

**This is the most important test!** It verifies the extension works without modifying your Monarch data.

**Steps:**

1. **Open the Extension Popup**
   - Click the extension icon

2. **Navigate to Manual Backfill**
   - Click "Manual backfill" button

3. **Configure Dry-Run**:
   - Select a year: **2024** (or current year)
   - ✅ **Enable "Dry-run mode"** (MUST BE CHECKED!)
   - This prevents any changes to Monarch

4. **Start the Test**:
   - Click "Start Backfill"
   - Watch the progress bar

5. **Monitor Progress**:
   - Phase 1: Scanning Amazon pages
   - Phase 2: Downloading order details
   - Phase 3: Fetching Monarch transactions
   - Phase 4: Matching transactions

6. **Review CSV Output**:
   - A CSV file will automatically download
   - Open it in Excel/Google Sheets
   - **Verify the following:**

**CSV Validation Checklist:**

```
✅ Contains your actual Amazon.ca orders
✅ Dates match your purchase dates
✅ Amounts match your credit card charges
✅ Item names are correct and readable
✅ No duplicate entries (unless expected)
✅ Refunds show negative amounts
```

**Example CSV Format:**
```csv
Order ID,Date,Amount,Items,Monarch Transaction ID,Status
123-4567890-1234567,2024-01-15,$45.99,"Item 1, Item 2",txn_abc123,Matched
```

---

### Step 6: DevTools Console Monitoring

**While running tests, monitor Chrome DevTools:**

1. **Open DevTools**: Press `F12` or `Cmd+Option+I` (Mac)

2. **Go to Console Tab**

3. **Look for these log messages**:

```javascript
// Good signs:
✅ "Amazon auth success"
✅ "Fetching orders from https://www.amazon.ca/..."
✅ "Got orders response 200"
✅ "Found X orders"
✅ "Monarch auth success"

// Bad signs:
❌ "Amazon auth failed"
❌ "403 Forbidden"
❌ "amazon.com" (should be .ca!)
❌ "Network error"
❌ Any red error messages
```

4. **Check Network Tab**:
   - Filter by "amazon.ca"
   - All requests should be to `.ca` domain
   - Status codes should be 200 (success)

---

### Step 7: Test Results Interpretation

#### ✅ All Tests Passed

If you see:
- URL test passed
- Amazon.ca connected
- Monarch connected
- Dry-run CSV looks correct
- No console errors

**You're ready to use the extension!**

#### ⚠️ Some Tests Failed

**Common Issues and Fixes:**

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| URLs point to .com | Merge conflict | Re-check `amazonApi.ts` for `.com` references |
| Amazon won't connect | Wrong domain | Ensure you're on amazon.**ca** not .com |
| Empty CSV | No orders in year | Try a different year with known orders |
| Monarch won't connect | API key issue | Refresh Monarch page, wait longer |
| Console errors | Build issue | Run `pnpm build` again |

---

## Advanced Testing

### Test with Different Scenarios

1. **Test Recent Orders**:
   - Dry-run for current year
   - Should match your latest purchases

2. **Test Historical Data**:
   - Dry-run for 2023 or 2022
   - Verify old orders are retrieved

3. **Test Refunds**:
   - If you have refunds, check they appear as negative amounts
   - Should match to refund transactions in Monarch

4. **Test Multiple Pages**:
   - Select a year with 10+ orders
   - Verify pagination works (multiple pages scanned)

### Performance Testing

**Expected Performance:**
- **Amazon page scan**: ~2-5 seconds per page
- **Order download**: ~1-2 seconds per order
- **Monarch fetch**: ~5-10 seconds total
- **Matching**: < 1 second

**If significantly slower:**
- Check network connection
- Amazon may be rate-limiting
- Try again later

---

## Automated Test Suite

Run all tests in sequence:

```bash
#!/bin/bash
echo "🧪 Running full test suite..."

# Test 1: URL Configuration
echo "Test 1: Amazon.ca URL verification..."
node test-amazon-urls.js || exit 1

# Test 2: Build
echo "Test 2: Building extension..."
pnpm build || exit 1

# Test 3: Verify build output
echo "Test 3: Checking build artifacts..."
test -f dist/manifest.json || exit 1
test -d dist/assets || exit 1
test -d dist/src || exit 1

echo "✅ All automated tests passed!"
echo "📋 Manual tests remaining:"
echo "   - Load extension in Chrome"
echo "   - Test Amazon.ca connection"
echo "   - Test Monarch connection"
echo "   - Run dry-run backfill"
```

Save as `run-tests.sh` and run with: `bash run-tests.sh`

---

## Testing Checklist

Use this before deploying:

### Pre-Installation
- [ ] URL test passed (node test-amazon-urls.js)
- [ ] Build successful (pnpm build)
- [ ] dist/ folder created
- [ ] manifest.json exists

### Installation
- [ ] Extension loads in Chrome without errors
- [ ] Icon appears in toolbar
- [ ] No red errors on extension card

### Connections
- [ ] Amazon.ca shows "Connected" (not amazon.com!)
- [ ] Oldest order year is detected
- [ ] Monarch shows "Connected"
- [ ] Both connections stable (don't disconnect)

### Functionality
- [ ] Dry-run completes without errors
- [ ] CSV downloads successfully
- [ ] CSV contains actual Amazon orders
- [ ] Dates and amounts are correct
- [ ] Item names are readable

### Quality
- [ ] No console errors during dry-run
- [ ] All network requests to amazon.ca (not .com)
- [ ] Progress indicators work
- [ ] Extension popup responsive

### Final Check
- [ ] Comfortable with dry-run results
- [ ] Backed up Monarch transactions
- [ ] Ready to run live sync

---

## When to Re-Test

Re-run these tests when:
- ✅ Merging upstream changes
- ✅ Modifying amazonApi.ts
- ✅ After any code changes
- ✅ Before running live (non-dry-run) sync
- ✅ If Amazon.ca changes their page structure
- ✅ After Chrome updates

---

## Support

If tests fail and you can't resolve:

1. **Check Debug Logs**:
   - Extension popup → Options → View Debug Logs
   - Look for specific error messages

2. **Verify Prerequisites**:
   - Logged in to Amazon.ca
   - Logged in to Monarch Money
   - Chrome is up to date

3. **Try Fresh Install**:
   ```bash
   # Remove and rebuild
   rm -rf dist node_modules
   pnpm install
   pnpm build
   # Reload extension in Chrome
   ```

4. **Compare with Upstream**:
   - Check if issue exists in original (US version)
   - May be an Amazon.ca specific issue

---

## Next Steps

Once all tests pass:

1. ✅ **Run one more dry-run** for peace of mind
2. ✅ **Backup Monarch transactions** (export CSV from Monarch)
3. ✅ **Enable daily sync** or run live backfill
4. ✅ **Monitor first sync** closely
5. ✅ **Verify results** in Monarch

**Good luck! 🚀**

