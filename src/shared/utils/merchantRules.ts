export const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  // rapha_business
  anthropic: 'softwares [rapha_business]',
  cursor: 'softwares [rapha_business]',
  'cursor usage': 'softwares [rapha_business]',
  'fathom video': 'softwares [rapha_business]',
  monologue: 'softwares [rapha_business]',
  screenstudio: 'softwares [rapha_business]',
  lemonsqueezy: 'softwares [rapha_business]',
  figma: 'softwares [rapha_business]',
  clockify: 'softwares [rapha_business]',
  dialpad: 'utilities&communication [rapha_business]',
  godaddy: 'advertising [rapha_business]',
  'magnetic marketing': 'advertising [rapha_business]',
  magneticmarketing: 'advertising [rapha_business]',
  openrouter: 'softwares [rapha_business]',
  'claude ai': 'softwares [rapha_business]',
  vistaprint: 'advertising [rapha_business]',
  fiverr: 'advertising [rapha_business]',
  copythatchallenge: 'formation [rapha_business]',
  'saas growth coach': 'formation [rapha_business]',
  'deep tech community': 'advertising [rapha_business]',
  blueprintgtm: 'formation [rapha_business]',

  // food
  maxi: 'groceries [food]',
  provigo: 'groceries [food]',
  iga: 'groceries [food]',
  metro: 'groceries [food]',
  'super c': 'groceries [food]',
  'costco wholesale': 'groceries [food]',
  walmart: 'groceries [food]',
  dollarama: 'groceries [food]',
  'couche-tard': 'groceries [food]',
  'tim hortons': 'coffee shop [food]',
  starbucks: 'coffee shop [food]',
  "mcdonald's": 'restaurants [food]',
  subway: 'restaurants [food]',
  'a&w': 'restaurants [food]',

  // housing
  fizz: 'internet [housing]',
  'hydro-québec': 'electricity [housing]',
  'hydro-quebec': 'electricity [housing]',
  loyer: 'rent [housing]',

  // personal
  icloud: 'subscriptions [personal]',
  youtube: 'education [personal]',
  scribd: 'subscriptions [personal]',
  apple: 'subscriptions [personal]',

  // auto
  'costco gas': 'gas [auto]',
  ultramar: 'gas [auto]',
  'petro-canada': 'gas [auto]',
  esso: 'gas [auto]',
  shell: 'gas [auto]',
  'bay ferry': 'public_transit [auto]',
  stm: 'public_transit [auto]',

  // financial
  'desjardins assurances': 'auto_insurance [financial]',
  beneva: 'house_insurance [financial]',
  'desjardins sécurité financière': 'invalidity_insurance [financial]',
  'desjardins, assurance invalidité': 'invalidity_insurance [financial]',
  'ia groupe financier': 'loan_repayment [financial]',
  'fixed monthly fee': 'financial_fees [financial]',
  'université laval don': 'charity [financial]',
  'our rescue': 'charity [financial]',

  // fitness
  'planete fitnes': 'gym [fitness]',
  'planet fitness': 'gym [fitness]',
  rozon: 'coach [fitness]',

  // health
  pharmaprix: 'medical [health]',
  'jean coutu': 'medical [health]',

  // shopping
  klarna: 'clothing [shopping]',
  simons: 'clothing [shopping]',
};

export function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().trim();
}

export function findMerchantCategory(merchantName: string): string | null {
  if (!merchantName) return null;
  const normalized = normalizeMerchant(merchantName);

  if (MERCHANT_CATEGORY_MAP[normalized]) {
    return MERCHANT_CATEGORY_MAP[normalized];
  }

  for (const [key, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (normalized.startsWith(key) || normalized.includes(key)) {
      return category;
    }
  }

  return null;
}
