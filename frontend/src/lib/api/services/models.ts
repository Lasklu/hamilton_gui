/**
 * Models API service
 */
import { axiosInstance } from '../client'

export interface ModelStatusResponse {
  base?: string
  concept?: string
  relationship?: string
  attribute?: string
  naming?: string
}

export interface LoadBaseModelResponse {
  status: 'success' | 'already_loaded' | 'loading' | 'error'
  message: string
  model_status: string
}

export const modelsApi = {
  /**
   * Get status of all models
   */
  async getStatus(): Promise<ModelStatusResponse> {
    const response = await axiosInstance.get<ModelStatusResponse>('/models/status')
    return response.data
  },

  /**
   * Load the base model into GPU memory
   */
  async loadBaseModel(): Promise<LoadBaseModelResponse> {
    const response = await axiosInstance.post<LoadBaseModelResponse>('/models/load-base')
    return response.data
  },
}
