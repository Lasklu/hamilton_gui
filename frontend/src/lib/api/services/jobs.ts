import { axiosInstance } from '../client'
import type { JobStatusResponse } from '@/lib/types'

export const jobsApi = {
  /**
   * Get job status
   */
  async getStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await axiosInstance.get<JobStatusResponse>(`/jobs/${jobId}`)
    return response.data
  },
}
