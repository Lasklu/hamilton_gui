'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
  inline?: boolean; // If true, renders inline instead of as a fixed overlay
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
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [operator, setOperator] = useState<string>('=');
  const [value, setValue] = useState<string>('');
  const [useNull, setUseNull] = useState(false);
  
  // Join configuration state
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinType, setJoinType] = useState<'INNER' | 'LEFT' | 'RIGHT'>('LEFT');
  const [joinFromTable, setJoinFromTable] = useState<string>('');
  const [joinFromColumn, setJoinFromColumn] = useState<string>('');
  const [joinToColumn, setJoinToColumn] = useState<string>('');
  const [joinStep, setJoinStep] = useState<'select-new-column' | 'select-existing-column' | 'complete'>('select-new-column');

  // Get accessible tables (tables with ID attributes or in joins)
  const accessibleTables = new Set<string>();
  concept.idAttributes?.forEach(idAttr => {
    idAttr.attributes?.forEach(attr => {
      if (attr.table) accessibleTables.add(attr.table);
    });
  });
  
  // Get tables already in joins
  const joinedTables = new Set<string>();
  concept.joins?.forEach(joinStr => {
    const tableMatches = joinStr.match(/(?:FROM|JOIN)\s+(\w+)/gi);
    if (tableMatches) {
      tableMatches.forEach(match => {
        const tableName = match.split(/\s+/)[1];
        if (tableName) {
          accessibleTables.add(tableName);
          joinedTables.add(tableName);
        }
      });
    }
  });
  
  // Process incoming column clicks from parent
  useEffect(() => {
    if (propSelectedColumn && propSelectedTable && isOpen) {
      if (needsJoin) {
        handleJoinColumnClick(propSelectedTable, propSelectedColumn);
      } else {
        setSelectedTable(propSelectedTable);
        setSelectedColumn(propSelectedColumn);
      }
    }
  }, [propSelectedColumn, propSelectedTable, isOpen, needsJoin]);
  
  // Detect if a join is needed when table is selected
  useEffect(() => {
    if (selectedTable && !accessibleTables.has(selectedTable)) {
      setNeedsJoin(true);
      setJoinStep('select-new-column');
    } else {
      setNeedsJoin(false);
      setJoinFromTable('');
      setJoinFromColumn('');
      setJoinToColumn('');
      setJoinStep('select-new-column');
    }
  }, [selectedTable]);
  
  // Handle column click for join configuration
  const handleJoinColumnClick = (tableName: string, columnName: string) => {
    // Step 1: User clicks a column in the NEW table (the one being added)
    if (joinStep === 'select-new-column' && tableName === selectedTable) {
      setJoinToColumn(columnName);
      setJoinStep('select-existing-column');
    }
    // Step 2: User clicks a column in any EXISTING table with ID attributes
    else if (joinStep === 'select-existing-column' && accessibleTables.has(tableName)) {
      setJoinFromTable(tableName);
      setJoinFromColumn(columnName);
      setJoinStep('complete');
    }
  };
  
  // Reset join configuration
  const handleResetJoin = () => {
    setJoinFromTable('');
    setJoinFromColumn('');
    setJoinToColumn('');
    setJoinStep('select-new-column');
  };

  // Highlight relevant tables based on join step
  useEffect(() => {
    if (isOpen && onTableHighlight) {
      if (needsJoin) {
        // During join configuration, highlight only relevant table for current step
        if (joinStep === 'select-new-column' && selectedTable) {
          // Step 1: Highlight only the NEW table being added
          onTableHighlight([selectedTable]);
        } else if (joinStep === 'select-existing-column') {
          // Step 2: Highlight all EXISTING tables with ID attributes
          onTableHighlight(Array.from(accessibleTables));
        } else {
          // Complete: No highlighting needed
          onTableHighlight([]);
        }
      } else if (selectedTable) {
        // Not in join mode: highlight selected table
        onTableHighlight([selectedTable]);
      } else {
        // No table selected: highlight ALL tables (user can select any)
        onTableHighlight(schema.tables.map(t => t.name));
      }
    }
    return () => {
      if (onTableHighlight) onTableHighlight([]);
    };
  }, [isOpen, onTableHighlight, needsJoin, joinStep, selectedTable, accessibleTables, schema]);

  if (!isOpen) return null;

  const getTableColumns = (tableName: string): TableMetadata | undefined => {
    return schema.tables.find(t => t.name === tableName);
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setSelectedColumn('');
    setValue('');
    if (onTableHighlight) onTableHighlight([tableName]);
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
    if (!selectedTable || !selectedColumn || !operator) return;
    if (!useNull && !value.trim()) return;
    
    // If join is needed, check if join configuration is complete
    if (needsJoin && (!joinFromTable || !joinFromColumn || !joinToColumn)) {
      return;
    }

    let condition: string;
    if (useNull) {
      condition = `${selectedTable}.${selectedColumn} ${operator}`;
    } else {
      // Auto-quote string values
      const quotedValue = isNaN(Number(value)) && !value.startsWith("'") 
        ? `'${value.replace(/'/g, "''")}'` 
        : value;
      condition = `${selectedTable}.${selectedColumn} ${operator} ${quotedValue}`;
    }
    
    // Build join if needed
    let joinStatement: string | undefined;
    if (needsJoin && joinFromTable && joinFromColumn && joinToColumn) {
      joinStatement = `${joinType} JOIN ${selectedTable} ON ${joinFromTable}.${joinFromColumn} = ${selectedTable}.${joinToColumn}`;
    }

    onSave(condition, joinStatement);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTable('');
    setSelectedColumn('');
    setOperator('=');
    setValue('');
    setUseNull(false);
    setNeedsJoin(false);
    setJoinFromTable('');
    setJoinFromColumn('');
    setJoinToColumn('');
    setJoinStep('select-new-column');
    if (onTableHighlight) onTableHighlight([]);
    onClose();
  };

  const selectedTableMeta = selectedTable ? getTableColumns(selectedTable) : null;
  const selectedColumnMeta = selectedTableMeta?.columns.find(c => c.name === selectedColumn);

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
          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Click on any column in the database viewer to add it as a condition. You can select from any table - if needed, a join will be configured automatically.
            </p>
          </div>

          {/* Select Table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Table
            </label>
            <select
              value={selectedTable}
              onChange={(e) => handleTableSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a table or click in database viewer...</option>
              {schema.tables.map(table => (
                <option 
                  key={table.name} 
                  value={table.name}
                >
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Column - Visual Grid */}
          {selectedTable && selectedTableMeta && !needsJoin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Column (or click in database viewer)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-2">
                {selectedTableMeta.columns.map(col => (
                  <button
                    key={col.name}
                    onClick={() => setSelectedColumn(col.name)}
                    className={`text-left p-2 rounded text-sm transition-colors ${
                      selectedColumn === col.name
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
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
          
          {/* Join Configuration */}
          {needsJoin && selectedTable && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Join Configuration Required
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                This table is not in the existing ID attributes or joins. Configure how to join it:
              </p>

              <div className="space-y-4">
                {/* Join Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Join Type:
                  </label>
                  <select
                    value={joinType}
                    onChange={(e) => setJoinType(e.target.value as any)}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="LEFT">LEFT JOIN</option>
                    <option value="INNER">INNER JOIN</option>
                    <option value="RIGHT">RIGHT JOIN</option>
                  </select>
                </div>

                {/* Step-by-step join configuration */}
                <div className="space-y-3">
                  {/* Step 1: Select column in NEW table */}
                  <div className={`p-3 rounded ${joinStep === 'select-new-column' ? 'bg-primary-100 dark:bg-primary-900/20 border-2 border-primary-500' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Step 1: Select join column in {selectedTable}
                      </span>
                      {joinToColumn && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ {joinToColumn}</span>
                      )}
                    </div>
                    {joinStep === 'select-new-column' ? (
                      <p className="text-xs text-primary-700 dark:text-primary-300 font-medium">
                        👉 Click on a column in the <span className="font-bold">{selectedTable}</span> table in the database viewer on the left
                      </p>
                    ) : joinToColumn ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400">Column: {joinToColumn}</p>
                    ) : null}
                  </div>

                  {/* Step 2: Select column in EXISTING table */}
                  {joinToColumn && (
                    <div className={`p-3 rounded ${joinStep === 'select-existing-column' ? 'bg-primary-100 dark:bg-primary-900/20 border-2 border-primary-500' : 'bg-gray-50 dark:bg-gray-800'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Step 2: Select matching column from existing table
                        </span>
                        {joinFromTable && joinFromColumn && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ {joinFromTable}.{joinFromColumn}</span>
                        )}
                      </div>
                      {joinStep === 'select-existing-column' ? (
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          👉 Click on a column in any highlighted table in the database viewer on the left
                        </p>
                      ) : joinFromTable && joinFromColumn ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400">Table.Column: {joinFromTable}.{joinFromColumn}</p>
                      ) : null}
                    </div>
                  )}

                  {/* Join Preview */}
                  {joinFromTable && joinFromColumn && joinToColumn && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 p-3 rounded">
                      <p className="text-xs font-medium text-green-900 dark:text-green-300 mb-1">Join Configuration:</p>
                      <div className="bg-white dark:bg-gray-800 p-2 rounded text-xs font-mono text-gray-800 dark:text-gray-200">
                        {joinType} JOIN {selectedTable}<br/>
                        ON {joinFromTable}.{joinFromColumn} = {selectedTable}.{joinToColumn}
                      </div>
                      <button
                        onClick={handleResetJoin}
                        className="mt-2 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline"
                      >
                        Reset and reconfigure
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Select Operator */}
          {selectedColumn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operator
              </label>
              <select
                value={operator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {operators.map(op => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Enter Value */}
          {selectedColumn && !useNull && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Value
              </label>
              {selectedColumnMeta && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Column type: {selectedColumnMeta.dataType}
                  {operator === 'IN' || operator === 'NOT IN' 
                    ? ' • Use comma-separated values for IN/NOT IN (e.g., 1, 2, 3)' 
                    : ''}
                  {operator === 'LIKE' || operator === 'NOT LIKE'
                    ? ' • Use % as wildcard (e.g., %search%)' 
                    : ''}
                </div>
              )}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Condition Preview */}
          {selectedTable && selectedColumn && (useNull || value.trim()) && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Condition Preview:</div>
              <code className="text-sm text-gray-900 dark:text-white">
                {selectedTable}.{selectedColumn} {operator}
                {!useNull && (
                  <> {isNaN(Number(value)) && !value.startsWith("'") ? `'${value}'` : value}</>
                )}
              </code>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              !selectedTable || 
              !selectedColumn || 
              !operator ||
              (!useNull && !value.trim())
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Add Condition
          </button>
        </div>
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
