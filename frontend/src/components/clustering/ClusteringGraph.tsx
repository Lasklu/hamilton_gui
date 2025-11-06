'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { apiClient, mockClient } from '@/lib/api/services';
import type { ClusteringResult, DatabaseSchema, TableMetadata, ClusterInfo } from '@/lib/types';

interface ClusteringGraphProps {
  clusteringResult: ClusteringResult;
  databaseId: string;
  useMockApi?: boolean;
  onClusteringChange?: (updatedClustering: ClusteringResult) => void;
  onSaveSuccess?: () => void;
}

interface TableNode {
  id: string;
  name: string;
  clusterId: number;
  color: string;
  columns: TableMetadata['columns'];
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
}

interface ClusterBox {
  clusterId: number;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tables: string[];
}

// Generate distinct colors for clusters
const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
];

const TABLE_WIDTH = 180;
const TABLE_HEIGHT = 120;
const TABLE_SPACING = 20;
const CLUSTER_PADDING = 30;
const CLUSTER_HEADER_HEIGHT = 40;
const CLUSTER_SPACING_X = 40;
const CLUSTER_SPACING_Y = 40;

export default function ClusteringGraph({
  clusteringResult,
  databaseId,
  useMockApi = false,
  onClusteringChange,
  onSaveSuccess,
}: ClusteringGraphProps) {
  const [tables, setTables] = useState<TableNode[]>([]);
  const [clusterBoxes, setClusterBoxes] = useState<ClusterBox[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<number | null>(null);
  const [draggedTable, setDraggedTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasChanges, setHasChanges] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const client = useMockApi ? mockClient : apiClient;

  // Fetch schema data
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const schemaData = await client.databases.getSchema(databaseId);
        setSchema(schemaData);
      } catch (error) {
        console.error('Error fetching schema:', error);
      }
    };

    fetchSchema();
  }, [databaseId, client]);

  // Build table nodes, cluster boxes, and connections
  useEffect(() => {
    if (!schema || !clusteringResult) return;

    const tableNodes: TableNode[] = [];
    const tableConnections: Connection[] = [];
    const boxes: ClusterBox[] = [];

    // Create a map of table name to cluster ID
    const tableToCluster = new Map<string, number>();
    clusteringResult.clusters.forEach((cluster) => {
      cluster.tables.forEach((tableName) => {
        tableToCluster.set(tableName, cluster.clusterId);
      });
    });

    let currentX = CLUSTER_SPACING_X;
    let currentY = CLUSTER_SPACING_Y;
    let maxRowHeight = 0;

    // Create cluster boxes with tables positioned inside
    clusteringResult.clusters.forEach((cluster, clusterIndex) => {
      const color = CLUSTER_COLORS[cluster.clusterId % CLUSTER_COLORS.length];
      const clusterTables = schema.tables.filter(t => cluster.tables.includes(t.name));
      
      if (clusterTables.length === 0) {
        // Empty cluster - create small placeholder box
        boxes.push({
          clusterId: cluster.clusterId,
          name: cluster.name,
          color,
          x: currentX,
          y: currentY,
          width: TABLE_WIDTH + CLUSTER_PADDING * 2,
          height: CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING * 2,
          tables: [],
        });
        
        currentX += TABLE_WIDTH + CLUSTER_PADDING * 2 + CLUSTER_SPACING_X;
        maxRowHeight = Math.max(maxRowHeight, CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING * 2);
        
        // Wrap to next row if needed
        if (currentX > 2000) {
          currentX = CLUSTER_SPACING_X;
          currentY += maxRowHeight + CLUSTER_SPACING_Y;
          maxRowHeight = 0;
        }
        return;
      }

      // Calculate grid layout for tables within cluster
      const tablesPerRow = Math.min(3, Math.ceil(Math.sqrt(clusterTables.length)));
      const numRows = Math.ceil(clusterTables.length / tablesPerRow);
      
      const clusterWidth = tablesPerRow * TABLE_WIDTH + (tablesPerRow - 1) * TABLE_SPACING + CLUSTER_PADDING * 2;
      const clusterHeight = CLUSTER_HEADER_HEIGHT + numRows * TABLE_HEIGHT + (numRows - 1) * TABLE_SPACING + CLUSTER_PADDING * 2;

      // Position tables within cluster
      clusterTables.forEach((table, tableIndex) => {
        const row = Math.floor(tableIndex / tablesPerRow);
        const col = tableIndex % tablesPerRow;
        
        const tableX = currentX + CLUSTER_PADDING + col * (TABLE_WIDTH + TABLE_SPACING);
        const tableY = currentY + CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING + row * (TABLE_HEIGHT + TABLE_SPACING);

        tableNodes.push({
          id: table.name,
          name: table.name,
          clusterId: cluster.clusterId,
          color,
          columns: table.columns,
          x: tableX,
          y: tableY,
        });

        // Create connections based on foreign keys
        table.columns.forEach((column) => {
          if (column.isForeignKey && column.foreignKeyReference) {
            const targetTable = column.foreignKeyReference.split('.')[0];
            if (schema.tables.some((t) => t.name === targetTable)) {
              tableConnections.push({
                from: table.name,
                to: targetTable,
              });
            }
          }
        });
      });

      boxes.push({
        clusterId: cluster.clusterId,
        name: cluster.name,
        color,
        x: currentX,
        y: currentY,
        width: clusterWidth,
        height: clusterHeight,
        tables: cluster.tables,
      });

      currentX += clusterWidth + CLUSTER_SPACING_X;
      maxRowHeight = Math.max(maxRowHeight, clusterHeight);

      // Wrap to next row every few clusters
      if (currentX > 2000) {
        currentX = CLUSTER_SPACING_X;
        currentY += maxRowHeight + CLUSTER_SPACING_Y;
        maxRowHeight = 0;
      }
    });

    setTables(tableNodes);
    setClusterBoxes(boxes);
    setConnections(tableConnections);

    // Calculate viewBox to fit all clusters
    if (boxes.length > 0) {
      const maxX = Math.max(...boxes.map(b => b.x + b.width)) + CLUSTER_SPACING_X;
      const maxY = Math.max(...boxes.map(b => b.y + b.height)) + CLUSTER_SPACING_Y;
      setViewBox({ x: 0, y: 0, width: maxX, height: maxY });
    }
  }, [schema, clusteringResult]);

  // Check if a point is inside a cluster box
  const getClusterAtPoint = useCallback((x: number, y: number): number | null => {
    for (const box of clusterBoxes) {
      if (x >= box.x && x <= box.x + box.width &&
          y >= box.y + CLUSTER_HEADER_HEIGHT && y <= box.y + box.height) {
        return box.clusterId;
      }
    }
    return null;
  }, [clusterBoxes]);

  // Handle table drag
  const handleTableMouseDown = useCallback(
    (e: React.MouseEvent, tableId: string) => {
      if (isPanning) return;
      e.stopPropagation();
      
      const svg = svgRef.current;
      if (!svg) return;

      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());

      const table = tables.find(t => t.id === tableId);
      if (!table) return;

      setDraggedTable(tableId);
      setDragOffset({
        x: svgPoint.x - table.x,
        y: svgPoint.y - table.y,
      });
    },
    [tables, isPanning]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      if (draggedTable) {
        const point = svg.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());

        const newX = svgPoint.x - dragOffset.x;
        const newY = svgPoint.y - dragOffset.y;

        // Check which cluster the table is over
        const targetClusterId = getClusterAtPoint(svgPoint.x, svgPoint.y);
        setHoveredCluster(targetClusterId);

        setTables((prev) =>
          prev.map((table) =>
            table.id === draggedTable
              ? {
                  ...table,
                  x: newX,
                  y: newY,
                }
              : table
          )
        );
      } else if (isPanning) {
        const dx = (e.clientX - panStart.x) * (viewBox.width / (containerRef.current?.clientWidth || 1));
        const dy = (e.clientY - panStart.y) * (viewBox.height / (containerRef.current?.clientHeight || 1));
        
        setViewBox(prev => ({
          ...prev,
          x: prev.x - dx,
          y: prev.y - dy,
        }));
        
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [draggedTable, dragOffset, isPanning, panStart, viewBox, getClusterAtPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (draggedTable && hoveredCluster !== null) {
      const table = tables.find(t => t.id === draggedTable);
      if (table && table.clusterId !== hoveredCluster) {
        // Table dropped into a different cluster - update the clustering
        const newColor = CLUSTER_COLORS[hoveredCluster % CLUSTER_COLORS.length];
        
        // Update table's cluster and color
        setTables((prev) =>
          prev.map((t) =>
            t.id === draggedTable
              ? { ...t, clusterId: hoveredCluster, color: newColor }
              : t
          )
        );

        // Update cluster boxes to reflect the change
        setClusterBoxes((prev) => {
          const updatedBoxes = prev.map((box) => {
            if (box.clusterId === table.clusterId) {
              // Remove table from old cluster
              return {
                ...box,
                tables: box.tables.filter((t) => t !== draggedTable),
              };
            } else if (box.clusterId === hoveredCluster) {
              // Add table to new cluster
              return {
                ...box,
                tables: [...box.tables, draggedTable],
              };
            }
            return box;
          });

          // Recalculate positions and sizes for affected clusters
          return recalculateClusterLayout(updatedBoxes, prev);
        });

        setHasChanges(true);
      }
    }
    setDraggedTable(null);
    setHoveredCluster(null);
    setIsPanning(false);
  }, [draggedTable, hoveredCluster, tables]);

  // Recalculate cluster box sizes and table positions
  const recalculateClusterLayout = useCallback((updatedBoxes: ClusterBox[], originalBoxes: ClusterBox[]) => {
    const newBoxes: ClusterBox[] = [];
    const newTablePositions: Map<string, { x: number, y: number }> = new Map();
    
    let currentX = CLUSTER_SPACING_X;
    let currentY = CLUSTER_SPACING_Y;
    let maxRowHeight = 0;

    updatedBoxes.forEach((box) => {
      const tableCount = box.tables.length;
      
      if (tableCount === 0) {
        // Empty cluster - create small placeholder box
        newBoxes.push({
          ...box,
          x: currentX,
          y: currentY,
          width: TABLE_WIDTH + CLUSTER_PADDING * 2,
          height: CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING * 2,
        });
        
        currentX += TABLE_WIDTH + CLUSTER_PADDING * 2 + CLUSTER_SPACING_X;
        maxRowHeight = Math.max(maxRowHeight, CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING * 2);
        
        if (currentX > 2000) {
          currentX = CLUSTER_SPACING_X;
          currentY += maxRowHeight + CLUSTER_SPACING_Y;
          maxRowHeight = 0;
        }
        return;
      }

      // Calculate grid layout for tables within cluster
      const tablesPerRow = Math.min(3, Math.ceil(Math.sqrt(tableCount)));
      const numRows = Math.ceil(tableCount / tablesPerRow);
      
      const clusterWidth = tablesPerRow * TABLE_WIDTH + (tablesPerRow - 1) * TABLE_SPACING + CLUSTER_PADDING * 2;
      const clusterHeight = CLUSTER_HEADER_HEIGHT + numRows * TABLE_HEIGHT + (numRows - 1) * TABLE_SPACING + CLUSTER_PADDING * 2;

      // Position tables within cluster in a grid
      box.tables.forEach((tableName, tableIndex) => {
        const row = Math.floor(tableIndex / tablesPerRow);
        const col = tableIndex % tablesPerRow;
        
        const tableX = currentX + CLUSTER_PADDING + col * (TABLE_WIDTH + TABLE_SPACING);
        const tableY = currentY + CLUSTER_HEADER_HEIGHT + CLUSTER_PADDING + row * (TABLE_HEIGHT + TABLE_SPACING);

        newTablePositions.set(tableName, { x: tableX, y: tableY });
      });

      newBoxes.push({
        ...box,
        x: currentX,
        y: currentY,
        width: clusterWidth,
        height: clusterHeight,
      });

      currentX += clusterWidth + CLUSTER_SPACING_X;
      maxRowHeight = Math.max(maxRowHeight, clusterHeight);

      if (currentX > 2000) {
        currentX = CLUSTER_SPACING_X;
        currentY += maxRowHeight + CLUSTER_SPACING_Y;
        maxRowHeight = 0;
      }
    });

    // Update table positions
    setTables((prevTables) =>
      prevTables.map((table) => {
        const newPos = newTablePositions.get(table.id);
        if (newPos) {
          return { ...table, x: newPos.x, y: newPos.y };
        }
        return table;
      })
    );

    // DON'T update viewBox - preserve current zoom/pan state

    return newBoxes;
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    
    setViewBox(prev => ({
      x: prev.x,
      y: prev.y,
      width: prev.width * scaleFactor,
      height: prev.height * scaleFactor,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!onClusteringChange) return;

    // Build updated clustering result from current state
    const updatedClusters: ClusterInfo[] = clusterBoxes.map((box) => ({
      clusterId: box.clusterId,
      name: box.name,
      description: clusteringResult.clusters.find(c => c.clusterId === box.clusterId)?.description || '',
      tables: box.tables,
      confidence: clusteringResult.clusters.find(c => c.clusterId === box.clusterId)?.confidence || 0.5,
    }));

    const updatedResult: ClusteringResult = {
      ...clusteringResult,
      clusters: updatedClusters,
    };

    try {
      // Call the API to save the clustering
      const result = await client.clustering.saveClustering(databaseId, updatedResult);
      
      // Show success toast
      toast.success(result.message || 'Clustering saved successfully!');
      
      // Notify parent component
      onClusteringChange(updatedResult);
      onSaveSuccess?.();
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save clustering:', error);
      toast.error('Failed to save clustering changes');
    }
  }, [clusterBoxes, clusteringResult, onClusteringChange, client, databaseId]);

  // Draw connection line between two tables
  const getConnectionPath = (from: string, to: string): string => {
    const fromTable = tables.find(t => t.id === from);
    const toTable = tables.find(t => t.id === to);

    if (!fromTable || !toTable) return '';

    const fromX = fromTable.x + TABLE_WIDTH;
    const fromY = fromTable.y + TABLE_HEIGHT / 2;
    const toX = toTable.x;
    const toY = toTable.y + TABLE_HEIGHT / 2;

    // Simple straight line
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gray-50 rounded-lg overflow-hidden relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleSvgMouseDown}
        onWheel={handleWheel}
      >
        {/* Draw cluster boxes */}
        <g className="cluster-boxes">
          {clusterBoxes.map((box) => (
            <g key={box.clusterId}>
              {/* Cluster box background */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx="12"
                ry="12"
                fill={box.color}
                opacity="0.05"
                stroke={box.color}
                strokeWidth={hoveredCluster === box.clusterId ? "4" : "2"}
                strokeDasharray={hoveredCluster === box.clusterId ? "none" : "8,4"}
                className="transition-all"
              />
              
              {/* Cluster header */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={CLUSTER_HEADER_HEIGHT}
                rx="12"
                ry="12"
                fill={box.color}
                opacity="0.15"
              />
              <rect
                x={box.x}
                y={box.y + CLUSTER_HEADER_HEIGHT}
                width={box.width}
                height="2"
                fill={box.color}
                opacity="0.3"
              />
              
              {/* Cluster name */}
              <text
                x={box.x + box.width / 2}
                y={box.y + CLUSTER_HEADER_HEIGHT / 2 + 5}
                textAnchor="middle"
                className="font-semibold text-base"
                fill={box.color}
              >
                {box.name}
              </text>
              
              {/* Table count */}
              <text
                x={box.x + 12}
                y={box.y + CLUSTER_HEADER_HEIGHT / 2 + 5}
                className="text-xs"
                fill={box.color}
                opacity="0.7"
              >
                {box.tables.length}
              </text>
            </g>
          ))}
        </g>

        {/* Draw connections */}
        <g className="connections">
          {connections.map((conn, idx) => (
            <g key={idx}>
              <path
                d={getConnectionPath(conn.from, conn.to)}
                stroke="#9ca3af"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#arrowhead)"
                opacity="0.4"
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
            <polygon points="0 0, 10 3, 0 6" fill="#9ca3af" />
          </marker>
        </defs>

        {/* Draw tables */}
        <g className="tables">
          {tables.map((table) => (
            <g
              key={table.id}
              transform={`translate(${table.x}, ${table.y})`}
              onMouseDown={(e) => handleTableMouseDown(e, table.id)}
              onMouseEnter={() => setHoveredTable(table.id)}
              onMouseLeave={() => setHoveredTable(null)}
              className="cursor-move"
              style={{ userSelect: 'none' }}
            >
              {/* Table rectangle */}
              <rect
                width={TABLE_WIDTH}
                height={TABLE_HEIGHT}
                rx="8"
                ry="8"
                fill="white"
                stroke={table.color}
                strokeWidth={hoveredTable === table.id ? "3" : "2"}
                className="transition-all"
                filter={hoveredTable === table.id ? "url(#shadow)" : "none"}
              />

              {/* Table header */}
              <rect
                width={TABLE_WIDTH}
                height="32"
                rx="8"
                ry="8"
                fill={table.color}
                opacity="0.2"
              />
              <rect
                y="32"
                width={TABLE_WIDTH}
                height="2"
                fill={table.color}
              />

              {/* Table name */}
              <text
                x={TABLE_WIDTH / 2}
                y="20"
                textAnchor="middle"
                className="font-semibold text-sm"
                fill="#1f2937"
              >
                {table.name}
              </text>

              {/* Column count */}
              <text
                x="12"
                y="52"
                className="text-xs"
                fill="#6b7280"
              >
                {table.columns.length} columns
              </text>

              {/* Show first few columns */}
              {table.columns.slice(0, 4).map((col, idx) => (
                <g key={idx}>
                  <text
                    x="12"
                    y={72 + idx * 16}
                    className="text-xs"
                    fill="#374151"
                  >
                    {col.name.length > 18 ? col.name.substring(0, 18) + '...' : col.name}
                  </text>
                  {col.isPrimaryKey && (
                    <text 
                      x={TABLE_WIDTH - 28} 
                      y={72 + idx * 16} 
                      className="text-xs"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      🔑
                    </text>
                  )}
                  {col.isForeignKey && (
                    <text 
                      x={TABLE_WIDTH - 14} 
                      y={72 + idx * 16} 
                      className="text-xs"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      🔗
                    </text>
                  )}
                </g>
              ))}

              {/* More columns indicator */}
              {table.columns.length > 4 && (
                <text
                  x="12"
                  y={72 + 4 * 16}
                  className="text-xs italic"
                  fill="#9ca3af"
                >
                  +{table.columns.length - 4} more...
                </text>
              )}
            </g>
          ))}
        </g>

        {/* Shadow filter definition */}
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>
      </svg>

      {/* Save button */}
      {hasChanges && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Clustering Changes
          </button>
        </div>
      )}
    </div>
  );
}
