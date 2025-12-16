import { useState } from 'react';
import { Button, Progress } from 'flowbite-react';
import { FaCheck, FaArrowRight } from 'react-icons/fa';
import { AuthStatus } from '@root/src/shared/storages/appStorage';

interface OnboardingProps {
  amazonStatus: AuthStatus;
  monarchStatus: AuthStatus;
  onComplete: () => void;
}

export function Onboarding({ amazonStatus, monarchStatus, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    {
      number: 1,
      title: 'Connect Amazon.ca',
      description: 'Log in to your Amazon.ca account',
      status: amazonStatus,
      action: () => chrome.tabs.create({ url: 'https://www.amazon.ca/gp/css/order-history' }),
      actionText: 'Open Amazon.ca',
    },
    {
      number: 2,
      title: 'Connect Monarch',
      description: 'Log in to Monarch Money',
      status: monarchStatus,
      action: () => chrome.tabs.create({ url: 'https://app.monarch.com/transactions' }),
      actionText: 'Open Monarch',
    },
    {
      number: 3,
      title: 'Run First Test',
      description: 'Run a safe dry-run to test the extension',
      status:
        amazonStatus === AuthStatus.Success && monarchStatus === AuthStatus.Success
          ? AuthStatus.Success
          : AuthStatus.Pending,
      action: onComplete,
      actionText: 'Start Testing',
    },
  ];

  const currentStepData = steps[currentStep - 1];
  const completedSteps = steps.filter(s => s.status === AuthStatus.Success).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="flex flex-col gap-4 p-4 min-h-[400px]">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Welcome! 👋</h1>
        <p className="text-sm text-gray-600 mt-1">Let&apos;s set up your Amazon-Monarch sync</p>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>
            Step {currentStep} of {steps.length}
          </span>
          <span>{completedSteps} completed</span>
        </div>
        <Progress progress={progress} color="purple" size="lg" />
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between mb-4">
        {steps.map(step => (
          <div key={step.number} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                step.status === AuthStatus.Success
                  ? 'bg-green-500 text-white'
                  : step.number === currentStep
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>
              {step.status === AuthStatus.Success ? <FaCheck /> : step.number}
            </div>
            <span className={`text-xs text-center ${step.number === currentStep ? 'font-semibold' : ''}`}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="flex-1 flex flex-col justify-center gap-4 bg-gray-50 p-6 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-3">{currentStep === 1 ? '🛒' : currentStep === 2 ? '💰' : '🧪'}</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{currentStepData.title}</h2>
          <p className="text-sm text-gray-600">{currentStepData.description}</p>
        </div>

        {currentStepData.status === AuthStatus.Success ? (
          <div className="flex flex-col items-center gap-2">
            <FaCheck className="text-green-500 text-3xl" />
            <span className="text-green-700 font-semibold">Connected!</span>
          </div>
        ) : (
          <Button size="lg" color="purple" onClick={currentStepData.action} className="w-full font-bold">
            {currentStepData.actionText}
            <FaArrowRight className="ml-2" />
          </Button>
        )}

        {currentStep < 3 && currentStepData.status === AuthStatus.Success && (
          <Button size="md" color="light" onClick={() => setCurrentStep(currentStep + 1)} className="w-full">
            Next Step
            <FaArrowRight className="ml-2" />
          </Button>
        )}
      </div>

      {/* Skip Button */}
      {completedSteps >= 2 && (
        <Button size="sm" color="light" onClick={onComplete} className="w-full">
          Skip to Dashboard
        </Button>
      )}
    </div>
  );
}

export default Onboarding;
