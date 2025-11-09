'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { TableClusterView } from '@/components/concepts/TableClusterView'
import { AttributeSuggestionView } from '@/components/attributes/AttributeSuggestionView'
import { apiClient, mockClient } from '@/lib/api/services'
import type { ClusteringResult, Concept, Attribute, DatabaseSchema } from '@/lib/types'

interface AttributesStepProps {
  databaseId: string
  clusteringResult: ClusteringResult
  concepts: Record<string, { concepts: Concept[]; confirmed: boolean }>
  useMockApi?: boolean
  onComplete: () => void
}

export function AttributesStep({
  databaseId,
  clusteringResult,
  concepts: initialConcepts,
  useMockApi = false,
  onComplete
}: AttributesStepProps) {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null)
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0)
  const [attributes, setAttributes] = useState<Record<string, Attribute[]>>({})
  const [confirmedConcepts, setConfirmedConcepts] = useState<Set<string>>(new Set())
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())
  const [selectedColumn, setSelectedColumn] = useState<{
    table: string
    column: string
  } | null>(null)

  const client = useMockApi ? mockClient : apiClient
  const hasInitialized = useRef(false)

  // Fetch schema
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const schemaData = await client.databases.getSchema(databaseId)
        setSchema(schemaData)
      } catch (error) {
        console.error('Error fetching schema:', error)
        toast.error('Failed to load database schema')
      }
    }

    fetchSchema()
  }, [databaseId, client])

  // Get all concepts from all clusters
  const allConcepts = Object.values(initialConcepts)
    .flatMap(c => c.concepts)
    .filter(c => c.id) // Only concepts with IDs

  const currentConcept = allConcepts[currentConceptIndex]

  // Get clusters relevant to current concept
  const getRelevantClusters = (concept: Concept): number[] => {
    const clusterIds = new Set<number>()
    
    // Add clusters from ID attributes
    concept.idAttributes?.forEach(idAttr => {
      idAttr.attributes?.forEach(attr => {
        const clusterId = findClusterByTable(attr.table)
        if (clusterId !== null) clusterIds.add(clusterId)
      })
    })
    
    // Add clusters from conditions
    concept.conditions?.forEach(condition => {
      if (typeof condition === 'string') {
        const match = condition.match(/(\w+)\./)
        if (match) {
          const clusterId = findClusterByTable(match[1])
          if (clusterId !== null) clusterIds.add(clusterId)
        }
      } else {
        // ConceptCondition object
        const clusterId = findClusterByTable(condition.table)
        if (clusterId !== null) clusterIds.add(clusterId)
      }
    })
    
    return Array.from(clusterIds)
  }

  const findClusterByTable = (tableName: string): number | null => {
    const cluster = clusteringResult.clusters.find((c) =>
      c.tables.includes(tableName)
    )
    return cluster ? cluster.clusterId : null
  }

  // Initialize expanded clusters for current concept
  useEffect(() => {
    if (currentConcept) {
      const relevantClusters = getRelevantClusters(currentConcept)
      // Expand first cluster by default
      if (relevantClusters.length > 0) {
        setExpandedClusters(new Set([relevantClusters[0]]))
      }
      hasInitialized.current = false
    }
  }, [currentConceptIndex])

  // Load attributes for current concept
  useEffect(() => {
    if (currentConcept && !hasInitialized.current) {
      hasInitialized.current = true
      loadAttributes(currentConcept.id)
    }
  }, [currentConcept])

  const loadAttributes = async (conceptId: string) => {
    // Check if already loaded
    if (attributes[conceptId]) return

    // TODO: Replace with actual API call
    // For now, generate mock attributes from concept's idAttributes
    const concept = allConcepts.find(c => c.id === conceptId)
    
    // Generate attributes from idAttributes
    const mockAttributes: Attribute[] = []
    if (concept?.idAttributes && concept.idAttributes.length > 0) {
      concept.idAttributes.forEach((idAttr, idx) => {
        idAttr.attributes?.forEach((attr) => {
          mockAttributes.push({
            id: `attr-${conceptId}-${mockAttributes.length}`,
            name: attr.column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            column: attr.column,
            table: attr.table,
            dataType: 'VARCHAR',
            isRequired: true // ID attributes are typically required
          })
        })
      })
    }
    
    // Add some additional mock attributes
    if (mockAttributes.length < 3 && concept) {
      const baseTable = concept.idAttributes?.[0]?.attributes?.[0]?.table || 'table1'
      mockAttributes.push({
        id: `attr-${conceptId}-${mockAttributes.length}`,
        name: 'Sample Attribute',
        column: 'sample_column',
        table: baseTable,
        dataType: 'VARCHAR',
        isRequired: false
      })
    }
    
    setAttributes(prev => ({
      ...prev,
      [conceptId]: mockAttributes
    }))
  }

  const handleConceptConfirm = (conceptId: string) => {
    setConfirmedConcepts(prev => new Set([...prev, conceptId]))
    
    // Move to next concept or complete
    if (currentConceptIndex < allConcepts.length - 1) {
      setCurrentConceptIndex(currentConceptIndex + 1)
    } else {
      onComplete()
    }
  }

  const handleAttributeUpdate = (conceptId: string, updatedAttributes: Attribute[]) => {
    setAttributes(prev => ({
      ...prev,
      [conceptId]: updatedAttributes
    }))
  }

  const handleColumnClick = (table: string, column: string) => {
    setSelectedColumn({ table, column })
  }

  const toggleClusterExpanded = (clusterId: number) => {
    setExpandedClusters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId)
      } else {
        newSet.add(clusterId)
      }
      return newSet
    })
  }

  // Get schema for a specific cluster
  const getClusterSchema = (clusterId: number): DatabaseSchema | null => {
    if (!schema) return null
    
    const cluster = clusteringResult.clusters.find(c => c.clusterId === clusterId)
    if (!cluster) return null
    
    const clusterTables = schema.tables.filter(t => cluster.tables.includes(t.name))
    
    return {
      databaseId: schema.databaseId,
      tableCount: clusterTables.length,
      tables: clusterTables
    }
  }

  const relevantClusters = currentConcept ? getRelevantClusters(currentConcept) : []
  const currentAttributes = currentConcept ? attributes[currentConcept.id] || [] : []

  if (!currentConcept) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 dark:text-gray-400">No concepts to edit</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-50 dark:bg-gray-900">
      {/* Left side: Database viewer with cluster toggles */}
      <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Cluster toggles */}
        {relevantClusters.length > 1 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Related Clusters
            </h3>
            <div className="flex flex-wrap gap-2">
              {relevantClusters.map(clusterId => {
                const cluster = clusteringResult.clusters.find(c => c.clusterId === clusterId)
                const isVisible = visibleClusters.has(clusterId)
                
                return (
                  <button
                    key={clusterId}
                    onClick={() => toggleClusterVisibility(clusterId)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isVisible
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cluster?.name || `Cluster ${clusterId}`}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Database viewer */}
                {/* Database viewer */}
        <div className="flex-1 overflow-auto p-4 bg-white dark:bg-gray-800">
          {visibleClusters.size > 0 && schema ? (
            <TableClusterView
              cluster={{
                clusterId: -1, // Combined view
                name: 'Related Tables',
                tables: Array.from(visibleClusters).flatMap(
                  cId => {
                    const cluster = clusteringResult.clusters.find(c => c.clusterId === cId)
                    return cluster?.tables || []
                  }
                )
              }}
              schema={getVisibleSchema()!}
              clickableColumns={true}
              onColumnClick={handleColumnClick}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Select a cluster to view tables
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Concept navigation and attributes */}
      <div className="w-1/2 flex flex-col">
        {/* Concept navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Attributes
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentConceptIndex + 1} / {allConcepts.length}
            </span>
          </div>

          {/* Concept selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {allConcepts.map((concept, index) => {
              const isCurrent = index === currentConceptIndex
              const isConfirmed = confirmedConcepts.has(concept.id)

              return (
                <button
                  key={concept.id}
                  onClick={() => {
                    setCurrentConceptIndex(index)
                    hasInitialized.current = false
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    isCurrent
                      ? 'bg-primary-500 text-white shadow-md'
                      : isConfirmed
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{concept.name || concept.id}</span>
                    {isConfirmed && <span>✓</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Attributes view */}
        <div className="flex-1 overflow-auto">
          {schema && (
            <AttributeSuggestionView
              concept={currentConcept}
              attributes={currentAttributes}
              schema={schema}
              onAttributesUpdate={(attrs) => handleAttributeUpdate(currentConcept.id, attrs)}
              onConfirm={() => handleConceptConfirm(currentConcept.id)}
              selectedColumn={selectedColumn}
              onColumnClickHandled={() => setSelectedColumn(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
