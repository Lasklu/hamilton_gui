/**
 * Job-related type definitions
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export type JobType = 'clustering' | 'concepts' | 'attributes' | 'relationships'

export interface JobProgress {
  current: number
  total: number
  percentage: number
  message?: string
}

export interface Job {
  id: string
  type: JobType
  status: JobStatus
  databaseId: string
  progress?: JobProgress
  result?: any
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface JobStatusResponse {
  id: string
  type: JobType
  status: JobStatus
  progress?: JobProgress
  result?: any
  error?: string
}

export interface JobCreateResponse {
  jobId: string
  status: string
  message: string
}
