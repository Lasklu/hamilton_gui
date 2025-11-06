'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Wrench, ChevronDown, X, Database } from 'lucide-react'
import { AddConditionDialog } from '@/components/concepts/AddConditionDialog'
import { ColumnSelectionWorkflow } from '@/components/shared/ColumnSelectionWorkflow'
import { useJoinWorkflow } from '@/hooks/useJoinWorkflow'
import type { Concept, Attribute, DatabaseSchema } from '@/lib/types'

interface AttributeSuggestionViewProps {
  concept: Concept
  attributes: Attribute[]
  schema: DatabaseSchema
  onAttributesUpdate: (attributes: Attribute[]) => void
  onConfirm: () => void
  selectedColumn?: { table: string; column: string } | null
  onColumnClickHandled?: () => void
  onRequestColumnSelection?: () => void
  onCancelColumnSelection?: () => void
  onTableHighlight?: (tables: string[]) => void
  onColumnClick?: (tableName: string, columnName: string) => void
  selectedTable?: string | null
}

export function AttributeSuggestionView({
  concept,
  attributes,
  schema,
  onAttributesUpdate,
  onConfirm,
  selectedColumn,
  onColumnClickHandled,
  onRequestColumnSelection,
  onCancelColumnSelection,
  onTableHighlight,
  onColumnClick,
  selectedTable
}: AttributeSuggestionViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [conditionsDialogOpen, setConditionsDialogOpen] = useState<string | null>(null)
  const [conditionMenuOpen, setConditionMenuOpen] = useState<string | null>(null)
  const [addingAttributeReferenceForId, setAddingAttributeReferenceForId] = useState<string | null>(null)
  const [editingStaticValueForId, setEditingStaticValueForId] = useState<string | null>(null)
  const [staticValue, setStaticValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Calculate existing tables from concept's ID attributes
  const existingTables = new Set<string>()
  if (concept.idAttributes) {
    concept.idAttributes.forEach(idAttr => {
      idAttr.attributes?.forEach(attr => {
        existingTables.add(attr.table)
      })
    })
  }

  // Calculate tables already in joins
  if (concept.joins) {
    concept.joins.forEach(join => {
      const tableMatches = join.match(/(?:FROM|JOIN)\s+(\w+)/gi)
      if (tableMatches) {
        tableMatches.forEach(match => {
          const tableName = match.replace(/(?:FROM|JOIN)\s+/i, '').trim()
          if (tableName) existingTables.add(tableName)
        })
      }
    })
  }

  // Use shared join workflow hook
  const {
    workflow: joinWorkflow,
    joinType,
    setJoinType,
    needsJoin,
    reset: resetJoinWorkflow,
    getHighlightedTables,
  } = useJoinWorkflow({
    existingTables,
    selectedTable: selectedColumn?.table,
    selectedColumn: selectedColumn?.column,
    isActive: addingAttributeReferenceForId !== null,
    onComplete: (result) => {
      if (!addingAttributeReferenceForId) return

      // Update the attribute with the selected reference
      const updatedAttrs = attributes.map(attr =>
        attr.id === addingAttributeReferenceForId
          ? {
              ...attr,
              table: result.table,
              column: result.column,
              staticValue: '', // Clear static value when setting reference
              dataType: schema.tables
                .find(t => t.name === result.table)
                ?.columns.find(col => col.name === result.column)
                ?.dataType || attr.dataType,
              joins: result.join
                ? [...(attr.joins || []), result.join]
                : attr.joins,
            }
          : attr
      )

      onAttributesUpdate(updatedAttrs)
      setAddingAttributeReferenceForId(null)
      resetJoinWorkflow()
      onCancelColumnSelection?.()
      onColumnClickHandled?.()
    },
  })

  // Highlight tables based on workflow phase
  useEffect(() => {
    if (!addingAttributeReferenceForId || !onTableHighlight) return

    const tablesToHighlight = getHighlightedTables()
    if (tablesToHighlight.length > 0) {
      onTableHighlight(tablesToHighlight)
    }
  }, [joinWorkflow.phase, addingAttributeReferenceForId])

  // Clean up highlighting when concept changes or component unmounts
  useEffect(() => {
    return () => {
      if (onTableHighlight) onTableHighlight([])
    }
  }, [concept.id])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setConditionMenuOpen(null)
      }
    }

    if (conditionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [conditionMenuOpen])

  const handleAddAttribute = (table: string, column: string) => {
    const tableData = schema.tables.find((t) => t.name === table)
    const columnData = tableData?.columns.find((col) => col.name === column)

    const newAttribute: Attribute = {
      id: `attr-${Date.now()}`,
      name: column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      column: column,
      table: table,
      dataType: columnData?.dataType || 'VARCHAR',
      isRequired: false
    }

    onAttributesUpdate([...attributes, newAttribute])
  }

  const handleRemoveAttribute = (id: string) => {
    onAttributesUpdate(attributes.filter(attr => attr.id !== id))
    
    // Clean up state if this attribute was being edited
    if (addingAttributeReferenceForId === id) {
      setAddingAttributeReferenceForId(null)
      resetJoinWorkflow()
      if (onTableHighlight) onTableHighlight([])
    }
    if (editingStaticValueForId === id) {
      setEditingStaticValueForId(null)
    }
    if (conditionsDialogOpen === id) {
      setConditionsDialogOpen(null)
      if (onTableHighlight) onTableHighlight([])
    }
  }

  const handleStartEdit = (attr: Attribute) => {
    setEditingId(attr.id)
    setEditName(attr.name)
  }

  const handleSaveName = (id: string) => {
    onAttributesUpdate(
      attributes.map(attr =>
        attr.id === id ? { ...attr, name: editName.trim() || attr.name } : attr
      )
    )
    setEditingId(null)
    setEditName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleToggleConditionMenu = (attributeId: string) => {
    setConditionMenuOpen(conditionMenuOpen === attributeId ? null : attributeId)
  }

  const handleAddCondition = (attributeId: string) => {
    setConditionMenuOpen(null)
    setConditionsDialogOpen(attributeId)
  }

  const handleConditionSave = (conditionText: string, join?: string) => {
    if (conditionsDialogOpen) {
      onAttributesUpdate(
        attributes.map(attr =>
          attr.id === conditionsDialogOpen
            ? { 
                ...attr, 
                conditions: [...(attr.conditions || []), conditionText],
                joins: join ? [...(attr.joins || []), join] : attr.joins
              }
            : attr
        )
      )
    }
    setConditionsDialogOpen(null)
  }

  const handleRemoveCondition = (attributeId: string, conditionIndex: number) => {
    onAttributesUpdate(
      attributes.map(attr =>
        attr.id === attributeId
          ? {
              ...attr,
              conditions: attr.conditions?.filter((_, idx) => idx !== conditionIndex)
            }
          : attr
      )
    )
  }

  const handleStartAddingAttributeReference = (attributeId: string) => {
    setConditionMenuOpen(null)
    setAddingAttributeReferenceForId(attributeId)
    onRequestColumnSelection?.()
  }

  const handleCancelAddingAttributeReference = () => {
    setAddingAttributeReferenceForId(null)
    resetJoinWorkflow()
    if (onTableHighlight) onTableHighlight([])
    onCancelColumnSelection?.()
  }

  const handleStartEditingStaticValue = (attributeId: string) => {
    setConditionMenuOpen(null)
    const attr = attributes.find(a => a.id === attributeId)
    setStaticValue(attr?.staticValue || '')
    setEditingStaticValueForId(attributeId)
  }

  const handleSaveStaticValue = () => {
    if (editingStaticValueForId) {
      onAttributesUpdate(
        attributes.map(attr =>
          attr.id === editingStaticValueForId
            ? { ...attr, staticValue: staticValue.trim(), table: '', column: '' }
            : attr
        )
      )
    }
    setEditingStaticValueForId(null)
    setStaticValue('')
  }

  const handleCancelStaticValue = () => {
    setEditingStaticValueForId(null)
    setStaticValue('')
  }

  const handleCreateAttribute = () => {
    // Create an empty attribute that needs to be configured
    const newAttribute: Attribute = {
      id: `attr-${Date.now()}`,
      name: 'New Attribute',
      column: '',
      table: '',
      dataType: 'VARCHAR',
      isRequired: false
    }
    onAttributesUpdate([...attributes, newAttribute])
    setEditingId(newAttribute.id)
    setEditName(newAttribute.name)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {concept.name || concept.id}
            </h3>
            {concept.idAttributes && concept.idAttributes.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ID: {concept.idAttributes[0].attributes?.map(attr => 
                  `${attr.table}.${attr.column}`
                ).join(', ')}
              </div>
            )}
          </div>
          <button
            onClick={handleCreateAttribute}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Attribute
          </button>
        </div>

        {/* Concept info */}
        {concept.conditions && concept.conditions.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conditions:
            </p>
            <div className="space-y-1">
              {concept.conditions.map((condition, idx) => (
                <p key={idx} className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  {condition}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attributes list */}
      <div className="flex-1 overflow-y-auto p-6">
        {attributes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No attributes defined yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Click on columns in the database viewer or use the "New Attribute" button
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {attributes.map((attr) => (
              <div
                key={attr.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
              >
                {/* Attribute header */}
                <div className="flex items-start justify-between mb-3">
                  {editingId === attr.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(attr.id)
                          if (e.key === 'Escape') handleCancelEdit()
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveName(attr.id)}
                        className="px-2 py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {attr.name}
                      </h4>
                      <button
                        onClick={() => handleStartEdit(attr)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit name"
                      >
                        <Pencil className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => handleToggleConditionMenu(attr.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Add conditions"
                        >
                          <Wrench className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                        </button>
                        {conditionMenuOpen === attr.id && (
                          <div 
                            ref={dropdownRef}
                            className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[220px]"
                          >
                            <button
                              onClick={() => handleAddCondition(attr.id)}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                            >
                              <Plus className="w-4 h-4" />
                              Add Condition
                            </button>
                            <button
                              onClick={() => {
                                if (!attr.table || attr.table === '' || !attr.column || attr.column === '') {
                                  handleStartAddingAttributeReference(attr.id)
                                }
                              }}
                              disabled={!!(attr.table && attr.table !== '' && attr.column && attr.column !== '') || !!attr.staticValue}
                              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 ${
                                (attr.table && attr.table !== '' && attr.column && attr.column !== '') || attr.staticValue
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              title={
                                attr.staticValue
                                  ? 'Remove static value first to add an attribute reference.'
                                  : (attr.table && attr.table !== '' && attr.column && attr.column !== '')
                                  ? 'Attribute reference already exists. Remove it first to add a new one.'
                                  : 'Add a reference to a database column'
                              }
                            >
                              <Database className="w-4 h-4" />
                              Add Attribute Reference
                            </button>
                            <button
                              onClick={() => {
                                if (!attr.staticValue && (!attr.table || attr.table === '')) {
                                  handleStartEditingStaticValue(attr.id)
                                }
                              }}
                              disabled={!!attr.staticValue || !!(attr.table && attr.table !== '')}
                              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                attr.staticValue || (attr.table && attr.table !== '')
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                              title={
                                (attr.table && attr.table !== '')
                                  ? 'Remove attribute reference first to add a static value.'
                                  : attr.staticValue
                                  ? 'Static value already set. Edit it instead.'
                                  : 'Set a static value instead of a database reference'
                              }
                            >
                              <Pencil className="w-4 h-4" />
                              Add Static Value
                            </button>
                          </div>
                        )}
                      </div>
                      {attr.conditions && attr.conditions.length > 0 && (
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded font-medium">
                          {attr.conditions.length} condition{attr.conditions.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveAttribute(attr.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove attribute"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>

                {/* Show attribute details or dialogs */}
                {conditionsDialogOpen === attr.id ? (
                  /* Show AddConditionDialog inline */
                  <AddConditionDialog
                    isOpen={true}
                    schema={schema}
                    concept={concept}
                    inline={true}
                    onSave={(conditionText, join) => {
                      handleConditionSave(conditionText, join)
                    }}
                    onClose={() => setConditionsDialogOpen(null)}
                    onTableHighlight={onTableHighlight}
                    onColumnClick={onColumnClick}
                    selectedTable={selectedColumn?.table}
                    selectedColumn={selectedColumn?.column}
                  />
                ) : editingStaticValueForId === attr.id ? (
                  /* Show static value editor inline */
                  <div className="flex flex-col gap-2 p-6 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                    <label className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Static Value
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      Enter a static value for this attribute. This will be used instead of a database column reference.
                    </p>
                    <input
                      type="text"
                      value={staticValue}
                      onChange={(e) => setStaticValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveStaticValue()
                        if (e.key === 'Escape') handleCancelStaticValue()
                      }}
                      placeholder="Enter static value..."
                      className="px-3 py-2 text-sm border border-orange-300 dark:border-orange-700 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleSaveStaticValue}
                        className="flex-1 px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                      >
                        Save Static Value
                      </button>
                      <button
                        onClick={handleCancelStaticValue}
                        className="flex-1 px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal attribute details */
                  <div className="space-y-3">
                  {/* Source attribute */}
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Source Attribute
                    </h5>
                    {addingAttributeReferenceForId === attr.id ? (
                      <ColumnSelectionWorkflow
                        phase={joinWorkflow.phase}
                        selectedTable={selectedColumn?.table}
                        selectedColumn={selectedColumn?.column}
                        existingTables={existingTables}
                        joinType={joinType}
                        onJoinTypeChange={setJoinType}
                        onCancel={handleCancelAddingAttributeReference}
                        joinWorkflowData={
                          joinWorkflow.attrTable
                            ? {
                                attrTable: joinWorkflow.attrTable,
                                attrColumn: joinWorkflow.attrColumn!,
                                existingTable: joinWorkflow.existingTable,
                                existingColumn: joinWorkflow.existingColumn,
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {attr.staticValue ? (
                          /* Show static value */
                          <div className="group/badge relative">
                            <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 rounded font-mono text-xs">
                              <span className="font-semibold">Static:</span>
                              <span>{attr.staticValue}</span>
                              <button
                                onClick={() => {
                                  // Clear the static value
                                  onAttributesUpdate(
                                    attributes.map(a =>
                                      a.id === attr.id
                                        ? { ...a, staticValue: undefined }
                                        : a
                                    )
                                  )
                                }}
                                className="ml-2 p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800 rounded opacity-0 group-hover/badge:opacity-100 transition-opacity"
                                title="Remove static value"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleStartEditingStaticValue(attr.id)}
                                className="ml-1 p-0.5 hover:bg-orange-200 dark:hover:bg-orange-800 rounded opacity-0 group-hover/badge:opacity-100 transition-opacity"
                                title="Edit static value"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : attr.table && attr.column ? (
                          /* Show database reference */
                          <>
                            <div className="group/badge relative">
                              <div className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 border border-primary-200 dark:border-primary-800 rounded font-mono text-xs">
                                <span className="font-semibold">{attr.table}</span>
                                <span className="text-primary-400">.</span>
                                <span>{attr.column}</span>
                                <button
                                  onClick={() => {
                                    // Clear the table and column to allow re-selection
                                    onAttributesUpdate(
                                      attributes.map(a =>
                                        a.id === attr.id
                                          ? { ...a, table: '', column: '' }
                                          : a
                                      )
                                    )
                                  }}
                                  className="ml-2 p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded opacity-0 group-hover/badge:opacity-100 transition-opacity"
                                  title="Remove reference"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded font-mono">
                              {attr.dataType}
                            </span>
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                            No reference or value set - use the wrench icon to add one
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Show conditions if any */}
                  {attr.conditions && attr.conditions.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Conditions
                      </h5>
                      <div className="space-y-1.5">
                        {attr.conditions.map((condition, idx) => (
                          <div 
                            key={idx}
                            className="group/condition flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded"
                          >
                            <p className="flex-1 text-xs font-mono text-purple-900 dark:text-purple-100">
                              {condition}
                            </p>
                            <button
                              onClick={() => handleRemoveCondition(attr.id, idx)}
                              className="p-0.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded opacity-0 group-hover/condition:opacity-100 transition-opacity"
                              title="Remove condition"
                            >
                              <X className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show joins if any */}
                  {attr.joins && attr.joins.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Joins
                      </h5>
                      <div className="space-y-1.5">
                        {attr.joins.map((join, idx) => (
                          <div 
                            key={idx}
                            className="group/join flex items-start gap-2 p-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded"
                          >
                            <p className="flex-1 text-xs font-mono text-teal-900 dark:text-teal-100">
                              {join}
                            </p>
                            <button
                              onClick={() => {
                                onAttributesUpdate(
                                  attributes.map(a =>
                                    a.id === attr.id
                                      ? { ...a, joins: a.joins?.filter((_, i) => i !== idx) }
                                      : a
                                  )
                                )
                              }}
                              className="p-0.5 hover:bg-teal-200 dark:hover:bg-teal-800 rounded opacity-0 group-hover/join:opacity-100 transition-opacity"
                              title="Remove join"
                            >
                              <X className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with confirm button */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onConfirm}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          Confirm Attributes for This Concept
        </button>
      </div>
    </div>
  )
}
