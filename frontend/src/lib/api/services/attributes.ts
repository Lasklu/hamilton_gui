/**
 * Attributes API service
 */
import { axiosInstance } from '../client'
import type { Attribute, JobCreateResponse } from '@/lib/types'

export interface AttributeSuggestion {
  attributes: Attribute[]
}

export const attributesApi = {
  /**
   * Generate attribute suggestions for a concept
   */
  async generateAttributes(
    databaseId: string,
    conceptId: string
  ): Promise<JobCreateResponse> {
    const response = await axiosInstance.post<JobCreateResponse>(
      `/databases/${databaseId}/concepts/${conceptId}/attributes`
    )
    return response.data
  },

  /**
   * Save confirmed attributes for a concept
   */
  async saveAttributes(
    databaseId: string,
    conceptId: string,
    attributes: AttributeSuggestion
  ): Promise<{ message: string }> {
    const response = await axiosInstance.post<{ message: string }>(
      `/databases/${databaseId}/concepts/${conceptId}/attributes/save`,
      attributes
    )
    return response.data
  },

  /**
   * Get all confirmed attributes for a concept
   */
  async getAttributes(
    databaseId: string,
    conceptId: string
  ): Promise<AttributeSuggestion> {
    const response = await axiosInstance.get<AttributeSuggestion>(
      `/databases/${databaseId}/concepts/${conceptId}/attributes`
    )
    return response.data
  },
}
