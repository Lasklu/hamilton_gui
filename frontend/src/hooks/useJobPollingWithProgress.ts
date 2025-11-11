import { useState, useEffect, useRef } from 'react'
import { useJobPolling } from './useJobPolling'

interface UseJobPollingWithProgressOptions<TResult> {
  /** API client jobs service */
  client: {
    jobs: {
      getStatus: (id: string) => Promise<any>
    }
  }
  /** Current job ID to poll */
  jobId: string | null
  /** Whether polling is enabled */
  enabled: boolean
  /** Callback when job completes */
  onComplete: (result: TResult) => void
  /** Callback when job fails */
  onError: (error: string) => void
}

interface JobPollingWithProgressState {
  /** Current display progress (0-100) */
  displayProgress: number
  /** Current processing state */
  processingState: 'idle' | 'generating' | 'complete'
  /** Current progress message */
  progressMessage?: string
}

/**
 * Hook that combines job polling with progress tracking and state management.
 * Provides a unified interface for handling background jobs with progress display.
 * 
 * Based on the pattern from ConceptsStep, this hook:
 * - Polls for job status
 * - Tracks display progress (prevents flickering)
 * - Manages processing state transitions
 * - Handles job completion and errors
 * 
 * @example
 * ```tsx
 * const { displayProgress, processingState, progressMessage } = useJobPollingWithProgress({
 *   client,
 *   jobId,
 *   enabled: !!jobId,
 *   onComplete: (result) => {
 *     console.log('Job completed:', result)
 *   },
 *   onError: (error) => {
 *     console.error('Job failed:', error)
 *   }
 * })
 * ```
 */
export function useJobPollingWithProgress<TResult>({
  client,
  jobId,
  enabled,
  onComplete,
  onError
}: UseJobPollingWithProgressOptions<TResult>): JobPollingWithProgressState {
  const [displayProgress, setDisplayProgress] = useState(0)
  const [processingState, setProcessingState] = useState<'idle' | 'generating' | 'complete'>('idle')
  const currentJobIdRef = useRef<string | null>(null)

  // Poll job status
  const { progress, result, error: jobError } = useJobPolling(
    (id) => client.jobs.getStatus(id),
    {
      jobId,
      enabled: enabled && processingState === 'generating',
      onComplete: (result: TResult) => {
        setDisplayProgress(100)
        setProcessingState('complete')
        currentJobIdRef.current = null
        onComplete(result)
      },
      onError: (error) => {
        setProcessingState('idle')
        currentJobIdRef.current = null
        onError(error)
      },
    }
  )

  // Update display progress only when it increases (prevent flickering)
  // Only update if it's for the current active job
  useEffect(() => {
    if (
      progress &&
      progress.total > 0 &&
      processingState === 'generating' &&
      jobId &&
      jobId === currentJobIdRef.current
    ) {
      const actualProgress = Math.round((progress.current / progress.total) * 100)
      // Set to the actual progress reported by the job (allow decreases when new job starts)
      setDisplayProgress(actualProgress)
    }
  }, [progress, processingState, jobId])

  // Reset display progress and set state whenever a new job is started
  useEffect(() => {
    if (jobId && jobId !== currentJobIdRef.current) {
      setDisplayProgress(0)
      setProcessingState('generating')
      currentJobIdRef.current = jobId
    }
  }, [jobId])

  // Reset display progress when idle
  useEffect(() => {
    if (processingState === 'idle') {
      setDisplayProgress(0)
    }
  }, [processingState])

  return {
    displayProgress,
    processingState,
    progressMessage: progress?.message
  }
}
