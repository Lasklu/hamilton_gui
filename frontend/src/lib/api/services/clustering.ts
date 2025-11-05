import { axiosInstance } from '../client'
import type { ClusteringSuggestions, ClusterRequest, ClusteringResult, JobCreateResponse } from '@/lib/types'

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
   * Save updated clustering for a database
   */
  async saveClustering(
    databaseId: string,
    clustering: ClusteringResult
  ): Promise<{ success: boolean; message: string; clustering: ClusteringResult }> {
    const response = await axiosInstance.put(
      `/databases/${databaseId}/cluster`,
      clustering
    )
    return response.data
  },
}
