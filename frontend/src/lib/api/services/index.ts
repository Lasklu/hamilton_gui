import { databasesApi } from './databases'
import { clusteringApi } from './clustering'
import { ontologyApi } from './ontology'
import { jobsApi } from './jobs'
import { mockApi } from './mock'

// Re-export individual services
export { databasesApi, clusteringApi, ontologyApi, jobsApi, mockApi }

// Combined API client
export const apiClient = {
  databases: databasesApi,
  clustering: clusteringApi,
  ontology: ontologyApi,
  jobs: jobsApi,
} as const

// Mock API client for testing
export const mockClient = {
  databases: mockApi.databases,
  clustering: mockApi.clustering,
  jobs: mockApi.jobs,
} as const
