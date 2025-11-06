import { useState, useEffect, useRef } from 'react'

export type JoinWorkflowPhase = 'selection' | 'join-step-1' | 'join-step-2' | 'complete'

export interface JoinWorkflowState {
  phase: JoinWorkflowPhase
  attrTable?: string
  attrColumn?: string
  existingTable?: string
  existingColumn?: string
  newColumn?: string
}

export interface UseJoinWorkflowParams {
  existingTables: Set<string>
  selectedTable: string | null | undefined
  selectedColumn: string | null | undefined
  isActive: boolean // Whether the workflow is currently active (e.g., adding attribute reference)
  onComplete?: (result: {
    table: string
    column: string
    join?: string
    joinType?: 'LEFT' | 'INNER' | 'RIGHT'
  }) => void
}

/**
 * Shared hook for managing join workflow state across concepts and attributes.
 * Handles the 3-phase workflow:
 * 1. selection: Initial column selection (checks if join needed)
 * 2. join-step-1: Select column in existing table
 * 3. join-step-2: Select matching column in new table
 * 4. complete: Join created, ready to save
 */
export function useJoinWorkflow({
  existingTables,
  selectedTable,
  selectedColumn,
  isActive,
  onComplete,
}: UseJoinWorkflowParams) {
  const [workflow, setWorkflow] = useState<JoinWorkflowState>({ phase: 'selection' })
  const [joinType, setJoinType] = useState<'LEFT' | 'INNER' | 'RIGHT'>('LEFT')
  const prevSelectedRef = useRef<string | null>(null)

  // Check if a table needs a join
  const needsJoin = (table: string | null | undefined): boolean => {
    if (!table) return false
    return existingTables.size > 0 && !existingTables.has(table)
  }

  // Reset workflow when becoming inactive
  useEffect(() => {
    if (!isActive) {
      setWorkflow({ phase: 'selection' })
      setJoinType('LEFT')
      prevSelectedRef.current = null
    }
  }, [isActive])

  // Handle column selection changes
  useEffect(() => {
    if (!isActive || !selectedTable || !selectedColumn) return

    // Create a key to track changes
    const currentKey = `${selectedTable}.${selectedColumn}`
    if (currentKey === prevSelectedRef.current) return
    prevSelectedRef.current = currentKey

    if (workflow.phase === 'selection') {
      // Initial selection - check if join is needed
      if (needsJoin(selectedTable)) {
        // Start join workflow
        setWorkflow({
          phase: 'join-step-1',
          attrTable: selectedTable,
          attrColumn: selectedColumn,
        })
      } else {
        // No join needed - complete immediately
        setWorkflow({ phase: 'complete', attrTable: selectedTable, attrColumn: selectedColumn })
        onComplete?.({
          table: selectedTable,
          column: selectedColumn,
        })
      }
    } else if (workflow.phase === 'join-step-1') {
      // Step 1: User clicked on column in existing table
      if (existingTables.has(selectedTable)) {
        setWorkflow({
          ...workflow,
          phase: 'join-step-2',
          existingTable: selectedTable,
          existingColumn: selectedColumn,
        })
      }
    } else if (workflow.phase === 'join-step-2') {
      // Step 2: User clicked on matching column in new table
      if (workflow.attrTable && selectedTable === workflow.attrTable) {
        const joinStatement = `${joinType} JOIN ${workflow.attrTable} ON ${workflow.existingTable}.${workflow.existingColumn} = ${workflow.attrTable}.${selectedColumn}`
        
        setWorkflow({
          ...workflow,
          phase: 'complete',
          newColumn: selectedColumn,
        })

        onComplete?.({
          table: workflow.attrTable,
          column: workflow.attrColumn!,
          join: joinStatement,
          joinType,
        })
      }
    }
  }, [selectedTable, selectedColumn, workflow.phase, isActive])

  const reset = () => {
    setWorkflow({ phase: 'selection' })
    setJoinType('LEFT')
    prevSelectedRef.current = null
  }

  const getHighlightedTables = (): string[] => {
    if (workflow.phase === 'selection') {
      return [] // Highlight all available tables (handled by parent)
    } else if (workflow.phase === 'join-step-1') {
      return Array.from(existingTables) // Highlight existing tables
    } else if (workflow.phase === 'join-step-2') {
      return workflow.attrTable ? [workflow.attrTable] : [] // Highlight the new table
    }
    return []
  }

  return {
    workflow,
    joinType,
    setJoinType,
    needsJoin,
    reset,
    getHighlightedTables,
  }
}
