import { apiClient } from '../client'
import type { Relationship } from '@/lib/types'

export const relationshipsApi = {
  async suggest(databaseId: string): Promise<Relationship[]> {
    const response = await apiClient.post(`/databases/${databaseId}/relationships/suggest`, {})
    return response.data
  },

  async confirm(databaseId: string, relationships: Relationship[]): Promise<void> {
    await apiClient.post(`/databases/${databaseId}/relationships/confirm`, { relationships })
  },
}
