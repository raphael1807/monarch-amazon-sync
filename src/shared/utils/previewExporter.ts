export type PreviewRow = {
  step: string;
  action: string;
  date: string;
  merchant: string;
  amount: number;
  currentCategory: string;
  currentTags: string;
  change: string;
  newValue: string;
};

const CSV_HEADERS = [
  'Step',
  'Action',
  'Date',
  'Merchant',
  'Amount',
  'Current Category',
  'Current Tags',
  'What Changes',
  'New Value',
];

export function previewRowsToCsv(rows: PreviewRow[]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escape(r.step),
        escape(r.action),
        r.date,
        escape(r.merchant),
        r.amount.toString(),
        escape(r.currentCategory),
        escape(r.currentTags),
        escape(r.change),
        escape(r.newValue),
      ].join(','),
    );
  }
  return lines.join('\n');
}

export function downloadPreviewCsv(rows: PreviewRow[]) {
  const csv = previewRowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  chrome.downloads.download({ url, filename: `Compta_Preview_${date}.csv`, saveAs: true });
}
