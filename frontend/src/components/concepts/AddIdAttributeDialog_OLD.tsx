'use client';

import { useState, useEffect } from 'react';
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
  inline?: boolean; // If true, renders inline instead of as a fixed overlay
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
  const [showExternalTableList, setShowExternalTableList] = useState(false);
  const [externalTable, setExternalTable] = useState<string>('');
  const [externalColumn, setExternalColumn] = useState<string>('');
  const [needsJoin, setNeedsJoin] = useState(false);
  const [joinType, setJoinType] = useState<'INNER' | 'LEFT' | 'RIGHT'>('LEFT');
  const [joinFromTable, setJoinFromTable] = useState<string>('');
  const [joinFromColumn, setJoinFromColumn] = useState<string>('');
  const [joinToColumn, setJoinToColumn] = useState<string>('');
  const [lockedIdColumn, setLockedIdColumn] = useState<string>(''); // Locked ID attribute column before join config
  // Join steps: 'select-existing-table' | 'select-existing-column' | 'select-new-column' | 'complete'
  const [joinStep, setJoinStep] = useState<'select-existing-table' | 'select-existing-column' | 'select-new-column' | 'complete'>('select-existing-table');

  // Get list of tables that already have ID attributes
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

  // Get list of tables already in joins
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

  // Determine which table/column to use
  const effectiveTable = showExternalTableList ? externalTable : selectedTable;
  // During join configuration, use the locked ID column; otherwise use the current selection
  const effectiveColumn = showExternalTableList 
    ? externalColumn 
    : (needsJoin && lockedIdColumn ? lockedIdColumn : selectedColumn);

  // Get selected table metadata
  const selectedTableMeta = effectiveTable ? schema.tables.find(t => t.name === effectiveTable) : null;

  // Detect if a join is needed when table is selected
  useEffect(() => {
    if (effectiveTable && existingTables.size > 0 && !existingTables.has(effectiveTable) && !joinedTables.has(effectiveTable)) {
      setNeedsJoin(true);
      setJoinStep('select-existing-table'); // Start from step 1
      // Lock the current ID column selection before starting join configuration
      if (selectedColumn && !showExternalTableList) {
        setLockedIdColumn(selectedColumn);
      } else if (externalColumn && showExternalTableList) {
        setLockedIdColumn(externalColumn);
      }
    } else {
      setNeedsJoin(false);
      setJoinFromTable('');
      setJoinFromColumn('');
      setJoinToColumn('');
      setJoinStep('select-existing-table'); // Reset to beginning
      setLockedIdColumn(''); // Clear lock when no join needed
    }
  }, [effectiveTable]);

  // Handle column click for join configuration
  const handleJoinColumnClick = (tableName: string, columnName: string) => {
    // Step 2: User clicks a column in the EXISTING table (the one already in the concept)
    if (joinStep === 'select-existing-column' && tableName === joinFromTable) {
      setJoinFromColumn(columnName); // This is the join column in EXISTING table
      setJoinStep('select-new-column'); // Move to step 3
    }
    // Step 3: User clicks a column in the NEW table (can be any column, not necessarily the ID attribute)
    else if (joinStep === 'select-new-column' && tableName === effectiveTable) {
      setJoinToColumn(columnName); // This is the join column in NEW table
      setJoinStep('complete');
    }
  };

  // Process incoming column clicks FOR JOIN CONFIGURATION ONLY
  useEffect(() => {
    // Only process clicks if we're in join configuration AND not on the initial table selection step
    if (selectedColumn && selectedTable && needsJoin && joinStep !== 'select-existing-table') {
      // Step 2: Accept clicks from EXISTING table
      if (joinStep === 'select-existing-column' && selectedTable === joinFromTable) {
        handleJoinColumnClick(selectedTable, selectedColumn);
      }
      // Step 3: Accept clicks from NEW table for join column
      else if (joinStep === 'select-new-column' && selectedTable === effectiveTable) {
        handleJoinColumnClick(selectedTable, selectedColumn);
      }
    }
  }, [selectedColumn, selectedTable, needsJoin, joinStep]);

  // Reset join configuration
  const handleResetJoin = () => {
    setJoinFromTable('');
    setJoinFromColumn('');
    setJoinToColumn('');
    setJoinStep('select-existing-table');
    // Keep lockedIdColumn - don't clear it as we still need join configuration
  };

  // Highlight relevant tables based on join step
  useEffect(() => {
    if (isOpen && onTableHighlight && !showExternalTableList) {
      if (needsJoin) {
        // During join configuration, highlight only relevant table for current step
        if (joinStep === 'select-existing-table') {
          // Step 1 (automatic): No highlighting during table selection (button grid)
          onTableHighlight([]);
        } else if (joinStep === 'select-existing-column' && joinFromTable) {
          // Step 2: Highlight only the selected EXISTING table
          onTableHighlight([joinFromTable]);
        } else if (joinStep === 'select-new-column' && effectiveTable) {
          // Step 3: Highlight only the NEW table for join column selection
          onTableHighlight([effectiveTable]);
        } else {
          // Complete: No highlighting needed
          onTableHighlight([]);
        }
      } else {
        // Not in join mode: highlight all cluster tables
        onTableHighlight(clusterTables);
      }
    }
    return () => {
      if (onTableHighlight) onTableHighlight([]);
    };
  }, [isOpen, showExternalTableList, onTableHighlight, needsJoin, joinStep, effectiveTable, joinFromTable, existingTables]);

  const handleSave = () => {
    if (!effectiveTable) return;
    
    // Use the directly selected column as the ID attribute
    const columnToSave = effectiveColumn;
    
    if (!columnToSave) return;

    const attribute: ConceptAttribute = {
      table: effectiveTable,
      column: columnToSave,
    };

    // Build join if needed
    let joinStatement: string | undefined;
    if (needsJoin && joinFromTable && joinFromColumn && joinToColumn) {
      // Step 2: joinFromColumn is the column in the EXISTING table
      // Step 3: joinToColumn is the column in the NEW table
      joinStatement = `${joinType} JOIN ${effectiveTable} ON ${joinFromTable}.${joinFromColumn} = ${effectiveTable}.${joinToColumn}`;
    }

    onSave(attribute, joinStatement);
    handleClose();
  };

  const handleClose = () => {
    setShowExternalTableList(false);
    setExternalTable('');
    setExternalColumn('');
    setNeedsJoin(false);
    setJoinType('LEFT');
    setJoinFromTable('');
    setJoinFromColumn('');
    setJoinToColumn('');
    setLockedIdColumn('');
    onClose();
  };

  const handleExternalColumnClick = (columnName: string) => {
    setExternalColumn(columnName);
  };

  if (!isOpen) return null;

  // Get tables available for joins (tables with existing ID attributes)
  const tablesForJoin = Array.from(existingTables);

  // Check if save is valid
  const canSave = effectiveTable && 
    effectiveColumn && // Must have a column selected for ID attribute
    // If join is needed, all join fields must be filled
    (!needsJoin || (joinFromTable && joinFromColumn && joinToColumn));

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
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Click on a table in the cluster view on the left, then select a column below.
              </p>
              {selectedTable && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium text-blue-900">
                    Selected Table: <span className="font-bold">{selectedTable}</span>
                  </p>
                  {needsJoin && lockedIdColumn && (
                    <p className="text-sm font-medium text-green-900 mt-1">
                      ID Attribute Column: <span className="font-bold">{lockedIdColumn}</span> ✓
                    </p>
                  )}
                </div>
              )}
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
                      onClick={() => {
                        // If in join configuration mode (Steps 2 or 3), handle join column selection internally
                        if (needsJoin && (joinStep === 'select-existing-column' || joinStep === 'select-new-column')) {
                          handleJoinColumnClick(selectedTable!, col.name);
                        } else {
                          // Otherwise, normal ID attribute column selection via parent callback
                          onColumnClick?.(selectedTable!, col.name);
                        }
                      }}
                      className={`text-left p-2 rounded text-sm transition-colors ${
                        // Highlight logic based on join step
                        (joinStep === 'select-existing-column' && joinFromColumn === col.name) ||
                        (joinStep === 'select-new-column' && joinToColumn === col.name) ||
                        (joinStep === 'complete' && joinToColumn === col.name) ||
                        (!needsJoin && selectedColumn === col.name) ||
                        (needsJoin && joinStep === 'select-existing-table' && selectedColumn === col.name)
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

            {needsJoin && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Join Configuration Required
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  This table is not in the existing ID attributes. Configure how to join it:
                </p>

                <div className="space-y-4">
                  {/* Join Type Selection */}
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

                  {/* Step-by-step join configuration */}
                  <div className="space-y-3">
                    {/* Current Step Indicator */}
                    <div className="text-xs text-gray-600 font-medium mb-2">
                      {joinStep === 'select-existing-table' && 'Current Step: 1 of 3'}
                      {joinStep === 'select-existing-column' && 'Current Step: 2 of 3'}
                      {joinStep === 'select-new-column' && 'Current Step: 3 of 3'}
                      {joinStep === 'complete' && 'Join Configuration Complete'}
                    </div>

                    {/* Step 1: Select EXISTING table to join with */}
                    <div className={`p-3 rounded ${joinStep === 'select-existing-table' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Step 1: Select existing table
                        </span>
                        {joinFromTable && (
                          <span className="text-xs text-green-600 font-medium">✓ {joinFromTable}</span>
                        )}
                      </div>
                      {joinStep === 'select-existing-table' ? (
                        <div>
                          <p className="text-xs text-gray-600 mb-2">
                            Select the table that is already part of this concept to join with:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from(existingTables).map(table => (
                              <button
                                key={table}
                                onClick={() => {
                                  setJoinFromTable(table);
                                  setJoinFromColumn('');
                                  setJoinStep('select-existing-column');
                                }}
                                className="text-left p-2 rounded text-sm bg-white border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                              >
                                {table}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : joinFromTable ? (
                        <p className="text-xs text-gray-600">Table: {joinFromTable}</p>
                      ) : null}
                    </div>

                    {/* Step 2: Select join column in EXISTING table */}
                    {joinFromTable && (
                      <div className={`p-3 rounded ${joinStep === 'select-existing-column' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Step 2: Select join column in {joinFromTable}
                          </span>
                          {joinFromColumn && (
                            <span className="text-xs text-green-600 font-medium">✓ {joinFromColumn}</span>
                          )}
                        </div>
                        {joinStep === 'select-existing-column' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-blue-700 font-medium">
                              👉 Click on a column in the <span className="font-bold">{joinFromTable}</span> table in the database viewer on the left
                            </p>
                            <p className="text-xs text-gray-600 italic">
                              Select the column from {joinFromTable} that should be used as the join partner. All other tables are greyed out.
                            </p>
                          </div>
                        ) : joinFromColumn ? (
                          <p className="text-xs text-gray-600">Column: {joinFromColumn}</p>
                        ) : null}
                      </div>
                    )}

                    {/* Step 3: Select join column in NEW table */}
                    {joinFromColumn && (
                      <div className={`p-3 rounded ${joinStep === 'select-new-column' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Step 3: Select join column in {effectiveTable}
                          </span>
                          {joinToColumn && (
                            <span className="text-xs text-green-600 font-medium">✓ {joinToColumn}</span>
                          )}
                        </div>
                        {joinStep === 'select-new-column' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-blue-700 font-medium">
                              👉 Click on a column in the <span className="font-bold">{effectiveTable}</span> table in the database viewer on the left
                            </p>
                            <p className="text-xs text-gray-600 italic">
                              Select the column from {effectiveTable} that matches with {joinFromTable}.{joinFromColumn}. This can be any column, not necessarily the ID attribute. All other tables are greyed out.
                            </p>
                          </div>
                        ) : joinToColumn ? (
                          <p className="text-xs text-gray-600">Column: {joinToColumn}</p>
                        ) : null}
                      </div>
                    )}

                    {/* Join Preview */}
                    {joinFromTable && joinFromColumn && joinToColumn && (
                      <div className="bg-green-50 border border-green-300 p-3 rounded">
                        <p className="text-xs font-medium text-green-900 mb-1">Join Configuration:</p>
                        <div className="bg-white p-2 rounded text-xs font-mono text-gray-800">
                          {joinType} JOIN {effectiveTable}<br/>
                          ON {joinFromTable}.{joinFromColumn} = {effectiveTable}.{joinToColumn}
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
              </div>
            )}

            <div className="border-t pt-4">
              <button
                onClick={() => setShowExternalTableList(true)}
                className="w-full py-2 px-4 text-sm text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
              >
                Select Table from Other Clusters
              </button>
            </div>
          </div>
        ) : (
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
                      onClick={() => handleExternalColumnClick(col.name)}
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

            {needsJoin && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Join Configuration Required
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  This table is not in the existing ID attributes. Configure how to join it:
                </p>

                <div className="space-y-4">
                  {/* Join Type Selection */}
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

                  {/* Step-by-step join configuration */}
                  <div className="space-y-3">
                    {/* Current Step Indicator */}
                    <div className="text-xs text-gray-600 font-medium mb-2">
                      {joinStep === 'select-existing-table' && 'Current Step: 1 of 3'}
                      {joinStep === 'select-existing-column' && 'Current Step: 2 of 3'}
                      {joinStep === 'select-new-column' && 'Current Step: 3 of 3'}
                      {joinStep === 'complete' && 'Join Configuration Complete'}
                    </div>

                    {/* Step 1: Select EXISTING table to join with */}
                    <div className={`p-3 rounded ${joinStep === 'select-existing-table' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Step 1: Select existing table
                        </span>
                        {joinFromTable && (
                          <span className="text-xs text-green-600 font-medium">✓ {joinFromTable}</span>
                        )}
                      </div>
                      {joinStep === 'select-existing-table' ? (
                        <div>
                          <p className="text-xs text-gray-600 mb-2">
                            Select the table that is already part of this concept to join with:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from(existingTables).map(table => (
                              <button
                                key={table}
                                onClick={() => {
                                  setJoinFromTable(table);
                                  setJoinFromColumn('');
                                  setJoinStep('select-existing-column');
                                }}
                                className="text-left p-2 rounded text-sm bg-white border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                              >
                                {table}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : joinFromTable ? (
                        <p className="text-xs text-gray-600">Table: {joinFromTable}</p>
                      ) : null}
                    </div>

                    {/* Step 2: Select join column in EXISTING table */}
                    {joinFromTable && (
                      <div className={`p-3 rounded ${joinStep === 'select-existing-column' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Step 2: Select join column in {joinFromTable}
                          </span>
                          {joinFromColumn && (
                            <span className="text-xs text-green-600 font-medium">✓ {joinFromColumn}</span>
                          )}
                        </div>
                        {joinStep === 'select-existing-column' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-blue-700 font-medium">
                              👉 Click on a column in the <span className="font-bold">{joinFromTable}</span> table in the database viewer on the left
                            </p>
                            <p className="text-xs text-gray-600 italic">
                              Select the column from {joinFromTable} that should be used as the join partner. All other tables are greyed out.
                            </p>
                          </div>
                        ) : joinFromColumn ? (
                          <p className="text-xs text-gray-600">Column: {joinFromColumn}</p>
                        ) : null}
                      </div>
                    )}

                    {/* Step 3: Select join column in NEW table */}
                    {joinFromColumn && (
                      <div className={`p-3 rounded ${joinStep === 'select-new-column' ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Step 3: Select join column in {effectiveTable}
                          </span>
                          {joinToColumn && (
                            <span className="text-xs text-green-600 font-medium">✓ {joinToColumn}</span>
                          )}
                        </div>
                        {joinStep === 'select-new-column' ? (
                          <div className="space-y-2">
                            <p className="text-xs text-blue-700 font-medium">
                              👉 Click on a column in the <span className="font-bold">{effectiveTable}</span> table in the database viewer on the left
                            </p>
                            <p className="text-xs text-gray-600 italic">
                              Select the column from {effectiveTable} that matches with {joinFromTable}.{joinFromColumn}. This can be any column, not necessarily the ID attribute. All other tables are greyed out.
                            </p>
                          </div>
                        ) : joinToColumn ? (
                          <p className="text-xs text-gray-600">Column: {joinToColumn}</p>
                        ) : null}
                      </div>
                    )}

                    {/* Join Preview */}
                    {joinFromTable && joinFromColumn && joinToColumn && (
                      <div className="bg-green-50 border border-green-300 p-3 rounded">
                        <p className="text-xs font-medium text-green-900 mb-1">Join Configuration:</p>
                        <div className="bg-white p-2 rounded text-xs font-mono text-gray-800">
                          {joinType} JOIN {effectiveTable}<br/>
                          ON {joinFromTable}.{joinFromColumn} = {effectiveTable}.{joinToColumn}
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
