/**
 * Type definitions matching the API schema
 */

// Re-export job types
export * from './job'

// Common types
export interface TableRef {
  schema: string
  name: string
}

export interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, any>
}

// Database types
export interface Database {
  id: string
  name: string
  createdAt: string
}

export interface DatabaseCreateRequest {
  name: string
  sqlFile: File
}

export interface ColumnMetadata {
  name: string
  dataType: string
  nullable?: boolean
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  foreignKeyReference?: string
  defaultValue?: string
}

export interface TableMetadata {
  schema: string
  name: string
  columnCount?: number
  columns: ColumnMetadata[]
}

export interface DatabaseSchema {
  databaseId: string
  tableCount: number
  tables: TableMetadata[]
}

// Clustering types
export interface ClusteringGroup {
  label?: string
  tables: TableRef[]
  scores?: Record<string, number>
}

export interface ClusteringSuggestions {
  databaseId: string
  createdAt: string
  appliedFinetuning?: boolean
  groups: ClusteringGroup[]
}

export interface ClusterRequest {
  applyFinetuning?: boolean
}

// Additional clustering types for the new API
export interface ClusterInfo {
  clusterId: number
  name: string
  description?: string
  tables: string[]
  confidence?: number
}

export interface ClusteringResult {
  databaseId: string
  clusters: ClusterInfo[]
  createdAt: string
}

// Concept types
export interface ConceptAttribute {
  table: string
  column: string
}

export interface ConceptIDAttribute {
  attributes: ConceptAttribute[]
}

export interface Concept {
  id: string
  name?: string
  clusterId: number
  idAttributes: ConceptIDAttribute[]
  attributes?: ConceptAttribute[]
  confidence?: number
  subConcepts?: Concept[]
  conditions?: string[]
  joins?: string[]
}

// Attribute types (for the attributes editing step)
export interface Attribute {
  id: string
  name: string
  column: string
  table: string
  dataType: string
  isRequired: boolean
  conditions?: string[]
  transform?: string
  joins?: string[]
  staticValue?: string // Alternative to table/column reference
}

export interface ConceptSuggestion {
  concepts: Concept[]
}

export interface ClusterConceptsRequest {
  clusterId: number
}

// Ontology types
export interface IDAttributeSet {
  attributes: Array<{ table: string; column: string }>
}

export interface JoinSide {
  table: string
  columns: string[]
}

export interface JoinJSON {
  left: JoinSide
  right: JoinSide
}

export interface ConditionJSON {
  operator: 'EQUALS' | 'NOT_EQUALS' | 'LESS_THAN' | 'LESS_THAN_EQUALS' | 'GREATER_THAN' | 'GREATER_THAN_EQUALS'
  value: any
  table: string
  column: string
}

export interface ConceptJSON {
  idAttributes?: IDAttributeSet[]
  attributes?: Array<{ table: string; column: string }>
  joins?: JoinJSON[]
  subConcepts?: ConceptJSON[]
  conditions?: ConditionJSON[]
  conceptRepresentations?: ConceptJSON[]
}

export interface ObjectPropertyJSON {
  concept1: { idAttributes: IDAttributeSet[] }
  concept2: { idAttributes: IDAttributeSet[] }
  joins: JoinJSON[]
}

export interface ScopedRequest {
  databaseId: string
  tables: TableRef[]
  modelingHints?: Record<string, any>
}

export interface AttributesRequest extends ScopedRequest {
  concept: ConceptJSON
}

export interface AttributeInfo {
  conceptId: number | string
  name: string
  sourceColumns: Array<{
    schema: string
    table: string
    column: string
  }>
}

export interface ConceptIdentifier {
  idAttributes: IDAttributeSet[]
}

export interface RelationshipsRequest extends ScopedRequest {
  concepts: ConceptIdentifier[]
  attributes: AttributeInfo[]
  modelingHints?: Record<string, any>
}

export interface ConceptWithLikelihood {
  concept: ConceptJSON
  likelihood: number
}

export interface ObjectPropertyWithLikelihood {
  objectProperty: ObjectPropertyJSON
  likelihood: number
}
