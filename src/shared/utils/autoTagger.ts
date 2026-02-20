import type { MonarchTransaction, MonarchTag, MonarchCategory } from '../api/monarchApi';

export const BUSINESS_CATEGORY_GROUPS = ['rapha_business', 'farmzz'];

export const INCOME_CATEGORY_NAMES = ['paycheck', 'rapha income'];

export const INSURANCE_CATEGORY_NAMES = ['house_insurance', 'auto_insurance', 'invalidity_insurance'];

const EXPENSE_TAG_PATTERNS = [
  '[-] rapha, expenses; to add',
  '[-] rapha, expenses; added',
  '[-] farmzz, expenses; to add',
  '[-] farmzz, expenses; added',
];

const REVENUE_TAG_PATTERNS = ['[+] rapha, revenue; to add', '[+] rapha, revenue; added'];

const TAX_TAG_PREFIXES = ['txs [', 'txs assur'];

function getCategoryGroup(categoryName: string | null | undefined): string | null {
  if (!categoryName) return null;
  const match = categoryName.match(/\[([^\]]+)\]$/);
  return match ? match[1] : null;
}

export function isBusinessCategory(categoryName: string | null | undefined): boolean {
  const group = getCategoryGroup(categoryName);
  return group ? BUSINESS_CATEGORY_GROUPS.includes(group) : false;
}

export function isBusinessCategoryObj(cat: MonarchCategory): boolean {
  const groupName = cat.group?.name?.toLowerCase() ?? '';
  return BUSINESS_CATEGORY_GROUPS.some(g => groupName === g || groupName.includes(g));
}

export function isIncomeCategoryObj(cat: MonarchCategory): boolean {
  const catName = cat.name?.toLowerCase() ?? '';
  return INCOME_CATEGORY_NAMES.some(n => catName === n || catName.startsWith(n));
}

export function isInsuranceCategoryObj(cat: MonarchCategory): boolean {
  const catName = cat.name?.toLowerCase() ?? '';
  return INSURANCE_CATEGORY_NAMES.some(n => catName === n || catName.startsWith(n)) || catName.includes('insurance');
}

export function isUncategorizedCategoryObj(cat: MonarchCategory): boolean {
  const catName = cat.name?.toLowerCase() ?? '';
  const groupName = cat.group?.name?.toLowerCase() ?? '';
  return (
    catName.includes('uncategorized') ||
    catName === 'general' ||
    (catName === 'general' && groupName.includes('shopping'))
  );
}

export function isIncomeCategory(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return INCOME_CATEGORY_NAMES.some(n => lower.startsWith(n));
}

export function isInsuranceCategory(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return INSURANCE_CATEGORY_NAMES.some(n => lower.startsWith(n)) || lower.includes('insurance');
}

function hasAnyTag(tags: { name: string }[], patterns: string[]): boolean {
  return tags.some(t => patterns.includes(t.name));
}

function hasAnyTaxTag(tags: { name: string }[]): boolean {
  return tags.some(t => TAX_TAG_PREFIXES.some(prefix => t.name.startsWith(prefix)));
}

export function isMissingExpenseTag(tx: MonarchTransaction): boolean {
  return !hasAnyTag(tx.tags ?? [], EXPENSE_TAG_PATTERNS);
}

export function isMissingRevenueTag(tx: MonarchTransaction): boolean {
  return !hasAnyTag(tx.tags ?? [], REVENUE_TAG_PATTERNS);
}

export function isMissingTaxTag(tx: MonarchTransaction): boolean {
  return !hasAnyTaxTag(tx.tags ?? []);
}

export function needsBillTag(tx: MonarchTransaction): boolean {
  const tags = tx.tags ?? [];
  if (!hasAnyTaxTag(tags)) return false;
  if (tags.some(t => t.name === '🧾 add bill')) return false;
  if ((tx.notes ?? '').includes('--- Facture ---')) return false;
  return true;
}

export function getExpenseTagName(categoryName: string): string {
  const group = getCategoryGroup(categoryName);
  if (group === 'farmzz') return '[-] farmzz, expenses; to add';
  return '[-] rapha, expenses; to add';
}

export type AutoTagResult = {
  expensesTagged: number;
  revenuesTagged: number;
  insuranceTagged: number;
  billsTagged: number;
  errors: string[];
};

export async function runAutoTagger(
  authKey: string,
  allTags: MonarchTag[],
  allCategories: MonarchCategory[],
  getTransactions: (authKey: string, categoryIds: string[]) => Promise<MonarchTransaction[]>,
  setTags: (authKey: string, txId: string, tagIds: string[]) => Promise<unknown>,
  findOrCreateTag: (name: string) => Promise<MonarchTag>,
): Promise<AutoTagResult> {
  const result: AutoTagResult = {
    expensesTagged: 0,
    revenuesTagged: 0,
    insuranceTagged: 0,
    billsTagged: 0,
    errors: [],
  };

  const businessCatIds = allCategories.filter(isBusinessCategoryObj).map(c => c.id);
  const incomeCatIds = allCategories.filter(isIncomeCategoryObj).map(c => c.id);
  const insuranceCatIds = allCategories.filter(isInsuranceCategoryObj).map(c => c.id);

  // P1: Tag missing expenses
  if (businessCatIds.length > 0) {
    try {
      const txns = await getTransactions(authKey, businessCatIds);
      for (const tx of txns) {
        if (isMissingExpenseTag(tx)) {
          const tagName = getExpenseTagName(tx.category?.name ?? '');
          const tag = await findOrCreateTag(tagName);
          const currentIds = (tx.tags ?? []).map(t => t.id);
          if (!currentIds.includes(tag.id)) {
            await setTags(authKey, tx.id, [...currentIds, tag.id]);
            result.expensesTagged++;
          }
        }

        // P3: Tag missing bills
        if (needsBillTag(tx)) {
          const billTag = await findOrCreateTag('🧾 add bill');
          const currentIds = (tx.tags ?? []).map(t => t.id);
          if (!currentIds.includes(billTag.id)) {
            await setTags(authKey, tx.id, [...currentIds, billTag.id]);
            result.billsTagged++;
          }
        }
      }
    } catch (err) {
      result.errors.push(`Expense tagging: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // P5 (revenue): Tag missing revenues
  if (incomeCatIds.length > 0) {
    try {
      const txns = await getTransactions(authKey, incomeCatIds);
      for (const tx of txns) {
        if (tx.amount <= 0) continue;
        if (isMissingRevenueTag(tx)) {
          const tag = await findOrCreateTag('[+] rapha, revenue; to add');
          const currentIds = (tx.tags ?? []).map(t => t.id);
          if (!currentIds.includes(tag.id)) {
            await setTags(authKey, tx.id, [...currentIds, tag.id]);
            result.revenuesTagged++;
          }
        }
      }
    } catch (err) {
      result.errors.push(`Revenue tagging: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // P4: Tag insurance with txs assur [9%]
  if (insuranceCatIds.length > 0) {
    try {
      const txns = await getTransactions(authKey, insuranceCatIds);
      for (const tx of txns) {
        if (isMissingTaxTag(tx)) {
          const tag = await findOrCreateTag('txs assur [9%]');
          const currentIds = (tx.tags ?? []).map(t => t.id);
          if (!currentIds.includes(tag.id)) {
            await setTags(authKey, tx.id, [...currentIds, tag.id]);
            result.insuranceTagged++;
          }
        }
      }
    } catch (err) {
      result.errors.push(`Insurance tagging: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  return result;
}
