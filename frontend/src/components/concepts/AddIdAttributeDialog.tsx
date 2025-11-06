'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ColumnSelectionWorkflow } from '@/components/shared/ColumnSelectionWorkflow';
import { useJoinWorkflow } from '@/hooks/useJoinWorkflow';
import type { DatabaseSchema, Concept, ConceptAttribute } from '@/lib/types';

interface AddIdAttributeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (attribute: ConceptAttribute, join?: string) => void;
  concept: Concept;
  schema: DatabaseSchema;
  clusterTables: string[];
  onTableHighlight?: (tables: string[]) => void;
  selectedTable?: string | null;
  selectedColumn?: string | null;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
  inline?: boolean;
}

export function AddIdAttributeDialog({
  isOpen,
  onClose,
  onSave,
  concept,
  schema,
  clusterTables,
  onTableHighlight,
  selectedTable,
  selectedColumn,
  onTableClick,
  onColumnClick,
  inline = false,
}: AddIdAttributeDialogProps) {
  // Calculate existing tables with ID attributes
  const existingTables = new Set<string>();
  if (concept.idAttributes) {
    concept.idAttributes.forEach(idAttr => {
      if (idAttr.attributes) {
        idAttr.attributes.forEach(attr => {
          existingTables.add(attr.table);
        });
      }
    });
  }

  // Calculate tables already in joins
  if (concept.joins) {
    concept.joins.forEach(join => {
      const tableMatches = join.match(/(?:FROM|JOIN)\s+(\w+)/gi);
      if (tableMatches) {
        tableMatches.forEach(match => {
          const tableName = match.replace(/(?:FROM|JOIN)\s+/i, '').trim();
          if (tableName) existingTables.add(tableName);
        });
      }
    });
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
    selectedTable,
    selectedColumn,
    isActive: isOpen,
    onComplete: (result) => {
      const attribute: ConceptAttribute = {
        table: result.table,
        column: result.column,
      };
      onSave(attribute, result.join);
      handleClose();
    },
  });

  // Highlight tables based on workflow phase
  useEffect(() => {
    if (!isOpen || !onTableHighlight) return;

    if (joinWorkflow.phase === 'selection') {
      // Highlight all cluster tables for ID selection
      onTableHighlight(clusterTables);
    } else {
      const tablesToHighlight = getHighlightedTables();
      if (tablesToHighlight.length > 0) {
        onTableHighlight(tablesToHighlight);
      }
    }
  }, [joinWorkflow.phase, isOpen]);

  const handleClose = () => {
    resetJoinWorkflow();
    onClose();
  };

  if (!isOpen) return null;

  const selectedTableMeta = selectedTable ? schema.tables.find(t => t.name === selectedTable) : null;

  const dialogContent = (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add ID Attribute</h2>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Info message */}
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
          <p className="text-sm text-primary-900 dark:text-primary-200">
            Click on a column in the database viewer to add it as an ID attribute.
          </p>
        </div>

        {/* Selected table display */}
        {selectedTable && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Selected Table: <span className="font-bold">{selectedTable}</span>
            </p>
          </div>
        )}

        {/* Column selection grid */}
        {selectedTableMeta && joinWorkflow.phase === 'selection' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Column:
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded p-2">
              {selectedTableMeta.columns.map(col => (
                <button
                  key={col.name}
                  onClick={() => selectedTable && onColumnClick?.(selectedTable, col.name)}
                  className={`text-left p-2 rounded text-sm transition-colors ${
                    selectedColumn === col.name
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="font-medium">{col.name}</div>
                  <div className="text-xs opacity-75">
                    {col.dataType}
                    {col.isPrimaryKey && ' • PK'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Join workflow UI */}
        {joinWorkflow.phase !== 'selection' && (
          <ColumnSelectionWorkflow
            phase={joinWorkflow.phase}
            selectedTable={selectedTable || undefined}
            selectedColumn={selectedColumn || undefined}
            existingTables={existingTables}
            joinType={joinType}
            onJoinTypeChange={setJoinType}
            onCancel={handleClose}
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
        )}
      </div>
    </>
  );

  if (inline) {
    return <div className="border border-primary-500 dark:border-primary-400 rounded-lg p-6 bg-white dark:bg-gray-800">{dialogContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="h-full flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto pointer-events-auto border-4 border-primary-500 dark:border-primary-400">
          {dialogContent}
        </div>
      </div>
    </div>
  );
}
