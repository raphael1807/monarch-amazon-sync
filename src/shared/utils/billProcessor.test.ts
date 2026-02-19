import { describe, it, expect } from 'vitest';
import {
  detectTaxTypeFromTags,
  calculateBillBreakdown,
  formatBillNote,
  transactionAlreadyHasBill,
  swapTag,
  removeTagFromList,
} from './billProcessor';

describe('billProcessor', () => {
  describe('detectTaxTypeFromTags', () => {
    it('detects gst+qst', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'txs [tps + tvq [14.975%]]' }])).toBe('gst_qst');
    });

    it('detects gst only', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'txs [tps inclus [5%]]' }])).toBe('gst_only');
    });

    it('detects qst only', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'txs [tvq inclus [9.975%]]' }])).toBe('qst_only');
    });

    it('detects insurance', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'txs assur [9%]' }])).toBe('insurance');
    });

    it('detects no tax', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'txs [sans [0%]]' }])).toBe('none');
    });

    it('returns null for no matching tag', () => {
      expect(detectTaxTypeFromTags([{ id: '1', name: 'some other tag' }])).toBeNull();
    });

    it('returns null for empty tags', () => {
      expect(detectTaxTypeFromTags([])).toBeNull();
    });
  });

  describe('calculateBillBreakdown', () => {
    it('back-calculates TPS+TVQ from $100 total', () => {
      const b = calculateBillBreakdown(-100, 'gst_qst');
      expect(b.subtotal).toBeCloseTo(86.98, 1);
      expect(b.tps).toBeCloseTo(4.35, 1);
      expect(b.tvq).toBeCloseTo(8.68, 1);
      expect(b.total).toBe(100);
    });

    it('back-calculates TPS only from $105', () => {
      const b = calculateBillBreakdown(-105, 'gst_only');
      expect(b.subtotal).toBe(100);
      expect(b.tps).toBe(5);
      expect(b.tvq).toBe(0);
    });

    it('handles no tax', () => {
      const b = calculateBillBreakdown(-50, 'none');
      expect(b.subtotal).toBe(50);
      expect(b.tps).toBe(0);
      expect(b.tvq).toBe(0);
    });

    it('handles insurance 9%', () => {
      const b = calculateBillBreakdown(-109, 'insurance');
      expect(b.subtotal).toBe(100);
      expect(b.tvq).toBe(9);
    });
  });

  describe('formatBillNote', () => {
    it('includes Facture header', () => {
      const b = calculateBillBreakdown(-114.98, 'gst_qst');
      const note = formatBillNote(b);
      expect(note).toContain('--- Facture ---');
      expect(note).toContain('Sous-total:');
      expect(note).toContain('TPS (5%):');
      expect(note).toContain('TVQ (9.975%):');
      expect(note).toContain('Total:');
    });

    it('shows no tax message for none', () => {
      const b = calculateBillBreakdown(-50, 'none');
      const note = formatBillNote(b);
      expect(note).toContain('Aucune taxe applicable');
    });
  });

  describe('transactionAlreadyHasBill', () => {
    it('returns true if notes contain bill marker', () => {
      expect(transactionAlreadyHasBill('some text\n--- Facture ---\nmore')).toBe(true);
    });

    it('returns false for empty notes', () => {
      expect(transactionAlreadyHasBill('')).toBe(false);
    });
  });

  describe('swapTag', () => {
    it('removes old and adds new', () => {
      const tags = [
        { id: 'a', name: 'old' },
        { id: 'b', name: 'keep' },
      ];
      const result = swapTag(tags, 'a', 'c');
      expect(result).toEqual(['b', 'c']);
    });
  });

  describe('removeTagFromList', () => {
    it('removes specified tag', () => {
      const tags = [
        { id: 'a', name: 'remove' },
        { id: 'b', name: 'keep' },
      ];
      expect(removeTagFromList(tags, 'a')).toEqual(['b']);
    });
  });
});
