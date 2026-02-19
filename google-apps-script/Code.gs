/**
 * Google Apps Script — deployed as a web app bound to the budget spreadsheet.
 *
 * Setup:
 * 1. Open the Google Sheet (budget '25 [rapha])
 * 2. Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (or "Anyone with Google account" for more security)
 * 5. Copy the deployment URL and paste it in the extension settings
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'searchGmail') {
      return handleGmailSearch(data);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(data.tab);

    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Tab not found: ' + data.tab })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var count = 0;
    if (data.rows && data.rows.length > 0) {
      data.rows.forEach(function(row) {
        sheet.appendRow(row);
        count++;
      });
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, count: count, tab: data.tab })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleGmailSearch(data) {
  try {
    var threads = GmailApp.search(data.query, 0, 5);
    if (threads.length === 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, receipt: null })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var msg = threads[0].getMessages()[0];
    var attachments = msg.getAttachments().map(function(a) { return a.getName(); });

    var receipt = {
      from: msg.getFrom(),
      subject: msg.getSubject(),
      date: Utilities.formatDate(msg.getDate(), 'America/Toronto', 'yyyy-MM-dd'),
      snippet: msg.getPlainBody().substring(0, 500),
      attachments: attachments
    };

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, receipt: receipt })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Gmail search failed: ' + err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Monarch Accounting Script is running' })
  ).setMimeType(ContentService.MimeType.JSON);
}
