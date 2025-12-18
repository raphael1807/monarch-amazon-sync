// File-based logger for easy debugging and sharing
let logBuffer: string[] = [];
let sessionId = '';

export function initFileLogger() {
  logBuffer = [];
  sessionId = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
  logToFile(`
${'='.repeat(80)}
MONARCH AMAZON SYNC - DEBUG LOG
Session: ${sessionId}
Started: ${new Date().toLocaleString()}
${'='.repeat(80)}
`);
}

export function logToFile(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${timestamp}] ${message}`;
  logBuffer.push(line);
  console.log(message); // Also log to console
}

export function logOrderProcessing(orderId: string, items: number, transactions: number, pdfLinks: number) {
  logToFile(`\n📄 ORDER: ${orderId}`);
  logToFile(`   Items: ${items} | Transactions: ${transactions} | PDF Links: ${pdfLinks}`);
}

export function logPdfExtraction(orderId: string, pdfCount: number) {
  logToFile(`\n🔍 PDF EXTRACTION for ${orderId}:`);
  logToFile(`   Found ${pdfCount} PDF invoice(s)`);
}

export function logPdfSuccess(pdfNum: number, amount: number, date: string) {
  logToFile(`   ✅ PDF ${pdfNum}: $${amount} on ${date}`);
}

export function logPdfError(pdfNum: number, error: string) {
  logToFile(`   ❌ PDF ${pdfNum} FAILED: ${error}`);
}

export function logMatch(monarchAmount: number, amazonAmount: number, orderId: string) {
  logToFile(`✅ MATCH: Monarch $${monarchAmount} ↔ Amazon $${amazonAmount} | Order: ${orderId}`);
}

export function logFinalStats(stats: {
  amazonOrders: number;
  monarchTransactions: number;
  matches: number;
  updated: number;
  skipped: number;
  cached: number;
  helperNotes?: number;
  duration: string;
}) {
  logToFile(`
${'='.repeat(80)}
FINAL SUMMARY:
  Amazon Orders: ${stats.amazonOrders}
  Monarch Transactions: ${stats.monarchTransactions}
  Matches Found: ${stats.matches}
  Updated: ${stats.updated}
  Helper Notes Added: ${stats.helperNotes || 0}
  Skipped (already correct): ${stats.skipped}
  Skipped (cached): ${stats.cached}
  Duration: ${stats.duration}
${'='.repeat(80)}
`);
}

export async function saveLogFile(): Promise<string> {
  console.log('💾 saveLogFile called, buffer size:', logBuffer.length);

  if (logBuffer.length === 0) {
    console.warn('⚠️ Log buffer is empty! No sync has been run yet.');
    throw new Error('No trace data available. Run a sync first.');
  }

  const content = logBuffer.join('\n');
  const filename = `sync_log_${sessionId}.txt`;

  console.log('📝 Preparing to save:', filename, `(${content.length} chars)`);

  try {
    // Use data URL instead of blob URL (works in Service Workers)
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const dataUrl = `data:text/plain;base64,${base64Content}`;

    console.log('⬇️ Triggering download...');

    // Trigger download via chrome.downloads API
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: `monarch_sync_logs/${filename}`,
      saveAs: false, // Auto-save to Downloads folder
    });

    console.log(`✅ Log file saved: ${filename} (ID: ${downloadId})`);
    return filename;
  } catch (error) {
    console.error('❌ Failed to save log file:', error);

    // Fallback: Print to console for copy-paste
    console.log('\n\n📋 COPY THIS LOG:\n');
    console.log(content);
    console.log('\n📋 END OF LOG\n\n');

    throw error;
  }
}

export function getLogContent(): string {
  return logBuffer.join('\n');
}
