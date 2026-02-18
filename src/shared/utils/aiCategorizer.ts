import type { MonarchCategory } from '../api/monarchApi';
import { getCategoryDisplayName } from './categoryMatcher';

export type AICategorizeResult = {
  transactionId: string;
  suggestedCategory: string;
  suggestedCategoryId: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
};

type TransactionInput = {
  transactionId: string;
  itemDescription: string;
  amount: number;
  date: string;
};

const BATCH_SIZE = 15;

export async function aiCategorizeTransactions(
  apiKey: string,
  transactions: TransactionInput[],
  categories: MonarchCategory[],
  onProgress?: (done: number, total: number) => void,
): Promise<AICategorizeResult[]> {
  const categoryList = categories
    .map(c => getCategoryDisplayName(c))
    .sort()
    .join('\n');

  const results: AICategorizeResult[] = [];

  const batches: TransactionInput[][] = [];
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE));
  }

  let done = 0;

  for (const batch of batches) {
    const batchResults = await categorizeBatch(apiKey, batch, categoryList);

    for (const result of batchResults) {
      const category = categories.find(
        c =>
          getCategoryDisplayName(c).toLowerCase() === result.suggestedCategory.toLowerCase() ||
          c.name.toLowerCase() === result.suggestedCategory.toLowerCase(),
      );

      if (category) {
        results.push({
          transactionId: result.transactionId,
          suggestedCategory: getCategoryDisplayName(category),
          suggestedCategoryId: category.id,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      }
    }

    done += batch.length;
    onProgress?.(done, transactions.length);
  }

  return results;
}

type BatchResult = {
  transactionId: string;
  suggestedCategory: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
};

async function categorizeBatch(
  apiKey: string,
  batch: TransactionInput[],
  categoryList: string,
): Promise<BatchResult[]> {
  const transactionLines = batch
    .map(t => `- ID: ${t.transactionId} | "${t.itemDescription}" | $${Math.abs(t.amount).toFixed(2)} | ${t.date}`)
    .join('\n');

  const systemPrompt = `You are a transaction categorizer for a personal finance app. Given Amazon purchase descriptions, assign each to the most appropriate category from the user's category list.

CATEGORIES:
${categoryList}

RULES:
- Pick the SINGLE best category for each transaction
- Use the exact category name from the list (format: "name [group]")
- If unsure, pick the closest match rather than a generic category
- Supplements, vitamins, protein = "suppléments [health]"
- Books about business/sales/marketing = "formation [rapha_business]"
- Books about personal growth/self-help/science = "education [personal]"
- Electronics, cables, chargers, monitors = "electronics [shopping]"
- Gym gear, sports equipment = "gear [fitness]"
- Deodorant, soap, skincare = "beauty [personal]"
- Car parts, car accessories = "maintenance [auto]"
- Kitchen appliances, home items = "furniture [housing]"
- Confidence: "high" if very clear match, "medium" if reasonable guess, "low" if uncertain

Respond with ONLY a JSON object: { "results": [{ "id": "transaction_id", "category": "exact category name [group]", "confidence": "high|medium|low", "reason": "brief reason" }] }`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Categorize these Amazon transactions:\n\n${transactionLines}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error('Empty response from Claude');
  }

  try {
    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = parsed.results || parsed;

    return (Array.isArray(items) ? items : []).map(
      (item: { id: string; category: string; confidence: string; reason: string }) => ({
        transactionId: item.id,
        suggestedCategory: item.category,
        confidence: (['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium') as
          | 'high'
          | 'medium'
          | 'low',
        reasoning: item.reason || '',
      }),
    );
  } catch (parseErr) {
    console.error('Failed to parse Claude response:', content);
    throw new Error('Failed to parse AI categorization response');
  }
}
