# Error Codes & Messages Reference

Quick reference for all error messages and what they mean.

---

## Amazon Connection Errors

### Not Logged In
```
Status: ❌ Amazon: Not logged in
Console: "Amazon auth failed"
```
**Cause:** Not logged in to Amazon.ca  
**Fix:** Log in to Amazon.ca and refresh

---

### Connection Failure
```
Status: ❌ Amazon: Failure
Console: "Amazon auth failed with error: TypeError: Failed to fetch"
```
**Cause:** Network issue, CORS, or Amazon blocking  
**Fix:** 
- Check internet connection
- Clear cookies and re-login
- Wait a few minutes (rate limiting)

---

### Wrong Domain
```
Console: "Fetching orders from https://www.amazon.com/..."
```
**Cause:** Extension configured for .com instead of .ca  
**Fix:** Run `node test-amazon-urls.js` to verify configuration

---

## Monarch Connection Errors

### Not Authenticated
```
Status: ❌ Monarch: Not authenticated
Console: "Monarch auth failed: Not authenticated"
```
**Cause:** Can't find Monarch API key  
**Fix:** 
- Open Monarch Money in browser
- Make sure you're logged in
- Wait 10 seconds

---

### API Key Invalid
```
Console: "Monarch API call failed: 401 Unauthorized"
```
**Cause:** API key expired or invalid  
**Fix:**
- Click "Reset Connection" in Options
- Refresh Monarch page
- Wait for reconnection

---

## Sync Errors

### No Orders Found
```
Console: "Found 0 orders"
```
**Cause:** No orders in selected year, or page structure changed  
**Fix:**
- Select different year
- Verify you can see orders manually on Amazon.ca
- Amazon may have changed their HTML structure

---

### No Matches Found
```
Console: "Found 0 matches"
```
**Cause:** No Monarch transactions match Amazon orders  
**Fix:**
- Check if transactions exist in Monarch
- Verify dates and amounts match
- Transactions may take days to appear

---

### Rate Limited (429)
```
Console: "Got orders response 429"
or
Console: "Got order invoice response 429"
```
**Cause:** Too many requests to Amazon  
**Fix:** Wait 15-30 minutes before trying again

---

### Invoice Not Found (404)
```
Console: "Got order invoice response 404 for order 123-4567890-1234567"
```
**Cause:** Order invoice not available  
**Fix:**
- Order may be too old (archived)
- Order may still be pending
- Skip this order

---

## HTTP Status Codes

| Code | Name | Meaning | Action |
|------|------|---------|--------|
| 200 | OK | ✅ Success | Continue |
| 401 | Unauthorized | ❌ Not logged in / Invalid API key | Re-authenticate |
| 403 | Forbidden | ❌ Access denied | Wait, try later |
| 404 | Not Found | ❌ Resource doesn't exist | Check URL, skip item |
| 429 | Too Many Requests | ❌ Rate limited | Wait 15-30 min |
| 500 | Internal Server Error | ❌ Server problem | Try again later |
| 503 | Service Unavailable | ❌ Server down | Check service status |

---

## Network Errors

### Failed to Fetch
```
TypeError: Failed to fetch
  at amazonApi.ts:42
```
**Cause:** CORS, network issue, or extension permissions  
**Fix:**
- Extension must be loaded as unpacked
- Check internet connection
- Restart Chrome

---

### Timeout
```
Error: timeout
```
**Cause:** Request took too long  
**Fix:**
- Check internet connection
- Amazon/Monarch may be slow
- Try again in a few minutes

---

## DOM Parsing Errors

### No Order ID Found
```
Console: "No order ID found in card"
```
**Cause:** Amazon changed HTML structure  
**Fix:** Report issue with screenshot of Amazon order page

---

### No Items Found
```
Console: "No items found in invoice"
```
**Cause:** Amazon invoice HTML changed  
**Fix:** Report issue with order ID

---

## Extension Errors

### Storage Error
```
Error: Storage quota exceeded
```
**Cause:** Too much data stored  
**Fix:** 
- Clear extension storage
- Reduce backfill year range

---

### Manifest Error
```
Error: Invalid manifest
```
**Cause:** Manifest.json corrupted or invalid  
**Fix:**
- Re-build extension: `pnpm build`
- Reload extension in Chrome

---

## Quick Troubleshooting

```
1. Check extension popup for error status
2. Open Console (F12) → Look for red error messages
3. Open Network tab → Filter by "amazon" or "monarch"
4. Download debug logs (Options → Download debug logs)
5. See DEBUGGING.md for detailed guide
```

---

## Getting Help

When reporting an error, include:

1. ✅ **Error message** (exact text from console)
2. ✅ **HTTP status code** (from Network tab)
3. ✅ **Debug logs** (download from Options)
4. ✅ **Screenshots** (console, network tab)
5. ✅ **Steps to reproduce**
6. ✅ **Chrome version & OS**

---

**See [DEBUGGING.md](DEBUGGING.md) for comprehensive debugging guide.**

