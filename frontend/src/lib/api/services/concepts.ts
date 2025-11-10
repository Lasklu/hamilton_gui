/**
 * Concepts API service
 */
import { axiosInstance } from '../client'
import type { ConceptSuggestion, JobCreateResponse, Concept, ClusterInfo } from '@/lib/types'

export const conceptsApi = {
  /**
   * Generate concepts for a single cluster (async job)
   * This is a convenience method that calls the single cluster endpoint
   */
  async generateConcepts(
    databaseId: string,
    clusterId: number,
    clusterInfo?: ClusterInfo  // Optional: provide cluster info to avoid extra API call
  ): Promise<JobCreateResponse> {
    let cluster: ClusterInfo | undefined = clusterInfo;
    
    // Only fetch clustering result if cluster info not provided
    if (!cluster) {
      const clusteringResponse = await axiosInstance.get(`/databases/${databaseId}/cluster/active`)
      const clusteringResult = clusteringResponse.data
      
      cluster = clusteringResult.clusters.find((c: ClusterInfo) => c.clusterId === clusterId)
      if (!cluster) {
        throw new Error(`Cluster ${clusterId} not found`)
      }
    }
    
    // Call the batch generation endpoint with just this cluster
    const response = await axiosInstance.post<JobCreateResponse>(
      `/databases/${databaseId}/concepts/generate`,
      [cluster]  // Send as array with single cluster (body expects List[ClusterInfo])
    )
    return response.data
  },

  /**
   * Generate concepts for all clusters (async, incremental results)
   */
  async generateConceptsForAllClusters(
    databaseId: string,
    clusters: ClusterInfo[]
  ): Promise<JobCreateResponse> {
    const response = await axiosInstance.post<JobCreateResponse>(
      `/databases/${databaseId}/concepts/generate`,
      clusters
    )
    return response.data
  },

  /**
   * Generate concepts for a single cluster (synchronous)
   */
  async generateConceptsForCluster(
    databaseId: string,
    clusterId: number,
    tableNames: string[],
    existingConcepts?: Concept[]
  ): Promise<ConceptSuggestion> {
    const response = await axiosInstance.post<ConceptSuggestion>(
      `/databases/${databaseId}/concepts/cluster/${clusterId}`,
      {
        table_names: tableNames,
        existing_concepts: existingConcepts || null
      }
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
