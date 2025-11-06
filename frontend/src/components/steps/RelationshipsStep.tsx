'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { RelationshipGraphView } from '@/components/relationships/RelationshipGraphView'
import { apiClient, mockClient } from '@/lib/api/services'
import type { Concept, Relationship } from '@/lib/types'

interface RelationshipsStepProps {
  databaseId: string
  concepts: Record<string, { concepts: Concept[]; confirmed: boolean }>
  useMockApi?: boolean
  onComplete: () => void
}

type Stage = 'graph' | 'confirmation'

export function RelationshipsStep({
  databaseId,
  concepts: initialConcepts,
  useMockApi = false,
  onComplete
}: RelationshipsStepProps) {
  const [stage, setStage] = useState<Stage>('graph')
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [menuCollapsed, setMenuCollapsed] = useState(false)

  const client = useMockApi ? mockClient : apiClient
  const hasInitialized = useRef(false)

  // Get all concepts from all clusters
  const allConcepts = Object.values(initialConcepts)
    .flatMap(c => c.concepts)
    .filter(c => c.id)

  // Fetch relationships from API
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const fetchRelationships = async () => {
      setIsLoading(true)
      setLoadingProgress(0)
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      try {
        const relationshipData = await client.relationships.suggest(databaseId)
        setLoadingProgress(100)
        setRelationships(relationshipData)
        toast.success('Relationships loaded successfully')
      } catch (error) {
        console.error('Error fetching relationships:', error)
        toast.error('Failed to load relationships')
        setLoadingProgress(0)
      } finally {
        clearInterval(progressInterval)
        // Small delay to show 100% before hiding
        setTimeout(() => {
          setIsLoading(false)
        }, 300)
      }
    }

    fetchRelationships()
  }, [databaseId, client])

  const handleAddRelationship = (fromConceptId: string, toConceptId: string) => {
    // Check if relationship already exists in this direction
    const exists = relationships.some(
      r => r.fromConceptId === fromConceptId && r.toConceptId === toConceptId
    )
    
    if (exists) {
      toast.error('Relationship already exists in this direction')
      return
    }

    const newRelationship: Relationship = {
      id: `rel-${Date.now()}`,
      fromConceptId,
      toConceptId,
      name: '', // Will be filled in stage 2
      confidence: undefined,
    }
    setRelationships([...relationships, newRelationship])
  }

  const handleRemoveRelationship = (relationshipId: string) => {
    setRelationships(relationships.filter(r => r.id !== relationshipId))
  }

  const handleProceedToConfirmation = () => {
    setStage('confirmation')
  }

  const handleBackToGraph = () => {
    setStage('graph')
  }

  const handleConfirmAll = () => {
    toast.success('Relationships confirmed!')
    onComplete()
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        <div className="text-center max-w-md w-full px-8">
          <Loader2 className="w-16 h-16 animate-spin text-primary-500 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Loading relationships...
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Analyzing concept connections and suggesting relationships
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {loadingProgress}%
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stage Indicator */}
      <div className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          stage === 'graph' 
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
            stage === 'graph'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}>
            1
          </div>
          <span className="font-medium">Create Relationships</span>
        </div>
        
        <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700" />
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          stage === 'confirmation' 
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
            stage === 'confirmation'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          }`}>
            2
          </div>
          <span className="font-medium">Confirmation</span>
        </div>
      </div>

      {/* Collapsible Menu Bar */}
      {!menuCollapsed ? (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {stage === 'graph' ? 'Relationship Graph' : 'Confirm Relationships'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stage === 'graph' 
                  ? 'Click a concept to start, then drag to another concept to create a relationship'
                  : 'Review and confirm the relationships'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {relationships.length} relationship{relationships.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setMenuCollapsed(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Collapse menu"
              >
                <ChevronDown className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-2">
          <button
            onClick={() => setMenuCollapsed(false)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            <span>Show menu</span>
          </button>
        </div>
      )}

      {/* Stage Content - Takes full space */}
      <div className="flex-1 overflow-hidden">
        {stage === 'graph' ? (
          <RelationshipGraphView
            concepts={allConcepts}
            relationships={relationships}
            onAddRelationship={handleAddRelationship}
            onRemoveRelationship={handleRemoveRelationship}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Confirmation Stage
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This stage will be implemented later
              </p>
              <button
                onClick={handleBackToGraph}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Back to Graph
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          {stage === 'graph' ? (
            <>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Drag between concepts to create relationships
              </div>
              <button
                onClick={handleProceedToConfirmation}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                Continue to Confirmation
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBackToGraph}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
              >
                Back to Graph
              </button>
              <button
                onClick={handleConfirmAll}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                Confirm All & Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
