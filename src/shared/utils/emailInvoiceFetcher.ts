export type EmailReceipt = {
  from: string;
  subject: string;
  date: string;
  snippet: string;
  attachments?: string[];
};

export function buildGmailSearchQuery(merchant: string, amount: number, date: string, counterparty?: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const before = new Date(year, month - 1, day + 3);
  const after = new Date(year, month - 1, day - 3);

  const fmtDate = (dt: Date) =>
    `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;

  const parts = [`(${merchant.toLowerCase()}`];
  if (counterparty) parts[0] += ` OR ${counterparty}`;
  parts[0] += ')';

  parts.push(`${amount}`);
  parts.push(`after:${fmtDate(after)}`);
  parts.push(`before:${fmtDate(before)}`);

  return parts.join(' ');
}

export function formatEmailReceiptNote(receipt: EmailReceipt): string {
  const lines = ['\n\n--- Email Receipt ---'];
  if (receipt.from) lines.push(`From: ${receipt.from}`);
  lines.push(`Date: ${receipt.date}`);
  lines.push(`Subject: ${receipt.subject}`);
  if (receipt.snippet) lines.push(`Details: ${receipt.snippet.substring(0, 200)}`);
  if (receipt.attachments?.length) {
    lines.push(`Attachments: ${receipt.attachments.join(', ')}`);
  }
  return lines.join('\n');
}

export async function searchGmailForReceipt(
  scriptUrl: string,
  merchant: string,
  amount: number,
  date: string,
  counterparty?: string,
): Promise<EmailReceipt | null> {
  if (!scriptUrl) return null;

  try {
    const query = buildGmailSearchQuery(merchant, amount, date, counterparty);

    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'searchGmail', query }),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data.success && data.receipt) return data.receipt as EmailReceipt;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
  return null;
}
