'use client';

import { useEffect, useState } from 'react';
import type { ClusterInfo, TableMetadata, DatabaseSchema } from '@/lib/types';

interface TableClusterViewProps {
  cluster: ClusterInfo;
  schema: DatabaseSchema;
  highlightedTables?: string[];
  className?: string;
  onTableClick?: (tableName: string) => void;
  onColumnClick?: (tableName: string, columnName: string) => void;
  clickableTables?: boolean;
  clickableColumns?: boolean;
}

interface TableNode {
  name: string;
  columns: Array<{
    name: string;
    dataType: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    foreignKeyReference?: string;
  }>;
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
}

const TABLE_WIDTH = 280;
const TABLE_ROW_HEIGHT = 28;
const TABLE_HEADER_HEIGHT = 45;
const TABLE_SPACING = 60;

export function TableClusterView({ cluster, schema, highlightedTables = [], className = '', onTableClick, onColumnClick, clickableTables = false, clickableColumns = false }: TableClusterViewProps) {
  const [tables, setTables] = useState<TableNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{table: string, column: string} | null>(null);

  useEffect(() => {
    // Filter tables that belong to this cluster
    const clusterTables = schema.tables.filter(t => cluster.tables.includes(t.name));
    
    // Calculate grid layout
    const tablesPerRow = Math.min(2, clusterTables.length);
    const tableNodes: TableNode[] = [];
    const tableConnections: Connection[] = [];

    clusterTables.forEach((table, index) => {
      const row = Math.floor(index / tablesPerRow);
      const col = index % tablesPerRow;
      
      const x = 50 + col * (TABLE_WIDTH + TABLE_SPACING);
      const y = 50 + row * (TABLE_ROW_HEIGHT * 8 + TABLE_SPACING);

      tableNodes.push({
        name: table.name,
        columns: table.columns,
        x,
        y,
      });

      // Create connections based on foreign keys
      table.columns.forEach((column) => {
        if (column.isForeignKey && column.foreignKeyReference) {
          const [targetTable, targetColumn] = column.foreignKeyReference.split('.');
          if (cluster.tables.includes(targetTable)) {
            tableConnections.push({
              from: table.name,
              to: targetTable,
              fromColumn: column.name,
              toColumn: targetColumn || 'id',
            });
          }
        }
      });
    });

    setTables(tableNodes);
    setConnections(tableConnections);
  }, [cluster, schema]);

  const getTableHeight = (table: TableNode) => {
    return TABLE_HEADER_HEIGHT + table.columns.length * TABLE_ROW_HEIGHT + 10;
  };

  const getConnectionPath = (conn: Connection): string => {
    const fromTable = tables.find(t => t.name === conn.from);
    const toTable = tables.find(t => t.name === conn.to);

    if (!fromTable || !toTable) return '';

    const fromHeight = getTableHeight(fromTable);
    const toHeight = getTableHeight(toTable);

    const fromX = fromTable.x + TABLE_WIDTH;
    const fromY = fromTable.y + fromHeight / 2;
    const toX = toTable.x;
    const toY = toTable.y + toHeight / 2;

    // Curved connection
    const midX = (fromX + toX) / 2;
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  const maxX = Math.max(...tables.map(t => t.x + TABLE_WIDTH)) + 50;
  const maxY = Math.max(...tables.map(t => t.y + getTableHeight(t))) + 50;

  return (
    <div className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${maxX || 800} ${maxY || 600}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Draw connections */}
        <g className="connections">
          {connections.map((conn, idx) => (
            <g key={idx}>
              <path
                d={getConnectionPath(conn)}
                stroke="#3b82f6"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
                opacity="0.6"
              />
            </g>
          ))}
        </g>

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
          </marker>
        </defs>

        {/* Draw tables */}
        <g className="tables">
          {tables.map((table) => {
            const tableHeight = getTableHeight(table);
            const isHovered = hoveredTable === table.name;
            const isHighlighted = highlightedTables.includes(table.name);
            const hasHighlighting = highlightedTables.length > 0;
            const isGreyedOut = hasHighlighting && !isHighlighted;

            return (
              <g
                key={table.name}
                transform={`translate(${table.x}, ${table.y})`}
                onMouseEnter={() => !isGreyedOut && setHoveredTable(table.name)}
                onMouseLeave={() => setHoveredTable(null)}
                onClick={() => clickableTables && !isGreyedOut && onTableClick?.(table.name)}
                className={clickableTables && !isGreyedOut ? 'cursor-pointer' : isGreyedOut ? 'cursor-not-allowed' : ''}
                opacity={isGreyedOut ? '0.3' : '1'}
              >
                {/* Table container */}
                <rect
                  width={TABLE_WIDTH}
                  height={tableHeight}
                  rx="8"
                  ry="8"
                  fill="white"
                  stroke={isHighlighted ? '#b20138' : isHovered ? '#ec4f63' : '#d1d5db'}
                  strokeWidth={isHighlighted ? '4' : isHovered ? '3' : '2'}
                  className="transition-all"
                  filter={isHighlighted || isHovered ? "url(#shadow)" : "none"}
                />

                {/* Highlight glow effect */}
                {isHighlighted && (
                  <rect
                    width={TABLE_WIDTH}
                    height={tableHeight}
                    rx="8"
                    ry="8"
                    fill="none"
                    stroke="#b20138"
                    strokeWidth="8"
                    opacity="0.2"
                    className="animate-pulse"
                  />
                )}

                {/* Table header */}
                <rect
                  width={TABLE_WIDTH}
                  height={TABLE_HEADER_HEIGHT}
                  rx="8"
                  ry="8"
                  fill={isHighlighted ? '#b20138' : '#ec4f63'}
                  opacity="0.1"
                />
                <rect
                  y={TABLE_HEADER_HEIGHT}
                  width={TABLE_WIDTH}
                  height="2"
                  fill={isHighlighted ? '#b20138' : '#ec4f63'}
                />

                {/* Table name */}
                <text
                  x={TABLE_WIDTH / 2}
                  y={TABLE_HEADER_HEIGHT / 2 + 5}
                  textAnchor="middle"
                  className="font-bold text-base"
                  fill="#1f2937"
                >
                  {table.name}
                </text>

                {/* Columns */}
                {table.columns.map((col, idx) => {
                  const yPos = TABLE_HEADER_HEIGHT + 10 + idx * TABLE_ROW_HEIGHT;
                  const isColumnHovered = hoveredColumn?.table === table.name && hoveredColumn?.column === col.name;
                  
                  return (
                    <g 
                      key={col.name}
                      onClick={(e) => {
                        if (clickableColumns && onColumnClick && !isGreyedOut) {
                          e.stopPropagation();
                          onColumnClick(table.name, col.name);
                        }
                      }}
                      onMouseEnter={() => clickableColumns && !isGreyedOut && setHoveredColumn({table: table.name, column: col.name})}
                      onMouseLeave={() => clickableColumns && setHoveredColumn(null)}
                      className={clickableColumns && !isGreyedOut ? 'cursor-pointer' : isGreyedOut ? 'cursor-not-allowed' : ''}
                    >
                      {/* Column background on hover */}
                      {(isHovered || isColumnHovered) && (
                        <rect
                          x="2"
                          y={yPos - 4}
                          width={TABLE_WIDTH - 4}
                          height={TABLE_ROW_HEIGHT - 2}
                          rx="4"
                          fill={isColumnHovered ? '#ffe4e6' : '#f3f4f6'}
                        />
                      )}
                      
                      {/* Column name */}
                      <text
                        x="12"
                        y={yPos + 12}
                        className="text-sm font-medium"
                        fill="#374151"
                      >
                        {col.name.length > 24 ? col.name.substring(0, 24) + '...' : col.name}
                      </text>
                      
                      {/* Data type */}
                      <text
                        x={TABLE_WIDTH - 70}
                        y={yPos + 12}
                        className="text-xs"
                        fill="#6b7280"
                      >
                        {col.dataType.length > 10 ? col.dataType.substring(0, 10) : col.dataType}
                      </text>
                      
                      {/* Key indicators */}
                      {col.isPrimaryKey && (
                        <text 
                          x={TABLE_WIDTH - 42} 
                          y={yPos + 12} 
                          className="text-xs"
                          textAnchor="middle"
                        >
                          🔑
                        </text>
                      )}
                      {col.isForeignKey && (
                        <text 
                          x={TABLE_WIDTH - 22} 
                          y={yPos + 12} 
                          className="text-xs"
                          textAnchor="middle"
                        >
                          🔗
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* Shadow filter definition */}
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>
      </svg>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-xs">
        <div className="font-semibold mb-2 text-gray-900 dark:text-white">Legend</div>
        <div className="space-y-1 text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>🔑</span>
            <span>Primary Key</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔗</span>
            <span>Foreign Key</span>
          </div>
        </div>
      </div>
    </div>
  );
}
