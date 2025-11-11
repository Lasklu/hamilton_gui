'use client'

import { useState, useEffect, useRef } from 'react'
import { useJobPolling } from '@/hooks/useJobPolling'
import { JobProgressBar } from './JobProgressBar'

interface JobPollingContainerProps<TResult> {
  /** API client to use for polling */
  client: {
    jobs: {
      getStatus: (id: string) => Promise<any>
    }
  }
  /** Current job ID to poll */
  jobId: string | null
  /** Whether polling is enabled */
  enabled: boolean
  /** Title to display in progress bar */
  title: string
  /** Description to display in progress bar */
  description?: string
  /** Callback when job completes successfully */
  onComplete: (result: TResult) => void
  /** Callback when job fails */
  onError: (error: string) => void
  /** Content to render when not processing */
  children: React.ReactNode
}

type ProcessingState = 'idle' | 'generating' | 'complete'

/**
 * Container component that manages job polling, progress display, and state transitions.
 * Handles the common pattern of:
 * 1. Starting a background job
 * 2. Polling for progress
 * 3. Displaying progress bar
 * 4. Handling completion/errors
 * 5. Rendering content when complete
 */
export function JobPollingContainer<TResult>({
  client,
  jobId,
  enabled,
  title,
  description,
  onComplete,
  onError,
  children
}: JobPollingContainerProps<TResult>) {
  const [displayProgress, setDisplayProgress] = useState(0)
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
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
  useEffect(() => {
    if (progress && progress.total > 0 && processingState === 'generating' && jobId && jobId === currentJobIdRef.current) {
      const actualProgress = Math.round((progress.current / progress.total) * 100)
      setDisplayProgress(actualProgress)
    }
  }, [progress, processingState, jobId])

  // Reset display progress whenever a new job is started
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

  // If generating, show progress bar
  if (processingState === 'generating') {
    return (
      <JobProgressBar
        progress={displayProgress}
        message={progress?.message}
        title={title}
        description={description}
      />
    )
  }

  // Otherwise render children
  return <>{children}</>
}
