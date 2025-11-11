'use client'

import { Loader2 } from 'lucide-react'

interface JobProgressBarProps {
  progress: number
  message?: string
  title?: string
  description?: string
}

/**
 * Reusable progress bar component for displaying job progress
 */
export function JobProgressBar({
  progress,
  message,
  title = 'Processing...',
  description
}: JobProgressBarProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="text-center max-w-md w-full px-8">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {message}
          </p>
        )}
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {progress}%
        </p>
      </div>
    </div>
  )
}
