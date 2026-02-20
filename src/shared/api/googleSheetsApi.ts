export type SheetRow = (string | number)[];

export type SheetPayload = {
  tab: string;
  rows: SheetRow[];
};

export async function postToGoogleSheet(
  scriptUrl: string,
  payload: SheetPayload,
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!scriptUrl) {
    throw new Error('Google Apps Script URL not configured. Add it in Settings.');
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Google Sheets error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (text.includes('success')) return { success: true, count: payload.rows.length };
    throw new Error(`Unexpected response from Google Sheets: ${text.substring(0, 200)}`);
  }
}
