import { AuthStatus } from '@root/src/shared/storages/appStorage';
import { Button } from 'flowbite-react';
import { FaCheckCircle, FaExclamationCircle, FaTimesCircle, FaRedo } from 'react-icons/fa';

interface ConnectionProps {
  name: string;
  status: AuthStatus;
  lastUpdated?: number;
  message?: string;
  onFix?: () => void;
}

export function SmartConnectionInfo({ name, status, lastUpdated, message, onFix }: ConnectionProps) {
  const isAmazon = name.includes('Amazon');
  const isMonarch = name.includes('Monarch');

  const getStatusDisplay = () => {
    switch (status) {
      case AuthStatus.Success:
        return {
          icon: <FaCheckCircle className="text-green-500" size={20} />,
          text: 'Connected',
          color: 'text-green-700',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case AuthStatus.NotLoggedIn:
        return {
          icon: <FaExclamationCircle className="text-yellow-500" size={20} />,
          text: 'Not logged in',
          color: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        };
      default:
        return {
          icon: <FaTimesCircle className="text-red-500" size={20} />,
          text: 'Connection failed',
          color: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
    }
  };

  const display = getStatusDisplay();

  const handleQuickFix = () => {
    if (isAmazon) {
      chrome.tabs.create({ url: 'https://www.amazon.ca/gp/css/order-history' });
    } else if (isMonarch) {
      chrome.tabs.create({ url: 'https://app.monarch.com/transactions' });
    }
    if (onFix) onFix();
  };

  return (
    <div className={`p-3 rounded-lg border-2 ${display.bgColor} ${display.borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {display.icon}
          <span className="font-semibold text-sm">{name}</span>
        </div>
        <span className={`text-xs font-medium ${display.color}`}>{display.text}</span>
      </div>

      {lastUpdated && status === AuthStatus.Success && (
        <div className="text-xs text-gray-500">Last updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
      )}

      {message && <div className={`text-xs ${display.color} mt-2`}>{message}</div>}

      {status !== AuthStatus.Success && (
        <div className="mt-2 space-y-2">
          <Button size="xs" color={isAmazon ? 'warning' : 'purple'} className="w-full" onClick={handleQuickFix}>
            <FaRedo className="mr-2" />
            {isAmazon ? 'Open Amazon.ca' : 'Open Monarch'}
          </Button>
          <p className="text-xs text-gray-600 text-center">
            {isAmazon ? 'Log in and return here' : 'Log in, wait 10s, then refresh this popup'}
          </p>
        </div>
      )}
    </div>
  );
}

export default SmartConnectionInfo;
