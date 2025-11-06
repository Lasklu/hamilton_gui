import { databasesApi } from './databases'
import { clusteringApi } from './clustering'
import { ontologyApi } from './ontology'
import { jobsApi } from './jobs'
import { conceptsApi } from './concepts'
import { relationshipsApi } from './relationships'
import { mockApi } from './mock'
import type { Relationship } from '@/lib/types'

// Re-export individual services
export { databasesApi, clusteringApi, ontologyApi, jobsApi, conceptsApi, relationshipsApi, mockApi }

// Combined API client
export const apiClient = {
  databases: databasesApi,
  clustering: clusteringApi,
  ontology: ontologyApi,
  jobs: jobsApi,
  concepts: conceptsApi,
  relationships: relationshipsApi,
} as const

// Mock API client for testing
export const mockClient = {
  databases: mockApi.databases,
  clustering: mockApi.clustering,
  jobs: mockApi.jobs,
  concepts: mockApi.concepts,
  relationships: mockApi.relationships,
} as const
