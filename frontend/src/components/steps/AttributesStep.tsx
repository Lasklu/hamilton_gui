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
  const [selectedTable, setSelectedTable] = useState<string | null>(null)

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
      const match = condition.match(/(\w+)\./)
      if (match) {
        const clusterId = findClusterByTable(match[1])
        if (clusterId !== null) clusterIds.add(clusterId)
      }
    })

    // Add clusters from joins
    concept.joins?.forEach(join => {
      const tableMatches = join.matchAll(/(\w+)\./g)
      for (const match of tableMatches) {
        const clusterId = findClusterByTable(match[1])
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
    toast.success('Attributes confirmed for this concept')
    
    // Move to next concept or complete
    if (currentConceptIndex < allConcepts.length - 1) {
      setCurrentConceptIndex(currentConceptIndex + 1)
    } else {
      // All concepts confirmed
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

  const handleTableHighlight = (tables: string[]) => {
    // Set the first table as selected for highlighting
    if (tables.length > 0) {
      setSelectedTable(tables[0])
    } else {
      setSelectedTable(null)
    }
  }

  const handleColumnClickForDialog = (table: string, column: string) => {
    setSelectedTable(table)
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header with Concept Navigation */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Attributes
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Define attributes for each concept
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Progress: {confirmedConcepts.size} / {allConcepts.length} concepts
                </div>
              </div>
            </div>

            {/* Concept Navigation Bar with Arrows */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentConceptIndex(Math.max(0, currentConceptIndex - 1))}
                disabled={currentConceptIndex === 0}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Concept Pills */}
              <div className="flex-1 flex items-center gap-2 overflow-x-auto py-2">
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
                          ? 'bg-primary-500 text-white shadow-md scale-105'
                          : isConfirmed
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/40'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {concept.name || concept.id}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setCurrentConceptIndex(Math.min(allConcepts.length - 1, currentConceptIndex + 1))}
                disabled={currentConceptIndex === allConcepts.length - 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Database viewer with accordion clusters */}
        <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Related Clusters
            </h3>
            
            {/* Accordion for each cluster */}
            <div className="space-y-2">
              {relevantClusters.map(clusterId => {
                const cluster = clusteringResult.clusters.find(c => c.clusterId === clusterId)
                const isExpanded = expandedClusters.has(clusterId)
                const clusterSchema = getClusterSchema(clusterId)
                
                return (
                  <div
                    key={clusterId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Cluster Header - Always Visible */}
                    <button
                      onClick={() => toggleClusterExpanded(clusterId)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {cluster?.name || `Cluster ${clusterId}`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {cluster?.tables.length || 0} tables
                      </span>
                    </button>

                    {/* Cluster Content - Expandable */}
                    {isExpanded && clusterSchema && (
                      <div className="p-4 bg-white dark:bg-gray-800" style={{ height: '400px' }}>
                        <TableClusterView
                          cluster={{
                            clusterId: cluster!.clusterId,
                            name: cluster!.name,
                            tables: cluster!.tables
                          }}
                          schema={clusterSchema}
                          clickableColumns={true}
                          onColumnClick={handleColumnClick}
                          className="h-full"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right side: Attributes view */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {schema && (
            <AttributeSuggestionView
              concept={currentConcept}
              attributes={currentAttributes}
              schema={schema}
              onAttributesUpdate={(attrs) => handleAttributeUpdate(currentConcept.id, attrs)}
              onConfirm={() => handleConceptConfirm(currentConcept.id)}
              selectedColumn={selectedColumn}
              selectedTable={selectedTable}
              onColumnClickHandled={() => setSelectedColumn(null)}
              onRequestColumnSelection={() => {
                // Enable column selection mode in database viewer
                // The TableClusterView already has clickableColumns={true}
              }}
              onCancelColumnSelection={() => {
                // Cancel column selection mode
                setSelectedColumn(null)
              }}
              onTableHighlight={handleTableHighlight}
              onColumnClick={handleColumnClickForDialog}
            />
          )}
        </div>
      </div>
    </div>
  )
}
