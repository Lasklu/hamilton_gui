import { axiosInstance } from '../client'
import type { ClusteringSuggestions, ClusterRequest, ClusteringResult, JobCreateResponse } from '@/lib/types'

export interface ClusteringSummary {
  id: number
  name: string
  clusterCount: number
  appliedFinetuning: boolean
  isActive: boolean
  createdAt: string
}

export const clusteringApi = {
  /**
   * Start clustering job for a database (async)
   */
  async cluster(
    databaseId: string,
    options: ClusterRequest = {}
  ): Promise<JobCreateResponse> {
    const response = await axiosInstance.post<JobCreateResponse>(
      `/databases/${databaseId}/cluster`,
      options
    )
    return response.data
  },

  /**
   * Save updated clustering for a database with a name
   */
  async saveClustering(
    databaseId: string,
    clustering: ClusteringResult,
    name: string
  ): Promise<{ success: boolean; message: string; clusteringId: number }> {
    const response = await axiosInstance.put(
      `/databases/${databaseId}/cluster`,
      {
        name,
        clustering
      }
    )
    return response.data
  },

  /**
   * List all saved clusterings for a database
   */
  async listSavedClusterings(
    databaseId: string
  ): Promise<ClusteringSummary[]> {
    const response = await axiosInstance.get<ClusteringSummary[]>(
      `/databases/${databaseId}/cluster/saved`
    )
    return response.data
  },

  /**
   * Load a specific saved clustering
   */
  async getSavedClustering(
    databaseId: string,
    clusteringId: number
  ): Promise<ClusteringResult> {
    const response = await axiosInstance.get<ClusteringResult>(
      `/databases/${databaseId}/cluster/saved/${clusteringId}`
    )
    return response.data
  },

  /**
   * Get the active clustering for a database
   */
  async getActiveClustering(
    databaseId: string
  ): Promise<ClusteringResult | null> {
    const response = await axiosInstance.get<ClusteringResult | null>(
      `/databases/${databaseId}/cluster/active`
    )
    return response.data
  },

  /**
   * Activate a saved clustering
   */
  async activateClustering(
    databaseId: string,
    clusteringId: number
  ): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.put(
      `/databases/${databaseId}/cluster/saved/${clusteringId}/activate`
    )
    return response.data
  },
}
