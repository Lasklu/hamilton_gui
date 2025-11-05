/**
 * Custom hook for polling job status
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { JobStatus, JobProgress } from '@/lib/types'

interface UseJobPollingOptions {
  jobId: string | null
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  pollingInterval?: number
  enabled?: boolean
}

interface UseJobPollingResult {
  status: JobStatus | null
  progress: JobProgress | null
  result: any | null
  error: string | null
  isPolling: boolean
}

export function useJobPolling(
  fetchJobStatus: (jobId: string) => Promise<any>,
  options: UseJobPollingOptions
): UseJobPollingResult {
  const {
    jobId,
    onComplete,
    onError,
    pollingInterval = 1000,
    enabled = true,
  } = options

  const [status, setStatus] = useState<JobStatus | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [hasNotified, setHasNotified] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  const poll = useCallback(async () => {
    if (!jobId || !enabled) return

    try {
      const jobStatus = await fetchJobStatus(jobId)

      setStatus(jobStatus.status)
      // Only update progress if we have new progress data
      if (jobStatus.progress) {
        setProgress(jobStatus.progress)
      }

      if (jobStatus.status === 'completed') {
        setResult(jobStatus.result)
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        // Only call onComplete once
        setHasNotified(prevHasNotified => {
          if (!prevHasNotified) {
            onCompleteRef.current?.(jobStatus.result)
            return true
          }
          return prevHasNotified
        })
      } else if (jobStatus.status === 'failed') {
        setError(jobStatus.error || 'Job failed')
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        // Only call onError once
        setHasNotified(prevHasNotified => {
          if (!prevHasNotified) {
            onErrorRef.current?.(jobStatus.error || 'Job failed')
            return true
          }
          return prevHasNotified
        })
      }
    } catch (err: any) {
      console.error('Error polling job status:', err)
      setError(err.message || 'Failed to fetch job status')
      setIsPolling(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Only call onError once
      setHasNotified(prevHasNotified => {
        if (!prevHasNotified) {
          onErrorRef.current?.(err.message || 'Failed to fetch job status')
          return true
        }
        return prevHasNotified
      })
    }
  }, [jobId, enabled, fetchJobStatus])

  useEffect(() => {
    if (!jobId || !enabled) {
      setIsPolling(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Start polling
    setIsPolling(true)
    setStatus(null)
    setProgress(null)
    setResult(null)
    setError(null)
    setHasNotified(false) // Reset notification flag for new job

    // Poll immediately
    poll()

    // Then poll at interval
    intervalRef.current = setInterval(poll, pollingInterval)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId, enabled, poll, pollingInterval])

  return {
    status,
    progress,
    result,
    error,
    isPolling,
  }
}
