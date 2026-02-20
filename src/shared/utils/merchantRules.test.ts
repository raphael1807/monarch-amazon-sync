import { describe, it, expect } from 'vitest';
import { findMerchantCategory, normalizeMerchant, MERCHANT_CATEGORY_MAP } from './merchantRules';

describe('merchantRules', () => {
  describe('normalizeMerchant', () => {
    it('lowercases and trims', () => {
      expect(normalizeMerchant('  Anthropic  ')).toBe('anthropic');
    });

    it('handles empty string', () => {
      expect(normalizeMerchant('')).toBe('');
    });
  });

  describe('MERCHANT_CATEGORY_MAP', () => {
    it('has entries for known consistent merchants', () => {
      expect(Object.keys(MERCHANT_CATEGORY_MAP).length).toBeGreaterThan(20);
    });

    it('maps Anthropic to softwares [rapha_business]', () => {
      expect(MERCHANT_CATEGORY_MAP['anthropic']).toBe('softwares [rapha_business]');
    });

    it('maps Maxi to groceries [food]', () => {
      expect(MERCHANT_CATEGORY_MAP['maxi']).toBe('groceries [food]');
    });
  });

  describe('findMerchantCategory', () => {
    it('finds exact match', () => {
      expect(findMerchantCategory('Anthropic')).toBe('softwares [rapha_business]');
    });

    it('finds partial match with prefix', () => {
      expect(findMerchantCategory('Cursor Usage Mid Feb')).toBe('softwares [rapha_business]');
    });

    it('returns null for unknown merchant', () => {
      expect(findMerchantCategory('Random Unknown Store')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(findMerchantCategory('ANTHROPIC')).toBe('softwares [rapha_business]');
    });

    it('handles empty string', () => {
      expect(findMerchantCategory('')).toBeNull();
    });

    it('maps Cursor to softwares [rapha_business]', () => {
      expect(findMerchantCategory('Cursor')).toBe('softwares [rapha_business]');
    });

    it('maps Fizz to internet [housing]', () => {
      expect(findMerchantCategory('Fizz, internet')).toBe('internet [housing]');
    });

    it('maps Desjardins Assurances to auto_insurance [financial]', () => {
      expect(findMerchantCategory('Desjardins Assurances')).toBe('auto_insurance [financial]');
    });
  });
});
