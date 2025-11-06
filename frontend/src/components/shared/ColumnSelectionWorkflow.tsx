'use client'

import { Database } from 'lucide-react'

interface ColumnSelectionWorkflowProps {
  phase: 'selection' | 'join-step-1' | 'join-step-2' | 'complete'
  selectedTable?: string
  selectedColumn?: string
  existingTables: Set<string>
  joinType: 'LEFT' | 'INNER' | 'RIGHT'
  onJoinTypeChange: (type: 'LEFT' | 'INNER' | 'RIGHT') => void
  onCancel: () => void
  joinWorkflowData?: {
    attrTable: string
    attrColumn: string
    existingTable?: string
    existingColumn?: string
  }
}

/**
 * Shared component for column selection workflow with join support.
 * Used in both "Add ID Attribute" (concepts) and "Add Attribute Reference" (attributes).
 */
export function ColumnSelectionWorkflow({
  phase,
  selectedTable,
  selectedColumn,
  existingTables,
  joinType,
  onJoinTypeChange,
  onCancel,
  joinWorkflowData,
}: ColumnSelectionWorkflowProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg bg-primary-50 dark:bg-primary-900/10">
      <Database className="w-12 h-12 text-primary-500 mb-3" />
      
      {phase === 'selection' ? (
        /* Initial selection: Click on any column */
        <>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Select a column from the database viewer
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-3">
            Click on any column in the left panel to set it as the reference
          </p>
        </>
      ) : phase === 'join-step-1' ? (
        /* Step 1: Select column in existing table */
        <>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Join Required - Step 1 of 2
          </p>
          {joinWorkflowData && (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-2">
                Selected: <span className="font-mono font-semibold">
                  {joinWorkflowData.attrTable}.{joinWorkflowData.attrColumn}
                </span>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-3">
                Now select a column from an <span className="font-semibold">existing table</span>{' '}
                ({Array.from(existingTables).join(', ')}) to join with
              </p>
            </>
          )}
          
          {/* Join Type Selection */}
          <div className="flex gap-2 mb-3">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                checked={joinType === 'LEFT'}
                onChange={() => onJoinTypeChange('LEFT')}
                className="text-primary-500 cursor-pointer"
              />
              <span className="text-gray-700 dark:text-gray-300">LEFT JOIN</span>
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                checked={joinType === 'INNER'}
                onChange={() => onJoinTypeChange('INNER')}
                className="text-primary-500 cursor-pointer"
              />
              <span className="text-gray-700 dark:text-gray-300">INNER JOIN</span>
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                checked={joinType === 'RIGHT'}
                onChange={() => onJoinTypeChange('RIGHT')}
                className="text-primary-500 cursor-pointer"
              />
              <span className="text-gray-700 dark:text-gray-300">RIGHT JOIN</span>
            </label>
          </div>
        </>
      ) : phase === 'join-step-2' ? (
        /* Step 2: Select column in new table */
        <>
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Join Required - Step 2 of 2
          </p>
          {joinWorkflowData && (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-2">
                Existing table column: <span className="font-mono font-semibold">
                  {joinWorkflowData.existingTable}.{joinWorkflowData.existingColumn}
                </span>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-3">
                Now select the matching column in{' '}
                <span className="font-mono font-semibold">{joinWorkflowData.attrTable}</span>
              </p>
            </>
          )}
        </>
      ) : null}

      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
