import { axiosInstance } from '../client'
import type { Relationship } from '@/lib/types'

export const relationshipsApi = {
  async suggest(databaseId: string): Promise<Relationship[]> {
    const response = await axiosInstance.post(`/databases/${databaseId}/relationships/suggest`, {})
    return response.data
  },

  async confirm(databaseId: string, relationships: Relationship[]): Promise<void> {
    await axiosInstance.post(`/databases/${databaseId}/relationships/confirm`, { relationships })
  },
}
