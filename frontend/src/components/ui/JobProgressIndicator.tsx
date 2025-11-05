import React, { useState, useEffect } from 'react'
import { Loading } from './Loading'
import type { JobProgress } from '@/lib/types'

interface JobProgressIndicatorProps {
  progress: JobProgress | null
  className?: string
}

export function JobProgressIndicator({ progress, className = '' }: JobProgressIndicatorProps) {
  // Keep track of last known progress to prevent jumping to 0
  const [lastProgress, setLastProgress] = useState<JobProgress | null>(null)

  // Update last progress only when we have new progress data
  useEffect(() => {
    if (progress !== null) {
      setLastProgress(progress)
    }
  }, [progress])

  // Use last known progress or initial defaults
  const displayProgress = lastProgress || {
    current: 0,
    total: 100,
    percentage: 0,
    message: 'Initializing...'
  }

  const current = displayProgress.current
  const total = displayProgress.total
  const percentage = displayProgress.percentage
  const message = displayProgress.message

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress message */}
      <div className="flex items-center justify-center">
        <Loading size="sm" />
        <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
          {message}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progress
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {current} / {total}
          </span>
        </div>
      </div>
    </div>
  )
}
