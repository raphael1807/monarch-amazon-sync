import type { MonarchCategory } from '@root/src/shared/api/monarchApi';
import { getCategoryDisplayName } from '@root/src/shared/utils/categoryMatcher';

const GROUP_ORDER = [
  'income',
  'food',
  'auto',
  'housing',
  'health & fitness',
  'personal',
  'shopping',
  'rapha_business',
  'farmzz',
  'other',
  'financial',
  'children',
  'transfers',
];

const EMOJI_MAP: Record<string, string> = {
  paycheck: '💵',
  'rapha income': '🏢',
  interest: '💸',
  'other income': '💰',
  refund: '😔',
  government: '🏛️',
  groceries: '🍏',
  restaurants: '🍽',
  'coffee shop': '☕️',
  public_transit: '🚃',
  gas: '⛽️',
  maintenance: '🔧',
  'parking&tolls': '🏢',
  'taxi&ride_shares': '🚕',
  auto_payment: '🚗',
  rent: '🏠',
  home_improvement: '🔨',
  furniture: '🪑',
  electricity: '⚡️',
  internet: '🌐',
  water: '💧',
  garbage: '🗑',
  mortgage: '🏠',
  medical: '💊',
  suppléments: '💉',
  dentist: '🦷',
  spa: '🛁',
  coach: '🦾',
  gym: '💪',
  martial_arts: '🥋',
  gear: '🏋️',
  recovery: '💆‍♂️',
  bike: '🚲',
  administrative: '🧑‍⚖️',
  phone: '📱',
  haircut: '💇',
  subscriptions: '🔄',
  education: '🏫',
  'entertainment & recreation': '🎥',
  fun_money: '😜',
  vacation: '🏝',
  beauty: '🧼',
  gifts: '🎁',
  student_loans: '🎓',
  pets: '🐶',
  general: '🛍',
  clothing: '👕',
  electronics: '🖥',
  advertising: '📣',
  'utilities&communication': '📞',
  employee_wages: '👪',
  'travel & meals': '🍴',
  'travel&meals': '🍴',
  auto_expenses: '🚖',
  insurance: '📁',
  office_supplies: '📎',
  office_rent: '🏢',
  'postage & shipping': '📦',
  formation: '🍎',
  hardware: '💻',
  softwares: '💿',
  other: '👔',
  uncategorized: '❓',
  miscellaneous: '💲',
  other_expense: '💳',
  check: '💸',
  loan_repayment: '💰',
  'financial&legal_services': '🗄',
  financial_fees: '🏦',
  'cash&ATM': '🏧',
  'taxes_tps&tvq': '🏛️',
  impôts: '👨‍⚖️',
  charity: '🎗',
  dîme: '⛪',
  house_insurance: '☂️',
  auto_insurance: '☂️',
  invalidity_insurance: '☂️',
  child_activities: '⚽️',
  child_care: '👶',
  transfer: '🔁',
  credit_card_payment: '💳',
  balance_adjustments: '⚖️',
  overdraft_protection: '💰',
};

function getEmoji(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower === key.toLowerCase() || lower.startsWith(key.toLowerCase())) {
      return emoji;
    }
  }
  return '';
}

type Props = {
  categories: MonarchCategory[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  placeholder?: string;
  className?: string;
};

export default function CategoryDropdown({
  categories,
  value,
  onChange,
  placeholder = '-- Pick a category --',
  className = '',
}: Props) {
  const grouped = new Map<string, MonarchCategory[]>();

  for (const cat of categories) {
    const groupName = cat.group.name;
    if (!grouped.has(groupName)) {
      grouped.set(groupName, []);
    }
    grouped.get(groupName)!.push(cat);
  }

  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    const aIdx = GROUP_ORDER.indexOf(a[0].toLowerCase());
    const bIdx = GROUP_ORDER.indexOf(b[0].toLowerCase());
    const aOrder = aIdx === -1 ? 999 : aIdx;
    const bOrder = bIdx === -1 ? 999 : bIdx;
    return aOrder - bOrder;
  });

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      title="Select category"
      aria-label="Select category"
      className={`w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 ${className}`}>
      <option value="">{placeholder}</option>
      {sortedGroups.map(([groupName, cats]) => (
        <optgroup key={groupName} label={`── ${groupName.toUpperCase()} ──`}>
          {cats.map(cat => (
            <option key={cat.id} value={cat.id}>
              {getEmoji(cat.name)} {getCategoryDisplayName(cat)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
