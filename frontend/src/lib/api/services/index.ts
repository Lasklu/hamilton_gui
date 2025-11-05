import { databasesApi } from './databases'
import { clusteringApi } from './clustering'
import { ontologyApi } from './ontology'
import { mockApi } from './mock'

// Re-export individual services
export { databasesApi, clusteringApi, ontologyApi, mockApi }

// Combined API client
export const apiClient = {
  databases: databasesApi,
  clustering: clusteringApi,
  ontology: ontologyApi,
} as const

// Mock API client for testing
export const mockClient = {
  databases: mockApi.databases,
  clustering: mockApi.clustering,
} as const
