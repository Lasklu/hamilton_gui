import { axiosInstance } from '../client'
import type {
  ScopedRequest,
  AttributesRequest,
  RelationshipsRequest,
  ConceptJSON,
  ConceptWithLikelihood,
  ObjectPropertyJSON,
  ObjectPropertyWithLikelihood,
} from '@/lib/types'

export const ontologyApi = {
  /**
   * Generate concepts for given tables
   */
  async generateConcepts(
    request: ScopedRequest,
    samples: number = 1
  ): Promise<ConceptJSON[] | ConceptWithLikelihood[]> {
    const response = await axiosInstance.post(
      `/ontology/concepts?samples=${samples}`,
      request
    )
    return response.data
  },

  /**
   * Generate/augment attributes for a concept
   */
  async generateAttributes(
    request: AttributesRequest,
    samples: number = 1
  ): Promise<ConceptJSON | ConceptWithLikelihood[]> {
    const response = await axiosInstance.post(
      `/ontology/attributes?samples=${samples}`,
      request
    )
    return response.data
  },

  /**
   * Generate relationships between concepts
   */
  async generateRelationships(
    request: RelationshipsRequest,
    samples: number = 1
  ): Promise<ObjectPropertyJSON[] | ObjectPropertyWithLikelihood[]> {
    const response = await axiosInstance.post(
      `/ontology/relationships?samples=${samples}`,
      request
    )
    return response.data
  },
}
