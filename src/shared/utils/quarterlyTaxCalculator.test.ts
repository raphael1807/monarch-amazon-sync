import { describe, it, expect } from 'vitest';
import { getQuarter, calculateQuarterlyTax } from './quarterlyTaxCalculator';

describe('quarterlyTaxCalculator', () => {
  describe('getQuarter', () => {
    it('Q1 for Jan-Mar', () => {
      expect(getQuarter('2025-01-15')).toBe(1);
      expect(getQuarter('2025-02-28')).toBe(1);
      expect(getQuarter('2025-03-31')).toBe(1);
    });

    it('Q2 for Apr-Jun', () => {
      expect(getQuarter('2025-04-01')).toBe(2);
      expect(getQuarter('2025-06-30')).toBe(2);
    });

    it('Q3 for Jul-Sep', () => {
      expect(getQuarter('2025-07-01')).toBe(3);
    });

    it('Q4 for Oct-Dec', () => {
      expect(getQuarter('2025-12-31')).toBe(4);
    });
  });

  describe('calculateQuarterlyTax', () => {
    it('calculates TPS/TVQ for revenues and expenses', () => {
      const revenues = [{ date: '2025-01-15', amount: 1149.75, taxTag: 'txs [tps + tvq [14.975%]]' }];
      const expenses = [{ date: '2025-01-20', amount: -114.98, taxTag: 'txs [tps + tvq [14.975%]]' }];

      const result = calculateQuarterlyTax(revenues, expenses, 2025);
      const q1 = result.find(q => q.quarter === 1)!;

      expect(q1.tpsCollected).toBeGreaterThan(0);
      expect(q1.tvqCollected).toBeGreaterThan(0);
      expect(q1.tpsPaid).toBeGreaterThan(0);
      expect(q1.tvqPaid).toBeGreaterThan(0);
      expect(q1.netTps).toBe(q1.tpsCollected - q1.tpsPaid);
      expect(q1.netTvq).toBe(q1.tvqCollected - q1.tvqPaid);
    });

    it('returns 4 quarters', () => {
      const result = calculateQuarterlyTax([], [], 2025);
      expect(result.length).toBe(4);
      expect(result.map(q => q.quarter)).toEqual([1, 2, 3, 4]);
    });

    it('handles empty data', () => {
      const result = calculateQuarterlyTax([], [], 2025);
      const q1 = result[0];
      expect(q1.tpsCollected).toBe(0);
      expect(q1.tvqCollected).toBe(0);
      expect(q1.netTps).toBe(0);
    });
  });
});
