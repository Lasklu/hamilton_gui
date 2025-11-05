/**
 * Concepts API service
 */
import { axiosInstance } from '../client'
import type { ConceptSuggestion, JobCreateResponse } from '@/lib/types'

export const conceptsApi = {
  /**
   * Generate concept suggestions for a cluster
   */
  async generateConcepts(
    databaseId: string,
    clusterId: number
  ): Promise<JobCreateResponse> {
    const response = await axiosInstance.post<JobCreateResponse>(
      `/databases/${databaseId}/clusters/${clusterId}/concepts`
    )
    return response.data
  },

  /**
   * Save confirmed concepts for a cluster
   */
  async saveConcepts(
    databaseId: string,
    clusterId: number,
    concepts: ConceptSuggestion
  ): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      `/databases/${databaseId}/clusters/${clusterId}/concepts/save`,
      concepts
    )
    return response.data
  },

  /**
   * Get all confirmed concepts for a database
   */
  async getAllConcepts(databaseId: string): Promise<ConceptSuggestion> {
    const response = await axiosInstance.get<ConceptSuggestion>(
      `/databases/${databaseId}/concepts`
    )
    return response.data
  },
}
