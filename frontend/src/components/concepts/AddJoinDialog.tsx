'use client';

import { useState, useEffect } from 'react';
import { X, Database } from 'lucide-react';
import type { DatabaseSchema, Concept } from '@/lib/types';

interface AddJoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (join: string) => void;
  concept: Concept;
  schema: DatabaseSchema;
  onTableHighlight?: (tables: string[]) => void;
  selectedTable?: string | null;
  selectedColumn?: string | null;
}

type JoinStep = 'select-table-1' | 'select-column-1' | 'select-table-2' | 'select-column-2' | 'complete';

export function AddJoinDialog({
  isOpen,
  onClose,
  onSave,
  concept,
  schema,
  onTableHighlight,
  selectedTable: propSelectedTable,
  selectedColumn: propSelectedColumn,
}: AddJoinDialogProps) {
  const [joinStep, setJoinStep] = useState<JoinStep>('select-table-1');
  const [joinType, setJoinType] = useState<'LEFT' | 'INNER' | 'RIGHT'>('LEFT');
  
  // First table (must be from existing ID attributes)
  const [table1, setTable1] = useState<string | null>(null);
  const [column1, setColumn1] = useState<string | null>(null);
  
  // Second table (can be any table, including from other clusters)
  const [table2, setTable2] = useState<string | null>(null);
  const [column2, setColumn2] = useState<string | null>(null);
  
  const [lastPropValues, setLastPropValues] = useState<{table?: string, column?: string}>({});

  // Get tables that already have ID attributes
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

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setJoinStep('select-table-1');
      setTable1(null);
      setColumn1(null);
      setTable2(null);
      setColumn2(null);
      setJoinType('LEFT');
      setLastPropValues({});
    }
  }, [isOpen]);

  // Handle highlighting based on current step
  useEffect(() => {
    if (!isOpen || !onTableHighlight) return;

    switch (joinStep) {
      case 'select-table-1':
        // Highlight only tables with ID attributes
        onTableHighlight(Array.from(existingTables));
        break;
      case 'select-column-1':
        // Highlight the selected table
        if (table1) onTableHighlight([table1]);
        break;
      case 'select-table-2':
        // Highlight all tables
        onTableHighlight(schema.tables.map(t => t.name));
        break;
      case 'select-column-2':
        // Highlight the second table
        if (table2) onTableHighlight([table2]);
        break;
      default:
        onTableHighlight([]);
    }

    return () => {
      onTableHighlight([]);
    };
  }, [isOpen, joinStep, table1, table2, existingTables, schema]);

  // Handle incoming column clicks from props
  useEffect(() => {
    if (!isOpen || !propSelectedTable || !propSelectedColumn) return;

    // Only update if values have changed
    if (propSelectedTable === lastPropValues.table && propSelectedColumn === lastPropValues.column) {
      return;
    }

    setLastPropValues({ table: propSelectedTable, column: propSelectedColumn });

    switch (joinStep) {
      case 'select-table-1':
        // Must be from existing tables
        if (existingTables.has(propSelectedTable)) {
          setTable1(propSelectedTable);
          setColumn1(propSelectedColumn);
          setJoinStep('select-table-2');
        }
        break;
      case 'select-column-1':
        if (propSelectedTable === table1) {
          setColumn1(propSelectedColumn);
          setJoinStep('select-table-2');
        }
        break;
      case 'select-table-2':
        setTable2(propSelectedTable);
        setColumn2(propSelectedColumn);
        setJoinStep('complete');
        break;
      case 'select-column-2':
        if (propSelectedTable === table2) {
          setColumn2(propSelectedColumn);
          setJoinStep('complete');
        }
        break;
    }
  }, [propSelectedTable, propSelectedColumn, isOpen, joinStep, table1, existingTables]);

  const handleTableSelect = (tableName: string, step: 1 | 2) => {
    if (step === 1) {
      setTable1(tableName);
      setColumn1(null);
      setJoinStep('select-column-1');
    } else {
      setTable2(tableName);
      setColumn2(null);
      setJoinStep('select-column-2');
    }
  };

  const handleReset = () => {
    setJoinStep('select-table-1');
    setTable1(null);
    setColumn1(null);
    setTable2(null);
    setColumn2(null);
  };

  const handleSave = () => {
    if (!table1 || !column1 || !table2 || !column2) return;

    const joinStatement = `${joinType} JOIN ${table2} ON ${table1}.${column1} = ${table2}.${column2}`;
    onSave(joinStatement);
    handleClose();
  };

  const handleClose = () => {
    setJoinStep('select-table-1');
    setTable1(null);
    setColumn1(null);
    setTable2(null);
    setColumn2(null);
    setJoinType('LEFT');
    if (onTableHighlight) onTableHighlight([]);
    onClose();
  };

  if (!isOpen) return null;

  const getTable1Options = () => Array.from(existingTables);
  const getTable2Options = () => schema.tables.map(t => t.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border-4 border-teal-500">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Join</h2>
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
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
            <p className="text-sm text-teal-900 dark:text-teal-200">
              Create a join between two tables. The first table must be from your existing ID attributes.
              The second table can be any table in the database.
            </p>
          </div>

          {/* Join Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Join Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={joinType === 'LEFT'}
                  onChange={() => setJoinType('LEFT')}
                  className="text-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">LEFT JOIN</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={joinType === 'INNER'}
                  onChange={() => setJoinType('INNER')}
                  className="text-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">INNER JOIN</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={joinType === 'RIGHT'}
                  onChange={() => setJoinType('RIGHT')}
                  className="text-teal-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">RIGHT JOIN</span>
              </label>
            </div>
          </div>

          {/* Step 1: Select first table & column */}
          <div className={`border-2 rounded-lg p-4 ${
            joinStep === 'select-table-1' || joinStep === 'select-column-1' 
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Step 1: Select column from existing table
              </h3>
            </div>
            
            {joinStep === 'select-table-1' ? (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Click on any column in a highlighted table in the database viewer, or select from the dropdown:
                </p>
                <select
                  value={table1 || ''}
                  onChange={(e) => handleTableSelect(e.target.value, 1)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Choose a table...</option>
                  {getTable1Options().map(tableName => (
                    <option key={tableName} value={tableName}>
                      {tableName}
                    </option>
                  ))}
                </select>
              </>
            ) : table1 && column1 ? (
              <div className="bg-white dark:bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-900 dark:text-white font-mono">
                  ✓ {table1}.{column1}
                </p>
              </div>
            ) : table1 ? (
              <p className="text-xs text-teal-700 dark:text-teal-300">
                Table selected: <span className="font-semibold">{table1}</span>. Now select a column from this table.
              </p>
            ) : null}
          </div>

          {/* Step 2: Select second table & column */}
          <div className={`border-2 rounded-lg p-4 ${
            joinStep === 'select-table-2' || joinStep === 'select-column-2'
              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-teal-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Step 2: Select matching column from any table
              </h3>
            </div>
            
            {!table1 || !column1 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Complete Step 1 first
              </p>
            ) : joinStep === 'select-table-2' ? (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  Click on any column in the database viewer, or select from the dropdown:
                </p>
                <select
                  value={table2 || ''}
                  onChange={(e) => handleTableSelect(e.target.value, 2)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Choose a table...</option>
                  {getTable2Options().map(tableName => (
                    <option key={tableName} value={tableName}>
                      {tableName}
                    </option>
                  ))}
                </select>
              </>
            ) : table2 && column2 ? (
              <div className="bg-white dark:bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-900 dark:text-white font-mono">
                  ✓ {table2}.{column2}
                </p>
              </div>
            ) : table2 ? (
              <p className="text-xs text-teal-700 dark:text-teal-300">
                Table selected: <span className="font-semibold">{table2}</span>. Now select a column from this table.
              </p>
            ) : null}
          </div>

          {/* Join Preview */}
          {table1 && column1 && table2 && column2 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 p-4 rounded-lg">
              <p className="text-xs font-medium text-green-900 dark:text-green-300 mb-2">
                Join Preview:
              </p>
              <div className="bg-white dark:bg-gray-800 p-3 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                {joinType} JOIN {table2}<br/>
                ON {table1}.{column1} = {table2}.{column2}
              </div>
              <button
                onClick={handleReset}
                className="mt-3 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 underline"
              >
                Reset and start over
              </button>
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
            disabled={!table1 || !column1 || !table2 || !column2}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Add Join
          </button>
        </div>
      </div>
    </div>
  );
}
