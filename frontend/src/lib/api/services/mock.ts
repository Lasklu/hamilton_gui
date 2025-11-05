import { axiosInstance } from '../client'
import type { 
  Database, 
  DatabaseSchema, 
  ClusteringResult, 
  ClusterRequest,
  JobCreateResponse,
  JobStatusResponse
} from '@/lib/types'

/**
 * Mock API endpoints for testing without backend logic.
 * These endpoints return fake data immediately.
 */
export const mockApi = {
  databases: {
    /**
     * List all databases (mock)
     */
    async list(): Promise<Database[]> {
      const response = await axiosInstance.get<Database[]>('/mock/databases')
      return response.data
    },

    /**
     * Connect to a database (mock)
     */
    async connect(name: string, connectionString: string): Promise<Database> {
      const response = await axiosInstance.post<Database>('/mock/databases/connect', {
        name,
        connectionString,
      })
      return response.data
    },

    /**
     * Create a new database from SQL file (mock)
     */
    async create(name: string, sqlFile: File): Promise<Database> {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('sql_file', sqlFile)

      const response = await axiosInstance.post<Database>('/mock/databases', formData)
      return response.data
    },

    /**
     * Create a new database from SQL text (mock)
     */
    async createFromText(name: string, sqlContent: string): Promise<Database> {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('sql_content', sqlContent)

      const response = await axiosInstance.post<Database>(
        '/mock/databases/from-text',
        formData
      )
      return response.data
    },

    /**
     * Get database by ID (mock)
     */
    async get(databaseId: string): Promise<Database> {
      const response = await axiosInstance.get<Database>(`/mock/databases/${databaseId}`)
      return response.data
    },

    /**
     * Get database schema metadata (mock)
     */
    async getSchema(databaseId: string): Promise<DatabaseSchema> {
      const response = await axiosInstance.get<DatabaseSchema>(
        `/mock/databases/${databaseId}/schema`
      )
      return response.data
    },
  },

  clustering: {
    /**
     * Start clustering job (mock)
     */
    async cluster(
      databaseId: string,
      options: ClusterRequest = {}
    ): Promise<JobCreateResponse> {
      const response = await axiosInstance.post<JobCreateResponse>(
        `/mock/databases/${databaseId}/cluster`,
        options
      )
      return response.data
    },

    /**
     * Save updated clustering (mock)
     */
    async saveClustering(
      databaseId: string,
      clustering: ClusteringResult
    ): Promise<{ success: boolean; message: string; clustering: ClusteringResult }> {
      const response = await axiosInstance.put(
        `/mock/databases/${databaseId}/cluster`,
        clustering
      )
      return response.data
    },
  },

  jobs: {
    /**
     * Get job status (mock)
     */
    async getStatus(jobId: string): Promise<JobStatusResponse> {
      const response = await axiosInstance.get<JobStatusResponse>(`/mock/jobs/${jobId}`)
      return response.data
    },
  },
}