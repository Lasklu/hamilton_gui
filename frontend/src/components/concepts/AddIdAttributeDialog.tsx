'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { DatabaseSchema, TableMetadata, Concept, ConceptAttribute } from '@/lib/types';

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

type JoinWorkflowState = 
  | { phase: 'id-selection' } // User is selecting ID attribute
  | { phase: 'join-step-1'; idTable: string; idColumn: string } // Select existing table
  | { phase: 'join-step-2'; idTable: string; idColumn: string; existingTable: string } // Select column in existing table
  | { phase: 'join-step-3'; idTable: string; idColumn: string; existingTable: string; existingColumn: string } // Select column in new table
  | { phase: 'join-complete'; idTable: string; idColumn: string; existingTable: string; existingColumn: string; newColumn: string };

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
  // External table selection mode
  const [showExternalTableList, setShowExternalTableList] = useState(false);
  const [externalTable, setExternalTable] = useState<string>('');
  const [externalColumn, setExternalColumn] = useState<string>('');
  
  // Join workflow state machine
  const [joinWorkflow, setJoinWorkflow] = useState<JoinWorkflowState>({ phase: 'id-selection' });
  const [joinType, setJoinType] = useState<'INNER' | 'LEFT' | 'RIGHT'>('LEFT');
  
  // Track previous selectedColumn to detect changes
  const prevSelectedColumnRef = useRef<string | null>(null);

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
  const joinedTables = new Set<string>();
  if (concept.joins) {
    concept.joins.forEach(join => {
      const tableMatches = join.match(/(?:FROM|JOIN)\s+(\w+)/gi);
      if (tableMatches) {
        tableMatches.forEach(match => {
          const tableName = match.split(/\s+/)[1];
          if (tableName) joinedTables.add(tableName);
        });
      }
    });
  }

  // Determine effective table/column
  const effectiveTable = showExternalTableList ? externalTable : selectedTable;
  const effectiveColumn = showExternalTableList ? externalColumn : selectedColumn;

  // Get selected table metadata
  const selectedTableMeta = effectiveTable ? schema.tables.find(t => t.name === effectiveTable) : null;

  // Check if join is needed for a given table
  const needsJoin = (table: string | null | undefined): boolean => {
    if (!table) return false;
    return existingTables.size > 0 && !existingTables.has(table) && !joinedTables.has(table);
  };

  // When ID attribute is selected (table + column), check if join workflow should start
  useEffect(() => {
    if (joinWorkflow.phase === 'id-selection' && effectiveTable && effectiveColumn) {
      if (needsJoin(effectiveTable)) {
        // Start join workflow
        setJoinWorkflow({
          phase: 'join-step-1',
          idTable: effectiveTable,
          idColumn: effectiveColumn,
        });
      }
    }
  }, [effectiveTable, effectiveColumn, joinWorkflow.phase]);

  // Handle column clicks from external database viewer during join workflow
  useEffect(() => {
    // Only process if column actually changed
    if (selectedColumn === prevSelectedColumnRef.current) return;
    prevSelectedColumnRef.current = selectedColumn;

    if (!selectedColumn || !selectedTable) return;

    // Step 2: Selecting column in existing table
    if (joinWorkflow.phase === 'join-step-2' && selectedTable === joinWorkflow.existingTable) {
      setJoinWorkflow({
        phase: 'join-step-3',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
        existingTable: joinWorkflow.existingTable,
        existingColumn: selectedColumn,
      });
    }
    // Step 3: Selecting column in new table
    else if (joinWorkflow.phase === 'join-step-3' && selectedTable === joinWorkflow.idTable) {
      setJoinWorkflow({
        phase: 'join-complete',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
        existingTable: joinWorkflow.existingTable,
        existingColumn: joinWorkflow.existingColumn,
        newColumn: selectedColumn,
      });
    }
  }, [selectedColumn, selectedTable, joinWorkflow]);

  // Table highlighting based on workflow phase
  useEffect(() => {
    if (!isOpen || !onTableHighlight || showExternalTableList) return;

    if (joinWorkflow.phase === 'id-selection') {
      // Highlight all cluster tables for ID selection
      onTableHighlight(clusterTables);
    } else if (joinWorkflow.phase === 'join-step-1') {
      // No highlighting during table button selection
      onTableHighlight([]);
    } else if (joinWorkflow.phase === 'join-step-2') {
      // Highlight only the existing table
      onTableHighlight([joinWorkflow.existingTable]);
    } else if (joinWorkflow.phase === 'join-step-3') {
      // Highlight only the new ID table
      onTableHighlight([joinWorkflow.idTable]);
    } else {
      onTableHighlight([]);
    }

    return () => {
      if (onTableHighlight) onTableHighlight([]);
    };
  }, [isOpen, showExternalTableList, onTableHighlight, joinWorkflow, clusterTables]);

  // Handlers
  const handleColumnClickInDialog = (tableName: string, columnName: string) => {
    if (showExternalTableList) {
      setExternalColumn(columnName);
      return;
    }

    // During ID selection phase, use parent callback
    if (joinWorkflow.phase === 'id-selection') {
      onColumnClick?.(tableName, columnName);
    }
    // During join workflow, handle internally
    else if (joinWorkflow.phase === 'join-step-2' && tableName === joinWorkflow.existingTable) {
      setJoinWorkflow({
        phase: 'join-step-3',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
        existingTable: joinWorkflow.existingTable,
        existingColumn: columnName,
      });
    } else if (joinWorkflow.phase === 'join-step-3' && tableName === joinWorkflow.idTable) {
      setJoinWorkflow({
        phase: 'join-complete',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
        existingTable: joinWorkflow.existingTable,
        existingColumn: joinWorkflow.existingColumn,
        newColumn: columnName,
      });
    }
  };

  const handleSelectExistingTable = (table: string) => {
    if (joinWorkflow.phase === 'join-step-1') {
      setJoinWorkflow({
        phase: 'join-step-2',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
        existingTable: table,
      });
    }
  };

  const handleResetJoin = () => {
    if (joinWorkflow.phase !== 'id-selection') {
      setJoinWorkflow({
        phase: 'join-step-1',
        idTable: joinWorkflow.idTable,
        idColumn: joinWorkflow.idColumn,
      });
    }
  };

  const handleSave = () => {
    let idTable: string;
    let idColumn: string;
    let joinStatement: string | undefined;

    if (joinWorkflow.phase === 'id-selection') {
      // No join needed
      if (!effectiveTable || !effectiveColumn) return;
      idTable = effectiveTable;
      idColumn = effectiveColumn;
    } else if (joinWorkflow.phase === 'join-complete') {
      // Join workflow complete
      idTable = joinWorkflow.idTable;
      idColumn = joinWorkflow.idColumn;
      joinStatement = `${joinType} JOIN ${joinWorkflow.idTable} ON ${joinWorkflow.existingTable}.${joinWorkflow.existingColumn} = ${joinWorkflow.idTable}.${joinWorkflow.newColumn}`;
    } else {
      // Join workflow not complete
      return;
    }

    const attribute: ConceptAttribute = {
      table: idTable,
      column: idColumn,
    };

    onSave(attribute, joinStatement);
    handleClose();
  };

  const handleClose = () => {
    setShowExternalTableList(false);
    setExternalTable('');
    setExternalColumn('');
    setJoinWorkflow({ phase: 'id-selection' });
    setJoinType('LEFT');
    prevSelectedColumnRef.current = null;
    onClose();
  };

  if (!isOpen) return null;

  // Determine if save button should be enabled
  const canSave = 
    (joinWorkflow.phase === 'id-selection' && effectiveTable && effectiveColumn && !needsJoin(effectiveTable)) ||
    joinWorkflow.phase === 'join-complete';

  // Determine which column should be highlighted in the column list
  const getColumnHighlight = (colName: string): boolean => {
    if (joinWorkflow.phase === 'id-selection') {
      return !showExternalTableList && selectedColumn === colName;
    } else if (joinWorkflow.phase === 'join-step-2') {
      return selectedColumn === colName; // During step 2, show selected column
    } else if (joinWorkflow.phase === 'join-step-3') {
      return joinWorkflow.existingColumn === colName || selectedColumn === colName;
    } else if (joinWorkflow.phase === 'join-complete') {
      return joinWorkflow.newColumn === colName;
    }
    return false;
  };

  const dialogContent = (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Add ID Attribute</h2>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      {!showExternalTableList ? (
        <div className="space-y-4">
          {/* Table and ID Column Selection */}
          <div>
            <p className="text-sm text-gray-600 mb-2">
              {joinWorkflow.phase === 'id-selection' 
                ? 'Click on a table in the cluster view on the left, then select a column below.'
                : 'ID attribute selected. Configure join below.'}
            </p>
            {selectedTable && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-medium text-blue-900">
                  Selected Table: <span className="font-bold">{selectedTable}</span>
                </p>
                {joinWorkflow.phase !== 'id-selection' && (
                  <p className="text-sm font-medium text-green-900 mt-1">
                    ID Attribute Column: <span className="font-bold">{joinWorkflow.idColumn}</span> ✓
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Column Selection Grid */}
          {selectedTableMeta && joinWorkflow.phase === 'id-selection' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Column for ID Attribute:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-2">
                {selectedTableMeta.columns.map(col => (
                  <button
                    key={col.name}
                    onClick={() => handleColumnClickInDialog(selectedTable!, col.name)}
                    className={`text-left p-2 rounded text-sm transition-colors ${
                      getColumnHighlight(col.name)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-50 hover:bg-gray-100'
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
          {joinWorkflow.phase !== 'id-selection' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Join Configuration Required
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Table {joinWorkflow.idTable} is not in the existing ID attributes. Configure how to join it:
              </p>

              <div className="space-y-4">
                {/* Join Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Join Type:
                  </label>
                  <select
                    value={joinType}
                    onChange={(e) => setJoinType(e.target.value as any)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="LEFT">LEFT JOIN</option>
                    <option value="INNER">INNER JOIN</option>
                    <option value="RIGHT">RIGHT JOIN</option>
                  </select>
                </div>

                {/* Step Indicator */}
                <div className="text-xs text-gray-600 font-medium">
                  {joinWorkflow.phase === 'join-step-1' && 'Current Step: 1 of 3'}
                  {joinWorkflow.phase === 'join-step-2' && 'Current Step: 2 of 3'}
                  {joinWorkflow.phase === 'join-step-3' && 'Current Step: 3 of 3'}
                  {joinWorkflow.phase === 'join-complete' && 'Join Configuration Complete'}
                </div>

                {/* Step 1: Select Existing Table */}
                <div className={`p-3 rounded ${joinWorkflow.phase === 'join-step-1' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Step 1: Select existing table to join with
                    </span>
                    {joinWorkflow.phase !== 'join-step-1' && (
                      <span className="text-xs text-green-600 font-medium">
                        ✓ {joinWorkflow.existingTable}
                      </span>
                    )}
                  </div>
                  {joinWorkflow.phase === 'join-step-1' ? (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        Select a table that is already part of this concept:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from(existingTables).map(table => (
                          <button
                            key={table}
                            onClick={() => handleSelectExistingTable(table)}
                            className="text-left p-2 rounded text-sm bg-white border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                          >
                            {table}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Table: {joinWorkflow.existingTable}
                    </p>
                  )}
                </div>

                {/* Step 2: Select Column in Existing Table */}
                {joinWorkflow.phase !== 'join-step-1' && (
                  <div className={`p-3 rounded ${joinWorkflow.phase === 'join-step-2' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Step 2: Select join column in {joinWorkflow.existingTable}
                      </span>
                      {joinWorkflow.phase !== 'join-step-2' && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ {joinWorkflow.existingColumn}
                        </span>
                      )}
                    </div>
                    {joinWorkflow.phase === 'join-step-2' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-700 font-medium">
                          👉 Click on a column in the <span className="font-bold">{joinWorkflow.existingTable}</span> table in the database viewer on the left
                        </p>
                        <p className="text-xs text-gray-600 italic">
                          All other tables are greyed out.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">
                        Column: {joinWorkflow.existingColumn}
                      </p>
                    )}
                  </div>
                )}

                {/* Step 3: Select Column in New Table */}
                {(joinWorkflow.phase === 'join-step-3' || joinWorkflow.phase === 'join-complete') && (
                  <div className={`p-3 rounded ${joinWorkflow.phase === 'join-step-3' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Step 3: Select join column in {joinWorkflow.idTable}
                      </span>
                      {joinWorkflow.phase === 'join-complete' && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ {joinWorkflow.newColumn}
                        </span>
                      )}
                    </div>
                    {joinWorkflow.phase === 'join-step-3' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-700 font-medium">
                          👉 Click on a column in the <span className="font-bold">{joinWorkflow.idTable}</span> table in the database viewer on the left
                        </p>
                        <p className="text-xs text-gray-600 italic">
                          Select the column that matches with {joinWorkflow.existingTable}.{joinWorkflow.existingColumn}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600">
                        Column: {joinWorkflow.newColumn}
                      </p>
                    )}
                  </div>
                )}

                {/* Join Preview */}
                {joinWorkflow.phase === 'join-complete' && (
                  <div className="bg-green-50 border border-green-300 p-3 rounded">
                    <p className="text-xs font-medium text-green-900 mb-1">Join Configuration:</p>
                    <div className="bg-white p-2 rounded text-xs font-mono text-gray-800">
                      {joinType} JOIN {joinWorkflow.idTable}<br/>
                      ON {joinWorkflow.existingTable}.{joinWorkflow.existingColumn} = {joinWorkflow.idTable}.{joinWorkflow.newColumn}
                    </div>
                    <button
                      onClick={handleResetJoin}
                      className="mt-2 text-xs text-orange-600 hover:text-orange-700 underline"
                    >
                      Reset and reconfigure
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* External Table Selection Button */}
          {joinWorkflow.phase === 'id-selection' && (
            <div className="border-t pt-4">
              <button
                onClick={() => setShowExternalTableList(true)}
                className="w-full py-2 px-4 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
              >
                Select Table from Other Clusters
              </button>
            </div>
          )}
        </div>
      ) : (
        // External Table Selection Mode
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Table:
            </label>
            <select
              value={externalTable}
              onChange={(e) => {
                setExternalTable(e.target.value);
                setExternalColumn('');
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select a table...</option>
              {schema.tables
                .filter(t => !clusterTables.includes(t.name))
                .map(table => (
                  <option key={table.name} value={table.name}>{table.name}</option>
                ))}
            </select>
          </div>

          {selectedTableMeta && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Column:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-2">
                {selectedTableMeta.columns.map(col => (
                  <button
                    key={col.name}
                    onClick={() => setExternalColumn(col.name)}
                    className={`text-left p-2 rounded text-sm transition-colors ${
                      externalColumn === col.name
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-50 hover:bg-gray-100'
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

          <div className="border-t pt-4">
            <button
              onClick={() => {
                setShowExternalTableList(false);
                setExternalTable('');
                setExternalColumn('');
              }}
              className="w-full py-2 px-4 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Back to Cluster Selection
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={handleClose}
          className="py-2 px-4 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`py-2 px-4 text-sm text-white rounded transition-colors ${
            canSave
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Add Attribute
        </button>
      </div>
    </>
  );

  if (inline) {
    return <div className="border border-blue-500 dark:border-blue-400 rounded-lg p-6 bg-white dark:bg-gray-800">{dialogContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="h-full flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto pointer-events-auto border-4 border-blue-500">
          {dialogContent}
        </div>
      </div>
    </div>
  );
}
