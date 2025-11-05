import { axiosInstance } from '../client'
import type { ClusteringSuggestions, ClusterRequest, ClusteringResult } from '@/lib/types'

export const clusteringApi = {
  /**
   * Generate clustering suggestions for a database
   */
  async cluster(
    databaseId: string,
    options: ClusterRequest = {}
  ): Promise<ClusteringSuggestions> {
    const response = await axiosInstance.post<ClusteringSuggestions>(
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
