import type { MonarchCategory } from '../api/monarchApi';
import type { CategoryRule } from '../storages/appStorage';

export type CategorySuggestion = {
  transactionId: string;
  currentCategory: string | null;
  suggestedCategory: string;
  suggestedCategoryId: string;
  itemTitles: string[];
  matchedKeyword: string;
  confidence: 'high' | 'medium' | 'low';
};

const DEFAULT_RULES: CategoryRule[] = [
  {
    categoryName: 'subscriptions [personal]',
    priority: 95,
    keywords: ['amazon prime', 'prime membership', 'amazon.ca rewards'],
  },
  {
    categoryName: 'suppléments [health]',
    priority: 90,
    keywords: [
      'magnesium',
      'magnésium',
      'bisglycinate',
      'protein powder',
      'protéine',
      'protéines en poudre',
      'creatine',
      'créatine',
      'creatine monohydrate',
      'caffeine pill',
      'caffeine tablet',
      'caféine',
      'vitamin',
      'vitamine',
      'omega 3',
      'omega-3',
      'fish oil',
      'huile de poisson',
      'zinc citrate',
      'zinc 50',
      'chelated zinc',
      'inositol',
      'theanine',
      'l-theanine',
      'glutamine',
      'l-glutamine',
      'potassium citrate',
      'weight gainer',
      'mass gainer',
      'mutant mass',
      'mammoth mass',
      'allwhey',
      'whey isolate',
      'whey protein',
      'allmax',
      'mutant caffeine',
      'nutridom caffeine',
      'pump addict',
      'supplement',
      'supplément',
      'multivitamin',
      'epsom salt',
      'collagen',
      'probiotic',
      'turmeric',
      'curcuma',
      "nature's bounty",
      'webber naturals',
      'jamieson',
      'organika',
      'canprev',
      'naka platinum',
    ],
  },
  {
    categoryName: 'phone [personal]',
    priority: 88,
    keywords: [
      'iphone case',
      'coque iphone',
      'screen protector for iphone',
      'screen protector compatible with iphone',
      'phone case',
      'phone holder',
      'support de téléphone',
      'lightning cable',
      'iphone charger',
      'apple earbuds',
      'ear plug',
      'earplug',
      'ear tip',
      'earbud',
      'earphone',
      'usb c adapter',
      'adaptateur usb',
      'syntech usb',
      'phone charger',
      'apple mfi certified',
      'mfi certified',
      'iphone 14',
      'iphone 13',
      'iphone 12',
      'iphone 11',
      "new'c",
      'jetech',
    ],
  },
  {
    categoryName: 'bike [fitness]',
    priority: 87,
    keywords: [
      'camelbak',
      'bike light',
      'feux de vélo',
      'bike tool',
      'chain tool',
      'chainring',
      'plateau de pédalier',
      'bicycle',
      'vélo',
      'cycling',
      'podium',
      'fsa pro road',
      'fsa super road',
      'bike chain',
      'pedal',
      'spoke',
    ],
  },
  {
    categoryName: 'dentist [health]',
    priority: 87,
    keywords: ['dental floss', 'fil dentaire', 'flossers', 'toothpaste', 'dentifrice', 'colgate'],
  },
  {
    categoryName: 'haircut [personal]',
    priority: 87,
    keywords: ['hair clipper', 'tondeuse cheveux', 'hair trimmer'],
  },
  {
    categoryName: 'maintenance [auto]',
    priority: 85,
    keywords: [
      'rearview mirror',
      'car mirror',
      'driver mirror',
      'headlight bulb',
      'headlight restoration',
      'halogen',
      'sylvania',
      'ice scraper',
      'snow brush',
      'car key',
      'key fob',
      'keyless entry',
      'keyless2go',
      'car inverter',
      'onduleur de voiture',
      'cabin filter',
      'filtre à air',
      'wiper blade',
      'essuie-glace',
      'lug nut',
      'écrous de roue',
      'cerakote',
      'car snow',
      'razor blade scraper',
      'blind spot mirror',
      'car battery',
      'jump starter',
      'noco boost',
      'car phone mount',
    ],
  },
  {
    categoryName: 'electronics [shopping]',
    priority: 85,
    keywords: [
      'monitor',
      "écran d'ordinateur",
      'bluetooth tracker',
      'air tag',
      'atuvos',
      'displayport',
      'power bank',
      'chargeur portable',
      'battery case',
      'kindle',
      'fire tv stick',
      'fire stick',
      'sennheiser',
      'smart scale',
      'pèse-personne',
      'smarttrack',
      'hdmi cable',
      'câble hdmi',
      'usb c to hdmi',
      'usb-c to hdmi',
      'thunderbolt',
      'headphone jack adapter',
      'macbook charger',
      'mac book pro usb',
      'charger power adapter',
      'keyboard cleaning',
      'gel de nettoyage',
      'dji mic',
      'microphone',
      'benfei',
      'batteries',
      'cr2032',
      'lithium battery',
      'rechargeable batteries',
    ],
  },
  {
    categoryName: 'education [personal]',
    priority: 83,
    keywords: [
      'expert secrets',
      '$100m offers',
      '$100m leads',
      'outlive',
      'extreme ownership',
      'never split the difference',
      'the 48 laws',
      'art of seduction',
      "poor charlie's almanack",
      'rockefeller',
      'thou shall prosper',
      'questions to ask before',
      'sas survival guide',
      'singularity is near',
      'what you do is who you are',
      'principles for dealing',
      'cracking the pm',
      'measure what matters',
      'built to sell',
      'only the paranoid',
      'delivering happiness',
      'no more mr nice',
      'way of the superior',
      "l'obsession du service",
      'dis-moi qui tu aimes',
      'pourquoi nous dormons',
      'get scalable',
      "let's get deep",
    ],
  },
  {
    categoryName: 'formation [rapha_business]',
    priority: 82,
    keywords: [
      'start with no',
      'adweek copywriting',
      'teach you how to write',
      'getting everything you can',
      'e-myth revisited',
      'the boron letters',
      'business secrets from the bible',
      "it doesn't have to be crazy",
      'getting real',
      'value stream mapping',
      'saas sales method',
      'blueprints for a saas',
      'mastering account management',
    ],
  },
  {
    categoryName: 'beauty [personal]',
    priority: 80,
    keywords: [
      'deodorant',
      'déodorant',
      'déo',
      'soap bar',
      'savon',
      'bar soap',
      'shampoo',
      'shampooing',
      'conditioner',
      'après-shampooing',
      'moisturizer',
      'sunscreen',
      'lotion',
      'skincare',
      'toothbrush cover',
      'tongue scraper',
      'cuticle',
      'epilator',
      'épilateur',
      'exfoliat',
      'soap case',
      'soap dish',
      'rubbing alcohol',
      'désinfectant',
      'lingettes',
      'manucure',
      'pédicure',
      'moroccanoil',
      'cerave',
      'neutrogena',
      'dove men',
      'dove lot de',
      'schmidt',
      'matrix shampoo',
      'matrix conditioner',
      'matrix high amplify',
      'matrix total results',
      'old spice',
      'la roche-posay',
      'hello fresh citrus',
      'hello clean',
      'travel towel',
      'microfibre towel',
      'microfiber towel',
      'curl defining cream',
      'nose trimmer',
      'tondeuse nez',
      'tondeuse oreille',
      'body wash',
      'body scrub',
      'foot peel',
      'foot mask',
      'allenburys',
      'unscented company',
      'hair cream',
      'philips epilator',
      'bogi serviette',
      'sfee serviette',
      'travel bottle',
      'toiletries',
      'super glue',
      'lepage',
    ],
  },
  {
    categoryName: 'gear [fitness]',
    priority: 80,
    keywords: [
      'gym bag',
      'sac de sport',
      'duffle bag',
      'duffel bag',
      'sports bag',
      'running shoe',
      'garmin',
      'vívoactive',
      'vivoactive',
      'jump rope',
      'corde à sauter',
      'skipping rope',
      'gymnastics grip',
      'hand grip',
      'athletic tape',
      'sports tape',
      'swim goggle',
      'lunettes de natation',
      'posture corrector',
      'pilates ball',
      'exercise ball',
      'fitness ball',
      'combination lock',
      'combination padlock',
      'cadenas',
      'lifting strap',
      'wrist roller',
      'stopwatch',
      'chronomètre',
      'resistance band',
      'foam roller',
      'yoga block',
      'yoga mat',
      'shin guard',
      'protège-tibias',
      'hand wrap',
      'bandage professionnel',
      'boxing glove',
      'gant de boxe',
      'squat rack',
      'barbell',
      'barre chromée',
      'dumbbell',
      'haltère',
      'weight plate',
      'kettlebell',
      'compression pant',
      'rash guard',
      'under armour',
      'puma evercat',
      'everlast',
      'squat wedge',
      'calf stretcher',
      'slant board',
      'fitbit',
      'fitness tracker',
      'jawline exerciser',
      'lacrosse ball',
      'massage ball',
      'measure tape body',
      'mètre ruban',
      'arena swim',
      'arena cobra',
      'speedo',
      'swim short',
      'swim trunk',
      'mouth tape',
      'sleep strip',
      'nose dilator',
      'nasal dilator',
      'rubber mat',
      'tapis de fitness',
      'exercise mat',
      'rubber king',
      'door anchor',
      'bande de résistance',
      'pull up band',
      'wrist band',
      'coudière',
      'elbow sleeve',
      'headband sport',
      'bandeau sport',
      'rdx',
      'mma',
      'muay thai',
      'kickboxing',
      'jiu jitsu',
      'bjj',
      'fanny pack',
      'sac banane',
      'waist bag',
      'trail running',
      'goodvalue',
      'charged commit',
      'lunettes de cyclisme',
      'queshark',
      'performance tape',
      'sbc performance',
    ],
  },
  {
    categoryName: 'recovery [fitness]',
    priority: 80,
    keywords: [
      'sleep mask',
      'masque de sommeil',
      'eye mask',
      'massage oil',
      'huile de massage',
      'heating pad',
      'coussin chauffant',
      'massage tool',
      'gua sha',
      'acupuncture',
      'light therapy',
      'therapy lamp',
      'diffuser',
      'diffuseur',
      'aromatherapy',
      'aromathérapie',
      'cupping',
      'acupressure',
      'trigger point',
      'myofascial',
      'smarxin',
      'massage musculaire',
      'essential oil',
      'huile essentielle',
      'lavender oil',
      'eucalyptus oil',
      'room spray',
      "vaporisateur d'ambiance",
      'alcohol prep pad',
      'alcohol swab',
      'syringe',
      'seringue',
    ],
  },
  {
    categoryName: 'clothing [shopping]',
    priority: 80,
    keywords: [
      'crocs',
      'boxer',
      'underwear',
      'sous-vêtement',
      't-shirt',
      'tee shirt',
      'belt',
      'ceinture',
      'shoe horn',
      'chausse-pied',
      'jogging pant',
      'pantalon de jogging',
      'calvin klein',
      'emporio armani',
      'boss lot de',
      'timberland',
      'merino wool underwear',
      'débardeur',
      'tank top',
      'slippers',
      'sandals',
      'pantoufle',
      'condom',
      'trojan',
      'pillow slide',
      'new balance boxer',
      'goodthreads',
      'amazon essentials pantalon',
      'amazon essentials men',
    ],
  },
  {
    categoryName: 'office_supplies [rapha_business]',
    priority: 75,
    keywords: [
      'post-it',
      'sticky note',
      'printer ink',
      'ink cartridge',
      "cartouche d'encre",
      'printer paper',
      'copy paper',
      'laminating',
      'plastification',
      'highlighter',
      'surligneurs',
      'sticky tab',
      'onglets adhésifs',
      'sticky flag',
      'drapeaux de couleur',
      'mechanical pencil',
      'paper mate',
      'canon pg-210',
      'canon 2975b001',
      'canon 2974b001',
      'pomodoro',
      'minuteur cube',
      'productivity timer',
    ],
  },
  {
    categoryName: 'furniture [housing]',
    priority: 70,
    keywords: [
      'ninja foodi',
      'ninjafoodi',
      'nutribullet',
      'blender blade',
      'blender replacement',
      'mixeur',
      'cafetière',
      'espresso maker',
      'moka express',
      'coffee maker',
      'rice cooker',
      'cuiseur',
      'multicuiseur',
      'air fryer',
      'brita',
      'water filter',
      'filtre à eau',
      'dish rack',
      'dish drying',
      'égouttoir',
      'bath towel',
      'serviette de bain',
      'bedding',
      'parure de lit',
      'blanket',
      'couverture lestée',
      'weighted blanket',
      'mattress',
      'matelas',
      'vacuum',
      'aspirateur',
      'dyson',
      'nettoyant',
      'garbage bag',
      'sac poubelle',
      'oxiclean',
      'stain remover',
      'silverware',
      'flatware',
      'cutlery',
      'couverts',
      'utensil',
      'measuring cup',
      'cuillère à mesurer',
      'glass container',
      'récipient',
      'ice tray',
      'bac à glaçons',
      'toilet brush',
      'brosse de toilette',
      'shower curtain',
      'rideau de douche',
      'cable management',
      'duct tape',
      'sewing kit',
      'kit de couture',
      'pill organizer',
      'air purifier',
      'purificateur',
      'soundlink',
      'haut-parleur',
      'thermometer',
      'thermomètre',
      'chipolo',
      'key finder',
      'can opener',
      'ouvre-boîte',
      'nespresso',
      'candle',
      'bougie',
      'light bulb',
      'ampoule led',
      'ampoule',
      'blackout blind',
      'blackout curtain',
      'mop head',
      'balai',
      'kitchen scale',
      'glass meal prep',
      'food storage',
      'lunch bag',
      'lunch box',
      'cooler bag',
      'insulated bag',
      'hachoir',
      'vegetable chopper',
      'vegetable slicer',
      'peeler',
      'éplucheur',
      'laundry bag',
      'sac à linge',
      'air freshener',
      'odor eliminator',
      'incense',
      'encens',
      'wiper',
      'cleaning cloth',
      'chiffon',
      'microfibre',
      'tool kit',
      'workpro',
      'snow shovel',
      'pelle à neige',
      'mattress pump',
      'pompe intégrée',
      'bose',
      'speaker',
      'yankee candle',
      'affresh',
      'washing machine cleaner',
      'water bottle',
      'gourde',
      'food container',
      'meal prep container',
    ],
  },
  {
    categoryName: 'medical [health]',
    priority: 80,
    keywords: ['bandage liquide', 'first aid', 'nexcare', 'wound care', 'new-skin bandage'],
  },
  {
    categoryName: 'gifts [bday/christmas]',
    priority: 76,
    keywords: ['collier', 'pendentif', 'necklace', 'jewelry', 'bijou', 'bracelet cadeau', 'gift set'],
  },
  {
    categoryName: 'fun_money [personal]',
    priority: 75,
    keywords: [
      'fire tv stick',
      'alexa voice remote',
      'usb printer cable',
      'stereo cable',
      'rca cable',
      'aux adapter',
      'party game',
      "let's get deep",
      'board game',
      'handcuffs',
    ],
  },
  {
    categoryName: 'hardware [rapha_business]',
    priority: 73,
    keywords: [
      'bose quietcomfort',
      'beats powerbeats',
      'portable monitor',
      'ingnok',
      'phone tripod',
      'selfie stick tripod',
      'eucos tripod',
      'silkland hdmi',
      'siwket usb c',
      'cugunu',
      'usb c cable pack',
    ],
  },
];

const UNCATEGORIZED_NAMES = ['general [shopping]', 'uncategorized [others]', 'miscellaneous [others]'];

/**
 * Parse item titles from notes. Handles multiple formats:
 * - Standard: "1x Product Title - $29.99"
 * - Inline (no newline before): "1x Product Title - $29.99"
 * - Also extracts text from notes without the quantity/price format
 */
export function parseItemsFromNotes(notes: string): { title: string; price: number }[] {
  if (!notes) return [];

  const items: { title: string; price: number }[] = [];

  // Normalize line endings
  const normalized = notes.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pattern 1: "Nx Product Title - $price" -- match the LAST " - $" on the line to handle titles containing " - "
  const lines = normalized.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+)x\s+(.+)\s+-\s+\$(\d+(?:\.\d{2})?)$/);
    if (match) {
      items.push({
        title: match[2].trim(),
        price: parseFloat(match[3]),
      });
    }
  }

  // Pattern 2: Detect Amazon Prime by known amounts ($113.83 CAD annual)
  if (items.length === 0 && normalized.length > 0) {
    const isPrimeLikely = /amazon prime|prime membership/i.test(normalized) || /\$113\.83/.test(normalized);
    if (isPrimeLikely) {
      items.push({ title: 'Amazon Prime Membership', price: 113.83 });
      return items;
    }
  }

  // Pattern 3: If no standard items found, use the entire notes as a text blob for keyword matching
  if (items.length === 0 && normalized.length > 0) {
    // Strip known status headers and metadata
    const cleaned = notes
      .replace(/^(?:✅|⚠️|🔄|🔁|📅|💰|📄|💡|📦)\s*.+$/gm, '')
      .replace(/^Subtotal:.+$/gm, '')
      .replace(/^GST.+$/gm, '')
      .replace(/^QST.+$/gm, '')
      .replace(/^Total:.+$/gm, '')
      .replace(/^https?:\/\/.+$/gm, '')
      .replace(/^\d+\.\s+https?:\/\/.+$/gm, '')
      .replace(/^Tax Breakdown:$/gm, '')
      .replace(/^Invoice[s]?:$/gm, '')
      .replace(/^No taxes applied$/gm, '')
      .replace(/^Additional charges:.+$/gm, '')
      .replace(/^Coupon\/discount:.+$/gm, '')
      .replace(/^Items total:.+$/gm, '')
      .replace(/^Charged:.+$/gm, '')
      .replace(/^Refund amount:.+$/gm, '')
      .replace(/^Order Summary$/gm, '')
      .replace(/^Item\(s\) Subtotal:.+$/gm, '')
      .replace(/^Shipping & Handling:.+$/gm, '')
      .replace(/^Total before tax:.+$/gm, '')
      .replace(/^Estimated GST.+$/gm, '')
      .replace(/^Estimated PST.+$/gm, '')
      .replace(/^Grand Total:.+$/gm, '')
      .trim();

    if (cleaned.length > 3) {
      items.push({ title: cleaned, price: 0 });
    }
  }

  return items;
}

export function matchCategoryForItems(
  items: { title: string; price: number }[],
  userRules?: CategoryRule[],
): { categoryName: string; matchedKeyword: string; confidence: 'high' | 'medium' | 'low' } | null {
  if (items.length === 0) return null;

  const allRules = [...(userRules || []).map(r => ({ ...r, priority: (r.priority ?? 100) + 100 })), ...DEFAULT_RULES];
  allRules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const itemMatches: {
    item: { title: string; price: number };
    categoryName: string;
    matchedKeyword: string;
    priority: number;
  }[] = [];

  for (const item of items) {
    const titleLower = item.title.toLowerCase();

    for (const rule of allRules) {
      const matchedKeyword = rule.keywords.find(kw => titleLower.includes(kw.toLowerCase()));
      if (matchedKeyword) {
        itemMatches.push({
          item,
          categoryName: rule.categoryName,
          matchedKeyword,
          priority: rule.priority ?? 0,
        });
        break;
      }
    }
  }

  if (itemMatches.length === 0) return null;

  const uniqueCategories = new Set(itemMatches.map(m => m.categoryName));
  if (uniqueCategories.size === 1) {
    return {
      categoryName: itemMatches[0].categoryName,
      matchedKeyword: itemMatches[0].matchedKeyword,
      confidence: 'high',
    };
  }

  // Mixed categories: highest-priced item wins, or highest-priority if prices are 0
  const bestMatch = itemMatches.reduce((best, current) => {
    if (current.item.price > 0 && best.item.price > 0) {
      return current.item.price > best.item.price ? current : best;
    }
    return current.priority > best.priority ? current : best;
  });

  return {
    categoryName: bestMatch.categoryName,
    matchedKeyword: bestMatch.matchedKeyword,
    confidence: items.length > 1 ? 'medium' : 'low',
  };
}

/**
 * Extract order info from split invoice notes.
 * Returns the order number and date if found.
 */
export function parseSplitInvoiceOrderInfo(
  notes: string,
): { orderNumber: string; orderDate: string; orderTotal: number; itemCount: number } | null {
  if (!notes) return null;

  const orderMatch = notes.match(/Order\s*#?:?\s*(701-\d{7}-\d{7})/);
  const dateMatch = notes.match(/Order Date:\s*(.+)/);
  const totalMatch = notes.match(/Order Total:\s*\$(\d+(?:\.\d{2})?)\s*\((\d+)\s*items?\)/);

  if (!orderMatch) return null;

  return {
    orderNumber: orderMatch[1],
    orderDate: dateMatch?.[1] || '',
    orderTotal: totalMatch ? parseFloat(totalMatch[1]) : 0,
    itemCount: totalMatch ? parseInt(totalMatch[2]) : 0,
  };
}

/**
 * For a split invoice transaction, search all other transactions for one that
 * was matched to the same order (by finding items from the same order date/total).
 * Returns items found in the sibling transaction's notes.
 */
export function findSiblingItems(
  splitNotes: string,
  allTransactions: { notes: string; date: string; amount: number }[],
): { title: string; price: number }[] {
  const orderInfo = parseSplitInvoiceOrderInfo(splitNotes);
  if (!orderInfo) return [];

  for (const txn of allTransactions) {
    if (!txn.notes || txn.notes === splitNotes) continue;

    // Check if this transaction's notes reference the same order number
    if (txn.notes.includes(orderInfo.orderNumber)) {
      const items = parseItemsFromNotes(txn.notes);
      if (items.length > 0) return items;
    }
  }

  // Fallback: look for transactions with the same order date that have items
  if (orderInfo.orderDate) {
    for (const txn of allTransactions) {
      if (!txn.notes || txn.notes === splitNotes) continue;
      if (txn.notes.includes(orderInfo.orderDate)) {
        const items = parseItemsFromNotes(txn.notes);
        if (items.length > 0) return items;
      }
    }
  }

  return [];
}

export function isUncategorized(categoryName: string | null | undefined): boolean {
  if (!categoryName) return true;
  return UNCATEGORIZED_NAMES.some(name => categoryName.toLowerCase() === name.toLowerCase());
}

export function resolveCategoryId(categoryName: string, monarchCategories: MonarchCategory[]): string | null {
  const match = monarchCategories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
  return match?.id ?? null;
}

export function getCategoryDisplayName(category: MonarchCategory): string {
  return `${category.name} [${category.group.name}]`;
}

export function buildCategoryLookup(categories: MonarchCategory[]): Map<string, MonarchCategory> {
  const lookup = new Map<string, MonarchCategory>();
  for (const cat of categories) {
    const displayName = getCategoryDisplayName(cat).toLowerCase();
    lookup.set(displayName, cat);
    lookup.set(cat.name.toLowerCase(), cat);
  }
  return lookup;
}

export function resolveRuleCategoryId(
  ruleCategoryName: string,
  categoryLookup: Map<string, MonarchCategory>,
): string | null {
  const lower = ruleCategoryName.toLowerCase();
  const match = categoryLookup.get(lower);
  return match?.id ?? null;
}
