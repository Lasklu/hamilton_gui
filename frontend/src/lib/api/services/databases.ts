import { axiosInstance } from '../client'
import type { Database, DatabaseSchema } from '@/lib/types'

export const databasesApi = {
  /**
   * List all databases
   */
  async list(): Promise<Database[]> {
    const response = await axiosInstance.get<Database[]>('/databases')
    return response.data
  },

  /**
   * Connect to a database via connection string
   */
  async connect(name: string, connectionString: string): Promise<Database> {
    const response = await axiosInstance.post<Database>('/databases/connect', {
      name,
      connectionString,
    })
    return response.data
  },

  /**
   * Create a new database from SQL file
   */
  async create(name: string, sqlFile: File): Promise<Database> {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('sql_file', sqlFile)

    const response = await axiosInstance.post<Database>('/databases', formData)
    return response.data
  },

  /**
   * Create a new database from SQL text
   */
  async createFromText(name: string, sqlContent: string): Promise<Database> {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('sql_content', sqlContent)

    const response = await axiosInstance.post<Database>('/databases/from-text', formData)
    return response.data
  },

  /**
   * Get database by ID
   */
  async get(databaseId: string): Promise<Database> {
    const response = await axiosInstance.get<Database>(`/databases/${databaseId}`)
    return response.data
  },

  /**
   * Get database schema metadata (tables and columns)
   */
  async getSchema(databaseId: string): Promise<DatabaseSchema> {
    const response = await axiosInstance.get<DatabaseSchema>(
      `/databases/${databaseId}/schema`
    )
    return response.data
  },
}
