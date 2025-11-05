'use client';

import { useState } from 'react';
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, Wrench, X } from 'lucide-react';
import { AddIdAttributeDialog } from './AddIdAttributeDialog';
import { AddConditionDialog } from './AddConditionDialog';
import type { Concept, DatabaseSchema, ConceptAttribute, ConceptIDAttribute } from '@/lib/types';

interface ConceptSuggestionViewProps {
  concepts: Concept[];
  schema: DatabaseSchema;
  onConceptHover?: (conceptId: string | null) => void;
  onConceptUpdate?: (conceptId: string, updates: Partial<Concept>) => void;
  onConceptDelete?: (conceptId: string) => void;
  onConceptCreate?: () => void;
  onTableHighlight?: (tables: string[]) => void;
  onDialogOpen?: () => void;
  onDialogClose?: () => void;
  selectedTable?: string | null;
  selectedColumn?: string | null;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
  className?: string;
}

export function ConceptSuggestionView({ 
  concepts,
  schema,
  onConceptHover,
  onConceptUpdate,
  onConceptDelete,
  onConceptCreate,
  onTableHighlight,
  onDialogOpen,
  onDialogClose,
  selectedTable,
  selectedColumn,
  onTableClick,
  onColumnClick,
  className = '' 
}: ConceptSuggestionViewProps) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [addIdDialogOpen, setAddIdDialogOpen] = useState<string | null>(null);
  const [addConditionDialogOpen, setAddConditionDialogOpen] = useState<string | null>(null);

  // Sort concepts by confidence (highest first)
  const sortedConcepts = [...concepts].sort((a, b) => 
    (b.confidence || 0) - (a.confidence || 0)
  );

  const handleStartEdit = (concept: Concept) => {
    setEditingName(concept.id);
    setEditNameValue(concept.name || '');
  };

  const handleSaveName = (conceptId: string) => {
    if (onConceptUpdate) {
      onConceptUpdate(conceptId, { name: editNameValue });
    }
    setEditingName(null);
  };

  const handleCancelEdit = () => {
    setEditingName(null);
    setEditNameValue('');
  };

  const toggleExpanded = (conceptId: string) => {
    const newExpanded = new Set(expandedConcepts);
    if (newExpanded.has(conceptId)) {
      newExpanded.delete(conceptId);
    } else {
      newExpanded.add(conceptId);
    }
    setExpandedConcepts(newExpanded);
  };

  const toggleMenu = (conceptId: string) => {
    setMenuOpen(menuOpen === conceptId ? null : conceptId);
  };

  const handleAddIdAttribute = (conceptId: string, attribute: ConceptAttribute, join?: string) => {
    const concept = findConceptById(conceptId);
    if (!concept || !onConceptUpdate) return;

    // Add to first ID attribute group, or create new one
    const updatedIdAttributes = [...(concept.idAttributes || [])];
    if (updatedIdAttributes.length === 0) {
      updatedIdAttributes.push({
        attributes: [attribute]
      });
    } else {
      updatedIdAttributes[0].attributes = [
        ...(updatedIdAttributes[0].attributes || []),
        attribute
      ];
    }

    // Add join if provided and not already present
    const existingJoins = concept.joins || [];
    const updatedJoins = join && !existingJoins.includes(join)
      ? [...existingJoins, join]
      : existingJoins;

    const updates: Partial<Concept> = {
      idAttributes: updatedIdAttributes
    };
    
    // Only update joins if they changed
    if (updatedJoins !== existingJoins) {
      updates.joins = updatedJoins.length > 0 ? updatedJoins : undefined;
    }

    onConceptUpdate(conceptId, updates);
  };

  const handleRemoveIdAttribute = (conceptId: string, idAttrIndex: number, attrIndex: number) => {
    const concept = findConceptById(conceptId);
    if (!concept || !onConceptUpdate) return;

    const updatedIdAttributes = [...(concept.idAttributes || [])];
    if (updatedIdAttributes[idAttrIndex]) {
      const attrs = [...(updatedIdAttributes[idAttrIndex].attributes || [])];
      attrs.splice(attrIndex, 1);
      
      if (attrs.length === 0) {
        // Remove entire ID attribute group if empty
        updatedIdAttributes.splice(idAttrIndex, 1);
      } else {
        updatedIdAttributes[idAttrIndex] = {
          ...updatedIdAttributes[idAttrIndex],
          attributes: attrs
        };
      }
    }

    onConceptUpdate(conceptId, {
      idAttributes: updatedIdAttributes
    });
  };

  const handleAddCondition = (conceptId: string, condition: string, join?: string) => {
    const concept = findConceptById(conceptId);
    if (!concept || !onConceptUpdate) return;

    const updatedConditions = [...(concept.conditions || []), condition];
    const updates: Partial<Concept> = {
      conditions: updatedConditions
    };
    
    // Add join if provided and not already present
    if (join) {
      const existingJoins = concept.joins || [];
      if (!existingJoins.includes(join)) {
        updates.joins = [...existingJoins, join];
      }
    }
    
    onConceptUpdate(conceptId, updates);
  };

  const handleRemoveCondition = (conceptId: string, conditionIndex: number) => {
    const concept = findConceptById(conceptId);
    if (!concept || !onConceptUpdate) return;

    const updatedConditions = [...(concept.conditions || [])];
    updatedConditions.splice(conditionIndex, 1);
    onConceptUpdate(conceptId, {
      conditions: updatedConditions.length > 0 ? updatedConditions : undefined
    });
  };

  const findConceptById = (conceptId: string): Concept | null => {
    const findInList = (list: Concept[]): Concept | null => {
      for (const c of list) {
        if (c.id === conceptId) return c;
        if (c.subConcepts) {
          const found = findInList(c.subConcepts);
          if (found) return found;
        }
      }
      return null;
    };
    return findInList(concepts);
  };

  const renderConcept = (concept: Concept, depth: number = 0) => {
    const hasSubConcepts = concept.subConcepts && concept.subConcepts.length > 0;
    const isExpanded = expandedConcepts.has(concept.id);
    const isMenuOpen = menuOpen === concept.id;

    // Check if this concept is being edited with a dialog
    const isEditingWithDialog = addIdDialogOpen === concept.id || addConditionDialogOpen === concept.id;

    // If this concept is being edited, show the dialog inline instead of the concept
    if (isEditingWithDialog) {
      return (
        <div key={concept.id} style={{ marginLeft: `${depth * 20}px` }}>
          {addIdDialogOpen === concept.id && (
            <AddIdAttributeDialog
              isOpen={true}
              inline={true}
              onClose={() => {
                setAddIdDialogOpen(null);
                onDialogClose?.();
              }}
              onSave={(attribute, join) => {
                handleAddIdAttribute(concept.id, attribute, join);
                setAddIdDialogOpen(null);
                onDialogClose?.();
              }}
              concept={concept}
              schema={schema}
              clusterTables={Array.from(new Set(concepts.flatMap(c => [
                ...( c.idAttributes?.flatMap(idAttr => idAttr.attributes.map(attr => attr.table)) || []),
                ...(c.attributes?.map(attr => attr.table) || [])
              ])))}
              onTableHighlight={onTableHighlight}
              selectedTable={selectedTable}
              selectedColumn={selectedColumn}
              onTableClick={onTableClick}
              onColumnClick={onColumnClick}
            />
          )}
          {addConditionDialogOpen === concept.id && (
            <AddConditionDialog
              isOpen={true}
              inline={true}
              onClose={() => {
                setAddConditionDialogOpen(null);
                onDialogClose?.();
              }}
              onSave={(condition, join) => {
                handleAddCondition(concept.id, condition, join);
                setAddConditionDialogOpen(null);
                onDialogClose?.();
              }}
              concept={concept}
              schema={schema}
              onTableHighlight={onTableHighlight}
              onColumnClick={onColumnClick}
              selectedTable={selectedTable || undefined}
              selectedColumn={selectedColumn || undefined}
            />
          )}
        </div>
      );
    }

    return (
      <div key={concept.id} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors bg-white dark:bg-gray-800"
          onMouseEnter={() => onConceptHover?.(concept.id)}
          onMouseLeave={() => onConceptHover?.(null)}
        >
          {/* Concept Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 flex items-center gap-2">
              {/* Expand/Collapse for sub-concepts */}
              {hasSubConcepts && (
                <button
                  onClick={() => toggleExpanded(concept.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              )}

              {/* Concept Name */}
              <div className="flex-1">
                {editingName === concept.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(concept.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveName(concept.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
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
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                      {concept.name || 'Unnamed Concept'}
                    </h4>
                    <button
                      onClick={() => handleStartEdit(concept)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit name"
                    >
                      <Pencil className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    </button>
                    {concept.confidence !== undefined && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        concept.confidence > 0.8
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : concept.confidence > 0.6
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}>
                        {Math.round(concept.confidence * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Wrench Menu */}
                <div className="relative">
                  <button
                    onClick={() => toggleMenu(concept.id)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Actions"
                  >
                    <Wrench className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  {isMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                        <button
                          onClick={() => {
                            setAddIdDialogOpen(concept.id);
                            setMenuOpen(null);
                            onDialogOpen?.();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg"
                        >
                          + Add ID Attribute
                        </button>
                        <button
                          onClick={() => {
                            setAddConditionDialogOpen(concept.id);
                            setMenuOpen(null);
                            onDialogOpen?.();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          + Add Condition
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement add sub-concept
                            setMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          + Add Sub-Concept
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement add join
                            setMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          + Add Join
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700" />
                        <button
                          onClick={() => {
                            if (onConceptDelete) {
                              onConceptDelete(concept.id);
                            }
                            setMenuOpen(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 last:rounded-b-lg"
                        >
                          🗑️ Delete Concept
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Delete */}
                <button
                  onClick={() => onConceptDelete?.(concept.id)}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete concept"
                >
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          </div>

          {/* ID Attributes */}
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🔑 Identity Attributes
            </div>
            <div className="space-y-2">
              {concept.idAttributes?.map((idAttr, idIdx) => (
                <div
                  key={idIdx}
                  className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex flex-wrap gap-2">
                    {idAttr.attributes?.map((attr, attrIdx) => (
                      <span
                        key={attrIdx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded text-xs font-mono group"
                      >
                        <span className="font-semibold">{attr.table}</span>
                        <span className="text-blue-400 dark:text-blue-500">.</span>
                        <span>{attr.column}</span>
                        <button
                          onClick={() => handleRemoveIdAttribute(concept.id, idIdx, attrIdx)}
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 rounded p-0.5 transition-opacity"
                          title="Remove ID attribute"
                        >
                          <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                        </button>
                      </span>
                    )) || null}
                    {idAttr.attributes && idAttr.attributes.length > 1 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 self-center">
                        (Composite Key)
                      </span>
                    )}
                  </div>
                </div>
              )) || (
                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                  No ID attributes defined
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          {concept.conditions && concept.conditions.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔍 Conditions
              </div>
              <div className="space-y-1">
                {concept.conditions.map((condition, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 rounded-md px-2 py-1 border border-purple-200 dark:border-purple-800 group"
                  >
                    <code className="flex-1 text-xs font-mono text-purple-800 dark:text-purple-200">
                      {condition}
                    </code>
                    <button
                      onClick={() => handleRemoveCondition(concept.id, idx)}
                      className="opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 rounded p-0.5 transition-opacity"
                      title="Remove condition"
                    >
                      <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Joins */}
          {concept.joins && concept.joins.length > 0 && (
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🔗 Joins
              </div>
              <div className="space-y-1">
                {concept.joins.map((join, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 rounded-md px-2 py-1 border border-teal-200 dark:border-teal-800 group"
                  >
                    <code className="flex-1 text-xs font-mono text-teal-800 dark:text-teal-200">
                      {join}
                    </code>
                    <button
                      onClick={() => {
                        const updatedJoins = [...(concept.joins || [])];
                        updatedJoins.splice(idx, 1);
                        onConceptUpdate?.(concept.id, {
                          joins: updatedJoins.length > 0 ? updatedJoins : undefined
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/40 rounded p-0.5 transition-opacity"
                      title="Remove join"
                    >
                      <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sub-concepts */}
        {hasSubConcepts && isExpanded && (
          <div className="mt-2 space-y-2 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
            {concept.subConcepts!.map(subConcept => renderConcept(subConcept, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Suggested Concepts ({concepts.length})
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and edit the suggested concepts for this cluster
          </p>
        </div>
        <button
          onClick={onConceptCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Concept
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {sortedConcepts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No concepts suggested for this cluster
            </p>
            <button
              onClick={onConceptCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create First Concept
            </button>
          </div>
        ) : (
          sortedConcepts.map(concept => (
            <div key={concept.id} className="group">
              {renderConcept(concept)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
