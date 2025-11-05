/**
 * TypeScript types matching the OpenAPI schema definitions
 */

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface Database {
  id: string;
  name: string;
  createdAt: string;
}

export interface TableRef {
  schema: string;
  name: string;
}

export interface ClusteringGroup {
  label?: string;
  tables: TableRef[];
  scores?: Record<string, number>;
}

export interface ClusteringSuggestions {
  databaseId: string;
  createdAt: string;
  appliedFinetuning?: boolean;
  groups: ClusteringGroup[];
}

export interface IDAttributeSet {
  attributes: Array<{
    table: string;
    column: string;
  }>;
}

export interface JoinSide {
  table: string;
  columns: string[];
}

export interface JoinJSON {
  left: JoinSide;
  right: JoinSide;
}

export type ConditionOperator = 
  | 'EQUALS' 
  | 'NOT_EQUALS' 
  | 'LESS_THAN' 
  | 'LESS_THAN_EQUALS' 
  | 'GREATER_THAN' 
  | 'GREATER_THAN_EQUALS';

export interface ConditionJSON {
  operator: ConditionOperator;
  value: unknown;
  table: string;
  column: string;
}

export interface ConceptJSON {
  id_attributes?: IDAttributeSet[];
  attributes?: Array<{
    table: string;
    column: string;
  }>;
  joins?: JoinJSON[];
  sub_concepts?: ConceptJSON[];
  conditions?: ConditionJSON[];
  concept_representations?: ConceptJSON[];
}

export interface ObjectPropertyJSON {
  concept1: {
    id_attributes: IDAttributeSet[];
  };
  concept2: {
    id_attributes: IDAttributeSet[];
  };
  joins: JoinJSON[];
}

export interface ScopedRequest {
  databaseId: string;
  tables: TableRef[];
  modelingHints?: Record<string, unknown>;
}

export interface AttributesRequest extends ScopedRequest {
  concept: ConceptJSON;
}

export interface AttributeInfo {
  conceptId: number | string;
  name: string;
  sourceColumns: Array<{
    schema: string;
    table: string;
    column: string;
  }>;
}

export interface RelationshipsRequest extends ScopedRequest {
  concepts: Array<{
    id_attributes?: IDAttributeSet[];
  }>;
  attributes: AttributeInfo[];
  modelingHints?: Record<string, unknown>;
}

// Response types for probabilistic sampling
export interface ConceptWithLikelihood {
  concept: ConceptJSON;
  likelihood: number;
}

export interface ObjectPropertyWithLikelihood {
  object_property: ObjectPropertyJSON;
  likelihood: number;
}

export type ConceptsResponse = ConceptJSON[] | ConceptWithLikelihood[];
export type ConceptResponse = ConceptJSON | ConceptWithLikelihood[];
export type ObjectPropertiesResponse = ObjectPropertyJSON[] | ObjectPropertyWithLikelihood[];
