import { describe, it, expect } from 'vitest';
import {
  isBusinessCategory,
  isIncomeCategory,
  isInsuranceCategory,
  isMissingExpenseTag,
  isMissingRevenueTag,
  isMissingTaxTag,
  needsBillTag,
  BUSINESS_CATEGORY_GROUPS,
  INCOME_CATEGORY_NAMES,
  INSURANCE_CATEGORY_NAMES,
} from './autoTagger';

const makeTx = (category: string, tags: string[] = [], notes = '') => ({
  id: '1',
  amount: -100,
  date: '2025-01-01',
  notes,
  category: { id: 'cat1', name: category },
  tags: tags.map((name, i) => ({ id: `tag${i}`, name })),
});

describe('autoTagger', () => {
  describe('isBusinessCategory', () => {
    it('returns true for rapha_business categories', () => {
      expect(isBusinessCategory('softwares [rapha_business]')).toBe(true);
      expect(isBusinessCategory('advertising [rapha_business]')).toBe(true);
    });

    it('returns true for farmzz categories', () => {
      expect(isBusinessCategory('softwares [farmzz]')).toBe(true);
    });

    it('returns false for personal categories', () => {
      expect(isBusinessCategory('groceries [food]')).toBe(false);
      expect(isBusinessCategory('rent [housing]')).toBe(false);
    });

    it('returns false for null/empty', () => {
      expect(isBusinessCategory(null)).toBe(false);
      expect(isBusinessCategory('')).toBe(false);
    });
  });

  describe('isIncomeCategory', () => {
    it('returns true for paycheck', () => {
      expect(isIncomeCategory('paycheck')).toBe(true);
      expect(isIncomeCategory('paycheck [+]')).toBe(true);
    });

    it('returns true for rapha income', () => {
      expect(isIncomeCategory('rapha income')).toBe(true);
    });

    it('returns false for interest and government', () => {
      expect(isIncomeCategory('interest')).toBe(false);
      expect(isIncomeCategory('government')).toBe(false);
    });
  });

  describe('isInsuranceCategory', () => {
    it('returns true for insurance categories', () => {
      expect(isInsuranceCategory('house_insurance')).toBe(true);
      expect(isInsuranceCategory('auto_insurance')).toBe(true);
      expect(isInsuranceCategory('invalidity_insurance')).toBe(true);
      expect(isInsuranceCategory('house_insurance [financial]')).toBe(true);
    });

    it('returns false for non-insurance', () => {
      expect(isInsuranceCategory('financial_fees')).toBe(false);
    });
  });

  describe('isMissingExpenseTag', () => {
    it('returns true when no expense tags present', () => {
      const tx = makeTx('softwares [rapha_business]', []);
      expect(isMissingExpenseTag(tx)).toBe(true);
    });

    it('returns false when "to add" tag present', () => {
      const tx = makeTx('softwares [rapha_business]', ['[-] rapha, expenses; to add']);
      expect(isMissingExpenseTag(tx)).toBe(false);
    });

    it('returns false when "added" tag present', () => {
      const tx = makeTx('softwares [rapha_business]', ['[-] rapha, expenses; added']);
      expect(isMissingExpenseTag(tx)).toBe(false);
    });

    it('returns true for farmzz missing tag', () => {
      const tx = makeTx('softwares [farmzz]', []);
      expect(isMissingExpenseTag(tx)).toBe(true);
    });

    it('returns false for farmzz with tag', () => {
      const tx = makeTx('softwares [farmzz]', ['[-] farmzz, expenses; to add']);
      expect(isMissingExpenseTag(tx)).toBe(false);
    });
  });

  describe('isMissingRevenueTag', () => {
    it('returns true when no revenue tags', () => {
      const tx = makeTx('paycheck [+]', []);
      expect(isMissingRevenueTag(tx)).toBe(true);
    });

    it('returns false when tagged', () => {
      const tx = makeTx('paycheck [+]', ['[+] rapha, revenue; to add']);
      expect(isMissingRevenueTag(tx)).toBe(false);
    });
  });

  describe('isMissingTaxTag', () => {
    it('returns true when no tax tags', () => {
      const tx = makeTx('softwares [rapha_business]', ['[-] rapha, expenses; to add']);
      expect(isMissingTaxTag(tx)).toBe(true);
    });

    it('returns false when has tax tag', () => {
      const tx = makeTx('softwares [rapha_business]', ['txs [tps + tvq [14.975%]]']);
      expect(isMissingTaxTag(tx)).toBe(false);
    });

    it('returns false for insurance tax tag', () => {
      const tx = makeTx('auto_insurance [financial]', ['txs assur [9%]']);
      expect(isMissingTaxTag(tx)).toBe(false);
    });
  });

  describe('needsBillTag', () => {
    it('returns true for business tx with tax tag but no bill', () => {
      const tx = makeTx('softwares [rapha_business]', ['txs [tps + tvq [14.975%]]'], '');
      expect(needsBillTag(tx)).toBe(true);
    });

    it('returns false if already has bill in notes', () => {
      const tx = makeTx('softwares [rapha_business]', ['txs [tps + tvq [14.975%]]'], '--- Facture ---');
      expect(needsBillTag(tx)).toBe(false);
    });

    it('returns false if already has add bill tag', () => {
      const tx = makeTx('softwares [rapha_business]', ['txs [tps + tvq [14.975%]]', '🧾 add bill']);
      expect(needsBillTag(tx)).toBe(false);
    });

    it('returns false if no tax tag', () => {
      const tx = makeTx('softwares [rapha_business]', []);
      expect(needsBillTag(tx)).toBe(false);
    });
  });

  describe('constants', () => {
    it('BUSINESS_CATEGORY_GROUPS includes rapha_business and farmzz', () => {
      expect(BUSINESS_CATEGORY_GROUPS).toContain('rapha_business');
      expect(BUSINESS_CATEGORY_GROUPS).toContain('farmzz');
    });

    it('INCOME_CATEGORY_NAMES includes paycheck', () => {
      expect(INCOME_CATEGORY_NAMES).toContain('paycheck');
    });

    it('INSURANCE_CATEGORY_NAMES has 3 entries', () => {
      expect(INSURANCE_CATEGORY_NAMES.length).toBe(3);
    });
  });
});
