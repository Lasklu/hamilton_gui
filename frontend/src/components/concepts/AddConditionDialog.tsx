'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ColumnSelectionWorkflow } from '@/components/shared/ColumnSelectionWorkflow';
import { useJoinWorkflow } from '@/hooks/useJoinWorkflow';
import type { DatabaseSchema, TableMetadata, Concept } from '@/lib/types';

interface AddConditionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (condition: string, join?: string) => void;
  concept: Concept;
  schema: DatabaseSchema;
  onTableHighlight?: (tables: string[]) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
  selectedTable?: string;
  selectedColumn?: string;
  inline?: boolean;
}

export function AddConditionDialog({
  isOpen,
  onClose,
  onSave,
  concept,
  schema,
  onTableHighlight,
  onColumnClick,
  selectedTable: propSelectedTable,
  selectedColumn: propSelectedColumn,
  inline = false,
}: AddConditionDialogProps) {
  const [operator, setOperator] = useState<string>('=');
  const [value, setValue] = useState<string>('');
  const [useNull, setUseNull] = useState(false);
  const [isSelectingColumn, setIsSelectingColumn] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [lastPropValues, setLastPropValues] = useState<{table?: string, column?: string}>({});
  
  // Track the selected column for the condition
  const [conditionColumn, setConditionColumn] = useState<{
    table: string;
    column: string;
    join?: string;
  } | null>(null);

  // Get accessible tables (tables with ID attributes or in joins)
  const existingTables = new Set<string>();
  concept.idAttributes?.forEach(idAttr => {
    idAttr.attributes?.forEach(attr => {
      if (attr.table) existingTables.add(attr.table);
    });
  });
  
  // Get tables already in joins
  concept.joins?.forEach(joinStr => {
    const tableMatches = joinStr.match(/(?:FROM|JOIN)\s+(\w+)/gi);
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableName = match.replace(/(?:FROM|JOIN)\s+/i, '').trim();
        if (tableName) existingTables.add(tableName);
      });
    }
  });

  // Use the shared join workflow hook
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
    isActive: isSelectingColumn,
    onComplete: (result) => {
      setConditionColumn(result);
      setIsSelectingColumn(false);
      setSelectedTable(null);
      setSelectedColumn(null);
    },
  });

  // Automatically start column selection when dialog opens (if no column selected yet)
  useEffect(() => {
    if (isOpen && !conditionColumn && !isSelectingColumn) {
      setIsSelectingColumn(true);
      // Reset last prop values when dialog opens
      setLastPropValues({});
    }
  }, [isOpen, conditionColumn, isSelectingColumn]);

  // Highlight tables based on workflow phase
  useEffect(() => {
    if (!isOpen || !onTableHighlight) return;

    if (isSelectingColumn) {
      if (joinWorkflow.phase === 'selection') {
        // Highlight all tables for initial selection
        onTableHighlight(schema.tables.map(t => t.name));
      } else {
        const tablesToHighlight = getHighlightedTables();
        if (tablesToHighlight.length > 0) {
          onTableHighlight(tablesToHighlight);
        }
      }
    } else {
      // Not selecting, clear highlights
      onTableHighlight([]);
    }
  }, [joinWorkflow.phase, isSelectingColumn, isOpen]);

  // Handle incoming column clicks from props - only when values actually change
  useEffect(() => {
    if (!isOpen || !propSelectedTable || !propSelectedColumn) return;
    if (!isSelectingColumn) return;

    // Only update if the prop values have actually changed (new click)
    if (propSelectedTable !== lastPropValues.table || propSelectedColumn !== lastPropValues.column) {
      setSelectedTable(propSelectedTable);
      setSelectedColumn(propSelectedColumn);
      setLastPropValues({ table: propSelectedTable, column: propSelectedColumn });
    }
  }, [propSelectedTable, propSelectedColumn, isOpen, isSelectingColumn]);

  const handleStartColumnSelection = () => {
    setConditionColumn(null);
    setSelectedTable(null);
    setSelectedColumn(null);
    setIsSelectingColumn(true);
    resetJoinWorkflow();
  };

  const handleCancelColumnSelection = () => {
    setIsSelectingColumn(false);
    resetJoinWorkflow();
  };
  const handleOperatorChange = (op: string) => {
    setOperator(op);
    if (op === 'IS NULL' || op === 'IS NOT NULL') {
      setUseNull(true);
      setValue('');
    } else {
      setUseNull(false);
    }
  };

  const handleSave = () => {
    if (!conditionColumn || !operator) return;
    if (!useNull && !value.trim()) return;
    
    let condition: string;
    if (useNull) {
      condition = `${conditionColumn.table}.${conditionColumn.column} ${operator}`;
    } else {
      // Auto-quote string values
      const quotedValue = isNaN(Number(value)) && !value.startsWith("'") 
        ? `'${value.replace(/'/g, "''")}'` 
        : value;
      condition = `${conditionColumn.table}.${conditionColumn.column} ${operator} ${quotedValue}`;
    }
    
    onSave(condition, conditionColumn.join);
    handleClose();
  };

  const handleClose = () => {
    setIsSelectingColumn(false);
    setConditionColumn(null);
    setOperator('=');
    setValue('');
    setUseNull(false);
    setSelectedTable(null);
    setSelectedColumn(null);
    resetJoinWorkflow();
    if (onTableHighlight) onTableHighlight([]);
    onClose();
  };

  const operators = [
    '=',
    '!=',
    '<>',
    '>',
    '>=',
    '<',
    '<=',
    'LIKE',
    'NOT LIKE',
    'IN',
    'NOT IN',
    'IS NULL',
    'IS NOT NULL',
  ];

  const dialogContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Add Condition
        </h3>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Column Selection Workflow */}
        {isSelectingColumn ? (
          <ColumnSelectionWorkflow
            phase={joinWorkflow.phase}
            selectedTable={selectedTable || undefined}
            selectedColumn={selectedColumn || undefined}
            existingTables={existingTables}
            joinType={joinType}
            onJoinTypeChange={setJoinType}
            onCancel={handleCancelColumnSelection}
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
        ) : conditionColumn ? (
          <>
            {/* Info */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <p className="text-sm text-purple-900 dark:text-purple-200">
                Selected column: <span className="font-semibold">{conditionColumn.table}.{conditionColumn.column}</span>
                {conditionColumn.join && (
                  <>
                    <br />
                    Join: <span className="font-mono text-xs">{conditionColumn.join}</span>
                  </>
                )}
              </p>
              <button
                onClick={handleStartColumnSelection}
                className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 underline"
              >
                Change column
              </button>
            </div>

            {/* Select Operator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operator
              </label>
              <select
                value={operator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {operators.map(op => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Enter Value */}
            {!useNull && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Value
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {operator === 'IN' || operator === 'NOT IN' 
                    ? 'Use comma-separated values for IN/NOT IN (e.g., 1, 2, 3)' 
                    : operator === 'LIKE' || operator === 'NOT LIKE'
                    ? 'Use % as wildcard (e.g., %search%)'
                    : 'Enter value...'}
                </div>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={
                    operator === 'IN' || operator === 'NOT IN' 
                      ? 'value1, value2, value3' 
                      : operator === 'LIKE' || operator === 'NOT LIKE'
                      ? '%value%'
                      : 'Enter value...'
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Condition Preview */}
            {(useNull || value.trim()) && (
              <div className="mt-4 p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Condition Preview:</div>
                <code className="text-sm text-purple-900 dark:text-purple-200 font-mono">
                  {conditionColumn.table}.{conditionColumn.column} {operator}
                  {!useNull && (
                    <> {isNaN(Number(value)) && !value.startsWith("'") ? `'${value}'` : value}</>
                  )}
                </code>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Footer */}
      {!isSelectingColumn && conditionColumn && (
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!operator || (!useNull && !value.trim())}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Add Condition
          </button>
        </div>
      )}
    </>
  );

  if (inline) {
    return <div className="border border-primary-500 dark:border-primary-400 rounded-lg overflow-hidden flex flex-col bg-white dark:bg-gray-900">{dialogContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="h-full flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto border-4 border-primary-500">
          {dialogContent}
        </div>
      </div>
    </div>
  );
}
