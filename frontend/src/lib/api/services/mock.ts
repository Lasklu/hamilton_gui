import { axiosInstance } from '../client'
import type { 
  Database, 
  DatabaseSchema, 
  ClusteringResult, 
  ClusterRequest,
  JobCreateResponse,
  JobStatusResponse,
  ConceptSuggestion,
  Relationship,
  Attribute
} from '@/lib/types'

export interface AttributeSuggestion {
  attributes: Attribute[]
}

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

    /**
     * Delete a database (mock)
     */
    async delete(databaseId: string): Promise<void> {
      await axiosInstance.delete(`/mock/databases/${databaseId}`)
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
      clustering: ClusteringResult,
      name: string
    ): Promise<{ success: boolean; message: string; clusteringId: number }> {
      // Mock implementation - just return success
      return {
        success: true,
        message: 'Clustering saved successfully (mock)',
        clusteringId: Math.floor(Math.random() * 1000)
      };
    },

    /**
     * List saved clusterings (mock)
     */
    async listSavedClusterings(databaseId: string): Promise<any[]> {
      // Mock implementation - return empty array
      return [];
    },

    /**
     * Get saved clustering (mock)
     */
    async getSavedClustering(databaseId: string, clusteringId: number): Promise<ClusteringResult> {
      // Mock implementation - throw error since we don't have saved data
      throw new Error('Mock mode: No saved clusterings available');
    },

    /**
     * Get active clustering (mock)
     */
    async getActiveClustering(databaseId: string): Promise<ClusteringResult | null> {
      // Mock implementation - return null
      return null;
    },

    /**
     * Activate clustering (mock)
     */
    async activateClustering(databaseId: string, clusteringId: number): Promise<{ success: boolean; message: string }> {
      // Mock implementation
      return {
        success: true,
        message: 'Clustering activated (mock)'
      };
    },
  },

  concepts: {
    /**
     * Generate concept suggestions for a cluster (mock)
     */
    async generateConcepts(
      databaseId: string,
      clusterId: number
    ): Promise<JobCreateResponse> {
      const response = await axiosInstance.post<JobCreateResponse>(
        `/mock/databases/${databaseId}/clusters/${clusterId}/concepts`
      )
      return response.data
    },

    /**
     * Save confirmed concepts for a cluster (mock)
     */
    async saveConcepts(
      databaseId: string,
      clusterId: number,
      concepts: ConceptSuggestion
    ): Promise<{ message: string }> {
      const response = await axiosInstance.post(
        `/mock/databases/${databaseId}/clusters/${clusterId}/concepts/save`,
        concepts
      )
      return response.data
    },

    /**
     * Get all confirmed concepts for a database (mock)
     */
    async getAllConcepts(databaseId: string): Promise<ConceptSuggestion> {
      const response = await axiosInstance.get<ConceptSuggestion>(
        `/mock/databases/${databaseId}/concepts`
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

  relationships: {
    /**
     * Suggest relationships between concepts (mock)
     */
    async suggest(databaseId: string): Promise<Relationship[]> {
      const response = await axiosInstance.get<Relationship[]>(
        `/mock/databases/${databaseId}/relationships/suggest`
      )
      return response.data
    },

    /**
     * Confirm relationships (mock)
     */
    async confirm(databaseId: string, relationships: Relationship[]): Promise<void> {
      await axiosInstance.post(
        `/mock/databases/${databaseId}/relationships/confirm`,
        { relationships }
      )
    },
  },

  attributes: {
    /**
     * Generate attributes for a concept (mock)
     */
    async generateAttributes(
      databaseId: string,
      conceptId: string,
      request: { concept: any; tableNames: string[] }
    ): Promise<JobCreateResponse> {
      const response = await axiosInstance.post<JobCreateResponse>(
        `/mock/databases/${databaseId}/concepts/${conceptId}/attributes`
      )
      return response.data
    },

    /**
     * Save attributes (mock)
     */
    async saveAttributes(
      databaseId: string,
      conceptId: string,
      attributes: AttributeSuggestion
    ): Promise<{ message: string }> {
      const response = await axiosInstance.post<{ message: string }>(
        `/mock/databases/${databaseId}/concepts/${conceptId}/attributes/save`,
        attributes
      )
      return response.data
    },

    /**
     * Get attributes (mock)
     */
    async getAttributes(
      databaseId: string,
      conceptId: string
    ): Promise<AttributeSuggestion> {
      const response = await axiosInstance.get<AttributeSuggestion>(
        `/mock/databases/${databaseId}/concepts/${conceptId}/attributes`
      )
      return response.data
    },
  },

  models: {
    /**
     * Get model status (mock)
     */
    async getStatus(): Promise<{ base?: string; concept?: string; relationship?: string; attribute?: string; naming?: string }> {
      return {
        base: 'ready',
        concept: 'not_loaded',
        relationship: 'not_loaded',
        attribute: 'not_loaded',
        naming: 'not_loaded',
      }
    },

    /**
     * Load base model (mock)
     */
    async loadBaseModel(): Promise<{ status: string; message: string; model_status: string }> {
      return {
        status: 'already_loaded',
        message: 'Base model is already loaded (mock)',
        model_status: 'ready',
      }
    },
  },
}