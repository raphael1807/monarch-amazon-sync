import { StorageType, createStorage } from '@src/shared/storages/base';

export enum Page {
  Default = 'default',
  Options = 'options',
  ManualBackfill = 'manualBackfill',
  History = 'history',
}

export enum AuthStatus {
  Pending = 'pending',
  NotLoggedIn = 'notLoggedIn',
  Success = 'success',
  Failure = 'failure',
}

export enum FailureReason {
  Unknown = 'unknown',
  NoAmazonOrders = 'noAmazonOrders',
  NoAmazonAuth = 'noAmazonAuth',
  AmazonError = 'amazonError',
  NoMonarchAuth = 'noMonarchAuth',
  MonarchError = 'monarchError',
  NoMonarchTransactions = 'noMonarchTransactions',
}

export const mapFailureReasonToMessage = (reason: FailureReason | undefined): string => {
  switch (reason) {
    case FailureReason.NoAmazonOrders:
      return 'No Amazon orders found';
    case FailureReason.NoAmazonAuth:
      return 'Amazon authorization failed';
    case FailureReason.AmazonError:
      return 'An error occurred while fetching Amazon orders';
    case FailureReason.NoMonarchAuth:
      return 'Monarch authorization failed';
    case FailureReason.MonarchError:
      return 'An error occurred while fetching Monarch transactions';
    case FailureReason.NoMonarchTransactions:
      return 'No Monarch transactions found';
    default:
      return 'Unknown';
  }
};

export type LastSync = {
  time: number;
  success: boolean;
  amazonOrders: number;
  monarchTransactions: number;
  transactionsUpdated: number;
  failureReason?: FailureReason | undefined;
  dryRun?: boolean;
};

export type DateRangeOption = '7days' | '30days' | '3months' | 'thisYear' | 'lastYear' | 'custom';

type Options = {
  overrideTransactions: boolean;
  amazonMerchant: string;
  syncEnabled: boolean;
  matchTolerance?: number; // Amount tolerance in dollars (default: 1)
  dateTolerance?: number; // Date tolerance in days (default: 7)
  notifications?: boolean; // Show browser notifications (default: true)
  dateRangeType?: DateRangeOption; // Last used date range selection
  customStartDate?: string; // ISO format
  customEndDate?: string; // ISO format
};

type State = {
  page: Page;
  oldestAmazonYear: number | undefined;
  amazonStatus: AuthStatus;
  lastAmazonAuth: number;
  monarchKey?: string;
  monarchStatus: AuthStatus;
  lastMonarchAuth: number;
  lastSync: LastSync | undefined;
  options: Options;
  onboardingComplete?: boolean;
};

const appStorage = createStorage<State>(
  'page',
  {
    page: Page.Default,
    oldestAmazonYear: undefined,
    amazonStatus: AuthStatus.NotLoggedIn,
    lastAmazonAuth: 0,
    monarchKey: undefined,
    monarchStatus: AuthStatus.NotLoggedIn,
    lastMonarchAuth: 0,
    lastSync: undefined,
    options: {
      overrideTransactions: false,
      amazonMerchant: 'Amazon',
      syncEnabled: false,
      matchTolerance: 1,
      dateTolerance: 7,
      notifications: true,
      dateRangeType: '3months', // Default to 3 months
    },
  },
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  },
);

export default appStorage;
