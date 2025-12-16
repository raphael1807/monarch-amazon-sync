<div align="center">
<img src="public/icon-128.png" alt="logo"/>
<h1>Monarch / Amazon Sync (Canada 🇨🇦)</h1>
</div>

## What is this?

A simple Chrome extension to sync Amazon purchases with [Monarch](https://monarchmoney.com) transactions. Transactions in Monarch that match the time and amount of an Amazon purchase will have a note created in Monarch with the Amazon item details.

This will allow easy categorization of Amazon purchases in Monarch without the need to go back and forth from Amazon to Monarch figure out what you bought.

> **Note**: This is a Canadian fork configured to work with **Amazon.ca**. For the US version (Amazon.com), see the [original repository](https://github.com/alex-peck/monarch-amazon-sync).

## Features

- Automatically matches Amazon orders with Monarch transactions based on amounts and dates
- Populates Monarch transaction notes with a list of item names and per-item prices
- Handles refunds (adds the same item names to a refund transaction when a refund is made)
- Supports gift card transactions (will match to existing Monarch transactions, does not create new transactions)
- Performs a daily sync to pull new Amazon orders and match them to Monarch transactions (requires browser to be open)
- Supports backfilling past years of Amazon orders to existing Monarch transactions

## Installation

> [!WARNING]
> This should be considered a BETA and therefore has not been released to the Chrome Web Store. While extensively tested, it may cause issues with your Monarch transactions. **We strongly recommend downloading a backup of your Monarch transactions before using this extension!**

### Option 1: Using Pre-built Extension (Recommended)

1. **Download the extension**:
   - Clone or download this repository
   - Or download the pre-built `chrome-monarch-amazon-sync.zip` if available

2. **Extract the files**:
   - If you have the zip file: Unzip `chrome-monarch-amazon-sync.zip`
   - This creates a `dist` folder with all the extension files

3. **Install in Chrome**:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable **Developer mode** (toggle in the top-right corner)
   - Click **"Load unpacked"**
   - Select the `dist` folder (or the unzipped folder)

4. **Verify installation**:
   - The "Monarch / Amazon Sync" extension should appear in your extensions list
   - Pin it to your toolbar for easy access

### Option 2: Build from Source

If you want to build the extension yourself:

```bash
# 1. Install dependencies (requires pnpm)
pnpm install

# 2. Build and create zip file
pnpm build-and-zip

# 3. The chrome-monarch-amazon-sync.zip file will be created in the root directory
```

Then follow steps 2-4 from Option 1 above.

## Quick Start Guide

1. **Install the extension** (see Installation section below)
2. **Log in to Amazon.ca** in your browser
3. **Open Monarch Money** in your browser (this allows the extension to grab your API key)
4. **Click the extension icon** and turn on "Sync"
5. **Done!** The extension will now automatically sync your Amazon purchases daily

## How to Use

### Initial Setup

1. **Amazon Login**: Make sure you are logged in to your **Amazon.ca** account
2. **Monarch Connection**: Open [Monarch Money](https://monarchmoney.com) in your browser
   - The extension will automatically grab the necessary API key from the page
   - After the initial setup, you don't need to keep Monarch open

### Daily Sync (Automatic)

1. Turn on **"Sync"** in the extension popup
2. The extension will automatically check for new Amazon purchases every day
3. Matching transactions in Monarch will be updated with Amazon item details
4. **Optional**: Use **"Force sync"** to manually trigger a sync immediately

### Manual Backfill (For Past Orders)

Want to sync your historical Amazon orders?

1. Click **"Manual backfill"** in the extension
2. **Select a year** to backfill from the dropdown
3. **Choose your mode**:
   - **Dry-run mode**: Creates a CSV preview of changes without modifying Monarch
   - **Live mode**: Actually updates your Monarch transactions
4. **Recommended**: Always run dry-run first to review changes!

### Troubleshooting

**Extension not connecting to Amazon?**
- Make sure you're logged in to Amazon.ca (not Amazon.com)
- Try refreshing the Amazon page
- Check if "Developer mode" is enabled in Chrome extensions

**Extension not connecting to Monarch?**
- Open Monarch Money in your browser
- Wait a few seconds for the extension to detect the connection
- Try clicking "Reset Connection" in the extension options

**Transactions not matching?**
- The extension matches based on date and amount
- Check that your Amazon orders have corresponding transactions in Monarch
- Some credit card transactions may take a few days to appear in Monarch

## Known limitations
- The extension does not create new transactions. It only updates the notes of existing transactions.
- Occasionally Amazon will break up a single order of many items into separate credit card transactions.
In this case, it is not currently possible to tell which items belong to which transaction.
To handle this, this extension will always populate all items in an order on every Monarch transaction associated with that Amazon order.
- For the per-item amounts in each note, the amount is not including tax. There is not currently a way to get the amount of individual items including tax.

## Screenshots
<img width="319" alt="image" src="https://github.com/alex-peck/monarch-amazon-sync/assets/53013351/af77f2b8-d92f-42ff-bc37-c7cedaf22fe9">

## What's Different in This Fork? 🇨🇦

This Canadian version includes:
- ✅ **Amazon.ca Support**: All URLs configured for Amazon Canada
- ✅ **Latest Upstream Features**: Merged with upstream v0.3.1 features including:
  - Improved Amazon data fetching using invoices
  - Debug logging improvements
  - Connection status reset capability
  - Fixed selector changes for Amazon pages
- ✅ **Maintained Compatibility**: Works seamlessly with Monarch Money

## Testing the Extension

Before using the extension with real data, it's **strongly recommended** to test it to ensure everything works properly with Amazon.ca.

> 📖 **See [TESTING.md](TESTING.md) for the complete testing guide with detailed instructions.**

### Quick Test (5 minutes)

### Pre-Installation Testing

1. **Verify the build**:
   ```bash
   # Make sure the extension builds without errors
   pnpm install
   pnpm build
   
   # Check that dist folder was created
   ls -la dist/
   ```

2. **Check the manifest**:
   ```bash
   # Verify manifest.json has correct permissions
   cat dist/manifest.json
   ```

### Post-Installation Testing

1. **Load the Extension**:
   - Follow installation instructions above
   - Check Chrome DevTools console for any errors
   - Extension icon should appear in toolbar

2. **Test Amazon.ca Connection**:
   - Make sure you're logged in to [Amazon.ca](https://amazon.ca)
   - Click the extension icon
   - Check "Connection Info" section
   - Should show: ✅ **Amazon: Connected**
   - If not connected, refresh the Amazon page and try again

3. **Test Monarch Connection**:
   - Open [Monarch Money](https://app.monarchmoney.com) in a new tab
   - Wait 5-10 seconds for the extension to detect it
   - Click the extension icon
   - Should show: ✅ **Monarch: Connected**
   - If not connected, refresh Monarch and wait a bit

4. **Safe Dry-Run Test** (Recommended):
   - Click **"Manual backfill"** in the extension
   - Select a recent year (e.g., current year or last year)
   - **Enable "Dry-run mode"** ⚠️ (This won't modify your Monarch data!)
   - Click **"Start Backfill"**
   - Watch the progress indicator
   - A CSV file will download with proposed changes
   - **Review the CSV** to verify:
     - Amazon orders are detected
     - Dates and amounts look correct
     - Item names are captured properly

5. **Check Debug Logs** (If issues occur):
   - Open Chrome DevTools (F12)
   - Go to Console tab
   - Click the extension icon to trigger actions
   - Look for any error messages (red text)
   - Check Network tab for failed requests

### What to Look For

✅ **Good Signs**:
- Extension icon appears in toolbar
- Both Amazon.ca and Monarch show "Connected"
- Dry-run CSV contains your Amazon orders
- No errors in Chrome DevTools console

⚠️ **Warning Signs**:
- "Not logged in" status for Amazon or Monarch
- Empty CSV file from dry-run
- Console errors mentioning "amazon.com" instead of "amazon.ca"
- 404 or network errors in DevTools

### Testing Checklist

Before using the extension for real:
- [ ] Extension loads without errors
- [ ] Amazon.ca connection works (not .com)
- [ ] Monarch Money connection works
- [ ] Dry-run produces a valid CSV
- [ ] CSV contains expected Amazon orders
- [ ] Dates and amounts match your expectations
- [ ] No errors in Chrome DevTools console

### If Tests Fail

**Amazon not connecting?**
- Verify you're on amazon.**ca** (not .com)
- Clear browser cache and cookies
- Try incognito mode to rule out extension conflicts

**Monarch not connecting?**
- Try refreshing the Monarch page
- Click "Reset Connection" in extension options
- Check if Monarch is accessible (not down)

**Dry-run produces empty CSV?**
- Check if you have Amazon orders in the selected year
- Verify Amazon page structure hasn't changed
- Check Console for specific error messages

## Keeping Up-to-Date

This fork stays synchronized with the [original repository](https://github.com/alex-peck/monarch-amazon-sync). To update with the latest upstream changes:

```bash
# Fetch latest changes from upstream
git fetch upstream

# Merge upstream changes (preserving .ca modifications)
git merge upstream/main

# Push to your fork
git push origin main
```

## Contributions

Feel free to submit issues or pull requests! Since this is a fork focused on Canadian Amazon support, contributions that maintain compatibility with both Amazon.ca and the upstream repository are especially welcome.

## Misc

Built off of [chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
