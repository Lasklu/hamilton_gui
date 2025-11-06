import { cn } from '@/lib/utils/cn'

interface Step {
  id: string
  label: string
}

interface ProgressBarProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
}

export function ProgressBar({ steps, currentStep, onStepClick }: ProgressBarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep
            const isCurrent = index === currentStep
            const isUpcoming = index > currentStep
            const isClickable = onStepClick && index <= currentStep

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => isClickable && onStepClick(index)}
                    disabled={!isClickable}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all',
                      isCompleted &&
                        'bg-primary-600 text-white',
                      isCurrent &&
                        'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900',
                      isUpcoming &&
                        'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                      isClickable && 'cursor-pointer hover:ring-4 hover:ring-primary-200 dark:hover:ring-primary-800',
                      !isClickable && 'cursor-default'
                    )}
                  >
                    {isCompleted ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </button>
                  <span
                    className={cn(
                      'mt-2 text-xs font-medium text-center whitespace-nowrap',
                      isCurrent && 'text-primary-600 dark:text-primary-400',
                      isCompleted && 'text-gray-700 dark:text-gray-300',
                      isUpcoming && 'text-gray-500 dark:text-gray-400',
                      isClickable && 'cursor-pointer hover:text-primary-700 dark:hover:text-primary-300'
                    )}
                    onClick={() => isClickable && onStepClick(index)}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 transition-all',
                      index < currentStep
                        ? 'bg-primary-600'
                        : 'bg-gray-200 dark:bg-gray-800'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
