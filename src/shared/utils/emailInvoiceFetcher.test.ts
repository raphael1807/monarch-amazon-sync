import { describe, it, expect } from 'vitest';
import { buildGmailSearchQuery, formatEmailReceiptNote, type EmailReceipt } from './emailInvoiceFetcher';

describe('emailInvoiceFetcher', () => {
  describe('buildGmailSearchQuery', () => {
    it('builds query for Interac with counterparty', () => {
      const query = buildGmailSearchQuery('Interac', 4000, '2025-12-24', 'GM Agences');
      expect(query).toContain('interac');
      expect(query).toContain('4000');
      expect(query).toContain('GM Agences');
      expect(query).toContain('after:');
      expect(query).toContain('before:');
    });

    it('builds query for SaaS merchant', () => {
      const query = buildGmailSearchQuery('Anthropic', 8.96, '2025-02-17');
      expect(query).toContain('anthropic');
      expect(query).toContain('8.96');
    });

    it('uses +-3 day window', () => {
      const query = buildGmailSearchQuery('Test', 100, '2025-06-15');
      expect(query).toContain('after:2025/06/12');
      expect(query).toContain('before:2025/06/18');
    });
  });

  describe('formatEmailReceiptNote', () => {
    it('formats receipt with all fields', () => {
      const receipt: EmailReceipt = {
        from: 'noreply@interac.ca',
        subject: 'INTERAC e-Transfer from GM Agences',
        date: '2025-12-24',
        snippet: 'Payment received $4000',
      };
      const note = formatEmailReceiptNote(receipt);
      expect(note).toContain('--- Email Receipt ---');
      expect(note).toContain('noreply@interac.ca');
      expect(note).toContain('INTERAC e-Transfer from GM Agences');
    });

    it('handles missing fields gracefully', () => {
      const receipt: EmailReceipt = {
        from: '',
        subject: 'Payment',
        date: '2025-01-01',
        snippet: '',
      };
      const note = formatEmailReceiptNote(receipt);
      expect(note).toContain('--- Email Receipt ---');
      expect(note).toContain('Payment');
    });
  });
});
