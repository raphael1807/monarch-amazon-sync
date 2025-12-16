# 🔍 Quick Debug Reference Card

**Keep this handy while using the extension!**

---

## 📋 When Something Goes Wrong

```
1. Check extension popup → Look for ❌ status
2. Press F12 → Console tab → Look for red errors
3. Options → Download debug logs
4. See full guides: DEBUGGING.md & ERROR_CODES.md
```

---

## ✅ What Success Looks Like

### In Extension Popup:
```
✅ Amazon: Connected
✅ Monarch: Connected
✅ Sync complete: 12 transactions updated
```

### In Console (F12):
```javascript
"Amazon auth success"
"Found 15 orders"
"Monarch auth success"
"Found 12 matches"
```

---

## ❌ Common Problems & Quick Fixes

### Amazon Won't Connect

**Console shows:**
```javascript
"Amazon auth failed"
```

**Quick Fix:**
1. Go to amazon.ca (NOT .com!)
2. Make sure you're logged in
3. Refresh page
4. Click extension icon again

---

### Monarch Won't Connect

**Console shows:**
```javascript
"Monarch auth failed"
```

**Quick Fix:**
1. Open app.monarchmoney.com
2. Make sure you're logged in
3. Wait 10 seconds
4. Try Options → Reset Connection

---

### No Orders Found

**Console shows:**
```javascript
"Found 0 orders"
```

**Quick Fix:**
1. Select a different year with known orders
2. Verify you can see orders manually on Amazon.ca
3. Check Console for "amazon.com" (should be .ca!)

---

### No Matches Found

**Console shows:**
```javascript
"Found 0 matches"
```

**Quick Fix:**
1. Check if transactions exist in Monarch for those dates
2. Verify amounts are close (within $1-2)
3. Wait a few days if transactions are recent

---

### Rate Limited (Too Fast)

**Console shows:**
```javascript
"Got orders response 429"
```

**Quick Fix:**
1. Wait 15-30 minutes
2. Amazon is blocking too many requests
3. Try again later

---

## 🔧 Quick Debug Commands

### Open DevTools Console
- **Windows/Linux:** Press `F12`
- **Mac:** Press `Cmd + Option + I`

### Check Logs
```
Extension → Options → Download debug logs
```

### Clear Extension Data (Nuclear Option)
```javascript
// In Console:
chrome.storage.local.clear();
location.reload();
```

### Test URLs (From Project Folder)
```bash
node test-amazon-urls.js
```

---

## 📊 HTTP Status Codes

| Code | Meaning | What To Do |
|------|---------|------------|
| 200 | ✅ Success | All good! |
| 401 | ❌ Not logged in | Log in again |
| 403 | ❌ Blocked | Wait, try later |
| 404 | ❌ Not found | Order archived? |
| 429 | ❌ Rate limit | Wait 15-30 min |
| 500 | ❌ Server error | Try again later |

---

## 🎯 Pre-Flight Checklist

Before syncing:

- [ ] Logged in to amazon.ca (not .com)
- [ ] Logged in to monarchmoney.com
- [ ] Extension shows both ✅ Connected
- [ ] Ran dry-run test successfully
- [ ] Reviewed CSV output
- [ ] No errors in Console

---

## 🚨 Emergency Checklist

If everything is broken:

```
1. Download debug logs (Options → Download debug logs)
2. Take screenshots (Console + Network tabs)
3. Note what you were doing when it failed
4. Check DEBUGGING.md for detailed help
5. Report issue on GitHub with logs + screenshots
```

---

## 📖 Full Documentation

- **README.md** - Getting started & features
- **TESTING.md** - How to test before using
- **DEBUGGING.md** - Complete debugging guide ⭐
- **ERROR_CODES.md** - All error messages explained ⭐
- **QUICK_DEBUG_REFERENCE.md** - This file!

---

## 💡 Pro Tips

1. **Always run dry-run first** - See what will happen without changing data
2. **Check Console regularly** - Errors appear in red
3. **Download logs after errors** - Helps with troubleshooting
4. **Use Network tab** - See exactly what requests are being made
5. **Verify .ca domain** - All Amazon URLs should be amazon.ca not .com

---

## 🆘 Getting Help

**When reporting issues, include:**

1. ✅ Debug logs (download from Options)
2. ✅ Console screenshot (F12 → Console)
3. ✅ Network tab screenshot (F12 → Network)
4. ✅ What you were doing when it failed
5. ✅ Chrome version & OS

**Where to get help:**
- GitHub Issues: https://github.com/raphael1807/monarch-amazon-sync/issues
- See DEBUGGING.md for detailed troubleshooting

---

**Print this page and keep it handy! 📄**

*Last updated: December 2024*

