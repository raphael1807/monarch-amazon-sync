export type MonarchTransaction = {
  id: string;
  amount: number;
  date: string;
  notes: string;
};

export async function updateMonarchTransaction(authKey: string, id: string, note: string) {
  const body = {
    operationName: 'Web_TransactionDrawerUpdateTransaction',
    variables: {
      input: {
        id: id,
        notes: note,
      },
    },
    query: `
      mutation Web_TransactionDrawerUpdateTransaction($input: UpdateTransactionMutationInput!) {
        updateTransaction(input: $input) {
          transaction {
            id
            amount
            pending
            date
          }
          errors {
            fieldErrors {
              field
              messages
            }
            message
            code
          }
        }
      }
    `,
  };

  const result = await graphQLRequest(authKey, body);

  // Check for errors in response
  if (result?.data?.updateTransaction?.errors?.length > 0) {
    const errorMsg = result.data.updateTransaction.errors.map((e: { message?: string }) => e.message).join(', ');
    throw new Error(`Failed to update transaction: ${errorMsg}`);
  }

  return result;
}

export async function getTransactions(
  authKey: string,
  merchant: string,
  startDate?: Date,
  endDate?: Date,
): Promise<MonarchTransaction[]> {
  const body = {
    operationName: 'Web_GetTransactionsList',
    variables: {
      orderBy: 'date',
      limit: 1000,
      filters: {
        search: merchant,
        categories: [],
        accounts: [],
        startDate: startDate?.toISOString().split('T')[0] ?? undefined,
        endDate: endDate?.toISOString().split('T')[0] ?? undefined,
        tags: [],
      },
    },
    query: `
      query Web_GetTransactionsList($offset: Int, $limit: Int, $filters: TransactionFilterInput, $orderBy: TransactionOrdering) {
        allTransactions(filters: $filters) {
          totalCount
          results(offset: $offset, limit: $limit, orderBy: $orderBy) {
            id
            amount
            pending
            date
            notes
          }
        }
      }
    `,
  };

  const result = await graphQLRequest(authKey, body);

  // Validate response structure
  if (!result?.data?.allTransactions?.results) {
    console.error('Unexpected Monarch response:', result);
    if (result?.errors) {
      throw new Error(`Monarch API error: ${JSON.stringify(result.errors)}`);
    }
    throw new Error('Invalid response from Monarch API');
  }

  return result.data.allTransactions.results;
}

// Retry delays in ms: 1s, 2s, 4s
const RETRY_DELAYS = [1000, 2000, 4000];
const RETRYABLE_STATUS_CODES = [500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function graphQLRequest(authKey: string, body: unknown, retryCount = 0): Promise<any> {
  console.log(`🔄 Monarch API request (attempt ${retryCount + 1})...`);

  let result: Response;
  try {
    // Use minimal headers - Chrome extensions don't need to fake browser headers
    result = await fetch('https://api.monarch.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Token ' + authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    console.log(`✅ Monarch response: ${result.status} ${result.statusText}`);
  } catch (fetchError) {
    console.error('❌ Monarch fetch failed (network error):', fetchError);
    throw new Error(`Network error connecting to Monarch: ${fetchError}`);
  }

  // Check if response is OK
  if (!result.ok) {
    // Retry on server errors (5xx) and Cloudflare errors (52x)
    if (RETRYABLE_STATUS_CODES.includes(result.status) && retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[retryCount];
      console.log(
        `⏳ Monarch server error (${result.status}), retrying in ${delay / 1000}s... (attempt ${retryCount + 2}/${
          RETRY_DELAYS.length + 1
        })`,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return graphQLRequest(authKey, body, retryCount + 1);
    }

    // Provide helpful error messages for common status codes
    const errorMessages: Record<number, string> = {
      401: 'Authentication failed. Please re-authenticate with Monarch.',
      403: 'Access denied. Your Monarch session may have expired.',
      429: 'Rate limited. Please wait a moment and try again.',
      500: 'Monarch server error. Please try again later.',
      502: 'Monarch is temporarily unavailable. Please try again.',
      503: 'Monarch is under maintenance. Please try again later.',
      525: 'Monarch SSL error (Cloudflare). Please try again in a few minutes.',
    };

    const message = errorMessages[result.status] || `Monarch API error: ${result.status} ${result.statusText}`;
    throw new Error(message);
  }

  // Check content type before parsing as JSON
  const contentType = result.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await result.text();
    // Check if it's an HTML response (likely auth error)
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
      throw new Error('Monarch authentication expired. Please re-authenticate.');
    }
    throw new Error(`Unexpected response type: ${contentType}`);
  }

  return await result.json();
}
