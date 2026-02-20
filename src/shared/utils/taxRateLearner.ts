import type { MonarchTransaction, MonarchTag } from '../api/monarchApi';
import { normalizeMerchant } from './merchantRules';

const TAX_TAG_PREFIXES = ['txs [', 'txs assur'];

export type MerchantTaxEntry = {
  taxTag: string;
  count: number;
  consistent: boolean;
};

type ExtendedTx = MonarchTransaction & { originalMerchant?: { id: string; name: string } };

function findTaxTag(tags: { name: string }[]): string | null {
  for (const t of tags) {
    if (TAX_TAG_PREFIXES.some(p => t.name.startsWith(p))) return t.name;
  }
  return null;
}

export function buildMerchantTaxMap(transactions: ExtendedTx[]): Record<string, MerchantTaxEntry> {
  const merchantData: Record<string, { tags: Set<string>; count: number }> = {};

  for (const tx of transactions) {
    const merchant = tx.originalMerchant?.name;
    if (!merchant) continue;

    const taxTag = findTaxTag(tx.tags ?? []);
    if (!taxTag) continue;

    const key = normalizeMerchant(merchant);
    if (!merchantData[key]) {
      merchantData[key] = { tags: new Set(), count: 0 };
    }
    merchantData[key].tags.add(taxTag);
    merchantData[key].count++;
  }

  const result: Record<string, MerchantTaxEntry> = {};
  for (const [merchant, data] of Object.entries(merchantData)) {
    const tagsArr = Array.from(data.tags);
    result[merchant] = {
      taxTag: tagsArr[0],
      count: data.count,
      consistent: tagsArr.length === 1,
    };
  }

  return result;
}

export function getMerchantTaxTag(merchantName: string, map: Record<string, MerchantTaxEntry>): string | null {
  const key = normalizeMerchant(merchantName);
  const entry = map[key];
  if (!entry || !entry.consistent) return null;
  return entry.taxTag;
}

export const DEFAULT_BUSINESS_TAX_TAG = 'txs [tps + tvq [14.975%]]';
export const INSURANCE_TAX_TAG = 'txs assur [9%]';

export async function applyLearnedTaxRates(
  authKey: string,
  transactions: ExtendedTx[],
  merchantTaxMap: Record<string, MerchantTaxEntry>,
  findOrCreateTag: (name: string) => Promise<MonarchTag>,
  setTags: (authKey: string, txId: string, tagIds: string[]) => Promise<unknown>,
): Promise<{ applied: number; unknown: ExtendedTx[] }> {
  let applied = 0;
  const unknown: ExtendedTx[] = [];

  for (const tx of transactions) {
    const hasTax = (tx.tags ?? []).some(t => TAX_TAG_PREFIXES.some(p => t.name.startsWith(p)));
    if (hasTax) continue;

    const merchant = tx.originalMerchant?.name;
    if (!merchant) {
      unknown.push(tx);
      continue;
    }

    const taxTagName = getMerchantTaxTag(merchant, merchantTaxMap);
    if (!taxTagName) {
      unknown.push(tx);
      continue;
    }

    const tag = await findOrCreateTag(taxTagName);
    const currentIds = (tx.tags ?? []).map(t => t.id);
    await setTags(authKey, tx.id, [...currentIds, tag.id]);
    applied++;
  }

  return { applied, unknown };
}
