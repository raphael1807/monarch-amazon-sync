import { describe, it, expect } from 'vitest';
import { buildMerchantTaxMap, getMerchantTaxTag, type MerchantTaxEntry } from './taxRateLearner';

const makeTx = (merchant: string, tags: string[]) => ({
  id: '1',
  amount: -100,
  date: '2025-01-01',
  notes: '',
  category: { id: 'cat1', name: 'softwares [rapha_business]' },
  tags: tags.map((name, i) => ({ id: `tag${i}`, name })),
  originalMerchant: { id: 'm1', name: merchant },
});

describe('taxRateLearner', () => {
  describe('buildMerchantTaxMap', () => {
    it('builds map from consistent merchants', () => {
      const txns = [
        makeTx('Anthropic', ['txs [tps inclus [5%]]']),
        makeTx('Anthropic', ['txs [tps inclus [5%]]']),
        makeTx('Figma', ['txs [sans [0%]]']),
      ];
      const map = buildMerchantTaxMap(txns);
      expect(map['anthropic'].taxTag).toBe('txs [tps inclus [5%]]');
      expect(map['anthropic'].consistent).toBe(true);
      expect(map['anthropic'].count).toBe(2);
      expect(map['figma'].taxTag).toBe('txs [sans [0%]]');
    });

    it('marks inconsistent merchants', () => {
      const txns = [makeTx('Amazon', ['txs [tps + tvq [14.975%]]']), makeTx('Amazon', ['txs [tps inclus [5%]]'])];
      const map = buildMerchantTaxMap(txns);
      expect(map['amazon'].consistent).toBe(false);
    });

    it('skips transactions without tax tags', () => {
      const txns = [makeTx('NoTag', ['[-] rapha, expenses; to add'])];
      const map = buildMerchantTaxMap(txns);
      expect(map['notag']).toBeUndefined();
    });
  });

  describe('getMerchantTaxTag', () => {
    const map: Record<string, MerchantTaxEntry> = {
      anthropic: { taxTag: 'txs [tps inclus [5%]]', count: 10, consistent: true },
      amazon: { taxTag: 'txs [tps + tvq [14.975%]]', count: 23, consistent: false },
    };

    it('returns tag for consistent merchant', () => {
      expect(getMerchantTaxTag('Anthropic', map)).toBe('txs [tps inclus [5%]]');
    });

    it('returns null for inconsistent merchant', () => {
      expect(getMerchantTaxTag('Amazon', map)).toBeNull();
    });

    it('returns null for unknown merchant', () => {
      expect(getMerchantTaxTag('Unknown', map)).toBeNull();
    });
  });
});
