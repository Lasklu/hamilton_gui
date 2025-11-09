'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { Concept, Relationship } from '@/lib/types'

interface RelationshipGraphViewProps {
  concepts: Concept[]
  relationships: Relationship[]
  onAddRelationship: (fromConceptId: string, toConceptId: string) => void
  onRemoveRelationship: (relationshipId: string) => void
}

interface NodePosition {
  x: number
  y: number
}

interface DragLine {
  fromConceptId: string
  x: number
  y: number
}

interface Transform {
  x: number
  y: number
  scale: number
}

interface DragNode {
  conceptId: string
  offsetX: number
  offsetY: number
}

// Get color based on confidence level
function getConfidenceColor(confidence?: number): { stroke: string; fill: string; label: string } {
  if (confidence === undefined) {
    return { stroke: '#9ca3af', fill: '#6b7280', label: 'gray' } // Gray for unknown
  }
  
  if (confidence >= 0.9) {
    return { stroke: '#10b981', fill: '#059669', label: 'green' } // High confidence - Green
  } else if (confidence >= 0.75) {
    return { stroke: '#3b82f6', fill: '#2563eb', label: 'blue' } // Good confidence - Blue
  } else if (confidence >= 0.6) {
    return { stroke: '#f59e0b', fill: '#d97706', label: 'amber' } // Medium confidence - Amber
  } else {
    return { stroke: '#ef4444', fill: '#dc2626', label: 'red' } // Low confidence - Red
  }
}

export function RelationshipGraphView({
  concepts,
  relationships,
  onAddRelationship,
  onRemoveRelationship,
}: RelationshipGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null)
  const [dragLine, setDragLine] = useState<DragLine | null>(null)
  const [dragNode, setDragNode] = useState<DragNode | null>(null)
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Calculate initial positions in a circular layout with much better spacing
  useEffect(() => {
    if (concepts.length === 0) return

    const positions = new Map<string, NodePosition>()
    const centerX = svgDimensions.width / 2
    const centerY = svgDimensions.height / 2
    
    // Much larger spacing - ensure nodes are at least 200px apart
    const minSpacing = 200
    const minRadius = (concepts.length * minSpacing) / (2 * Math.PI)
    // Use larger base radius and ensure plenty of space
    const baseRadius = Math.min(centerX, centerY) * 0.7
    const radius = Math.max(baseRadius, minRadius, 300) // Minimum 300px radius

    concepts.forEach((concept, index) => {
      const angle = (2 * Math.PI * index) / concepts.length - Math.PI / 2
      positions.set(concept.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      })
    })

    setNodePositions(positions)
  }, [concepts, svgDimensions])

  // Update SVG dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setSvgDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Convert screen coordinates to SVG coordinates considering transform
  const screenToSvg = (screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (screenX - rect.left - transform.x) / transform.scale,
      y: (screenY - rect.top - transform.y) / transform.scale,
    }
  }

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0 && !dragLine && !dragNode && e.target === svgRef.current) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setTransform({
        ...transform,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    } else if (dragNode) {
      // Dragging a node
      const svgCoords = screenToSvg(e.clientX, e.clientY)
      const newPositions = new Map(nodePositions)
      newPositions.set(dragNode.conceptId, {
        x: svgCoords.x,
        y: svgCoords.y,
      })
      setNodePositions(newPositions)
    } else if (dragLine && svgRef.current) {
      const svgCoords = screenToSvg(e.clientX, e.clientY)
      setDragLine({
        ...dragLine,
        x: svgCoords.x,
        y: svgCoords.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    setDragNode(null)
  }

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, transform.scale * delta))
    
    // Zoom towards mouse position
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale)
      const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale)
      
      setTransform({ x: newX, y: newY, scale: newScale })
    }
  }

  const zoomIn = () => {
    const newScale = Math.min(5, transform.scale * 1.2)
    const centerX = svgDimensions.width / 2
    const centerY = svgDimensions.height / 2
    setTransform({
      x: centerX - (centerX - transform.x) * (newScale / transform.scale),
      y: centerY - (centerY - transform.y) * (newScale / transform.scale),
      scale: newScale,
    })
  }

  const zoomOut = () => {
    const newScale = Math.max(0.1, transform.scale * 0.8)
    const centerX = svgDimensions.width / 2
    const centerY = svgDimensions.height / 2
    setTransform({
      x: centerX - (centerX - transform.x) * (newScale / transform.scale),
      y: centerY - (centerY - transform.y) * (newScale / transform.scale),
      scale: newScale,
    })
  }

  const resetZoom = () => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  const handleNodeClick = (conceptId: string) => {
    if (dragLine) {
      // Completing a drag - create relationship
      if (dragLine.fromConceptId !== conceptId) {
        onAddRelationship(dragLine.fromConceptId, conceptId)
      }
      setDragLine(null)
    } else if (!dragNode) {
      // Starting a relationship drag
      const pos = nodePositions.get(conceptId)
      if (pos) {
        setDragLine({ fromConceptId: conceptId, x: pos.x, y: pos.y })
      }
    }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, conceptId: string) => {
    if (e.shiftKey) {
      // Shift+Click to move node
      e.stopPropagation()
      const pos = nodePositions.get(conceptId)
      if (pos) {
        const svgCoords = screenToSvg(e.clientX, e.clientY)
        setDragNode({
          conceptId: conceptId,
          offsetX: pos.x - svgCoords.x,
          offsetY: pos.y - svgCoords.y,
        })
      }
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setDragLine(null)
    }
  }

  const getConceptById = (id: string) => concepts.find(c => c.id === id)

  const hoveredConceptData = hoveredConcept ? getConceptById(hoveredConcept) : null

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* Confidence Legend */}
      <div className="absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Confidence</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">High (≥90%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Good (75-89%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-amber-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Medium (60-74%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Low (&lt;60%)</span>
          </div>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={zoomOut}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={resetZoom}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Reset Zoom"
        >
          <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-700 dark:text-gray-300">
          {Math.round(transform.scale * 100)}%
        </div>
      </div>

      {/* Graph SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : dragLine ? 'crosshair' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCancel}
        onWheel={handleWheel}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
        {/* Define shadow filters */}
        <defs>
          {/* Shadow filter */}
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Render relationship lines */}
        {relationships.map((rel) => {
          const fromPos = nodePositions.get(rel.fromConceptId)
          const toPos = nodePositions.get(rel.toConceptId)
          if (!fromPos || !toPos) return null

          // Calculate angle and offset to avoid overlapping with nodes
          const dx = toPos.x - fromPos.x
          const dy = toPos.y - fromPos.y
          const angle = Math.atan2(dy, dx)
          const distance = Math.sqrt(dx * dx + dy * dy)
          const nodeRadius = 50 // Account for node size
          
          const startX = fromPos.x + nodeRadius * Math.cos(angle)
          const startY = fromPos.y + nodeRadius * Math.sin(angle)
          const endX = toPos.x - nodeRadius * Math.cos(angle)
          const endY = toPos.y - nodeRadius * Math.sin(angle)

          const colors = getConfidenceColor(rel.confidence)

          return (
            <g key={rel.id}>
              {/* Arrow marker */}
              <defs>
                <marker
                  id={`arrowhead-${rel.id}`}
                  markerWidth="12"
                  markerHeight="12"
                  refX="11"
                  refY="6"
                  orient="auto"
                >
                  <path
                    d="M 0 0 L 12 6 L 0 12 z"
                    fill={colors.fill}
                    className="transition-colors"
                  />
                </marker>
              </defs>
              
              {/* Relationship line with shadow */}
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={colors.stroke}
                strokeWidth="3"
                strokeOpacity="0.8"
                markerEnd={`url(#arrowhead-${rel.id})`}
                className="hover:stroke-opacity-100 cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this relationship?')) {
                    onRemoveRelationship(rel.id)
                  }
                }}
              />
              
              {/* Confidence badge */}
              {rel.confidence !== undefined && (
                <g>
                  <rect
                    x={(fromPos.x + toPos.x) / 2 - 25}
                    y={(fromPos.y + toPos.y) / 2 - 12}
                    width="50"
                    height="24"
                    rx="12"
                    fill="white"
                    stroke={colors.stroke}
                    strokeWidth="2"
                    filter="url(#nodeShadow)"
                  />
                  <text
                    x={(fromPos.x + toPos.x) / 2}
                    y={(fromPos.y + toPos.y) / 2 + 5}
                    textAnchor="middle"
                    fontSize="13"
                    fill={colors.fill}
                    fontWeight="700"
                  >
                    {Math.round(rel.confidence * 100)}%
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Render drag line */}
        {dragLine && (
          <>
            <line
              x1={nodePositions.get(dragLine.fromConceptId)?.x || 0}
              y1={nodePositions.get(dragLine.fromConceptId)?.y || 0}
              x2={dragLine.x}
              y2={dragLine.y}
              stroke="#b20138"
              strokeWidth="3"
              strokeDasharray="8,4"
              strokeOpacity="0.8"
              className="pointer-events-none"
            />
            <circle
              cx={dragLine.x}
              cy={dragLine.y}
              r="6"
              fill="#b20138"
              className="pointer-events-none"
            />
          </>
        )}

        {/* Render concept nodes */}
        {concepts.map((concept) => {
          const pos = nodePositions.get(concept.id)
          if (!pos) return null

          const isHovered = hoveredConcept === concept.id
          const isDragging = dragLine?.fromConceptId === concept.id
          const isBeingMoved = dragNode?.conceptId === concept.id
          const radius = isHovered || isDragging || isBeingMoved ? 52 : 48

          return (
            <g key={concept.id}>
              {/* Node circle with solid color */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={isBeingMoved ? '#7f0127' : isDragging ? '#b20138' : isHovered ? '#d1004a' : '#e11d48'}
                stroke={isDragging || isBeingMoved ? '#ffffff' : isHovered ? '#f43f5e' : '#b20138'}
                strokeWidth={isDragging || isBeingMoved ? 4 : isHovered ? 3 : 2}
                filter="url(#nodeShadow)"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredConcept(concept.id)}
                onMouseLeave={() => setHoveredConcept(null)}
                onMouseDown={(e) => handleNodeMouseDown(e, concept.id)}
                onClick={(e) => {
                  e.stopPropagation()
                  handleNodeClick(concept.id)
                }}
              />
              
              {/* Inner circle for depth effect */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius - 4}
                fill="none"
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1"
                className="pointer-events-none"
              />
              
              {/* Concept name */}
              <text
                x={pos.x}
                y={pos.y - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="15"
                fontWeight="700"
                className="pointer-events-none select-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              >
                {concept.name?.slice(0, 12) || 'Unnamed'}
              </text>
              
              {/* Confidence badge */}
              {concept.confidence !== undefined && (
                <text
                  x={pos.x}
                  y={pos.y + 16}
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {Math.round(concept.confidence * 100)}%
                </text>
              )}
            </g>
          )
        })}
        </g>
      </svg>

      {/* Hover Card */}
      {hoveredConceptData && hoveredConcept && (
        <div
          className="absolute bg-white dark:bg-gray-800 border-2 border-primary-500 rounded-xl shadow-2xl p-5 max-w-sm z-10 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
          style={{
            left: Math.min(
              (nodePositions.get(hoveredConcept)?.x || 0) * transform.scale + transform.x + 70,
              svgDimensions.width - 280
            ),
            top: Math.min(
              (nodePositions.get(hoveredConcept)?.y || 0) * transform.scale + transform.y - 60,
              svgDimensions.height - 250
            ),
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {hoveredConceptData.name || 'Unnamed Concept'}
            </h3>
            {hoveredConceptData.confidence !== undefined && (
              <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-bold rounded-full shadow-sm">
                {Math.round(hoveredConceptData.confidence * 100)}%
              </span>
            )}
          </div>

          {/* ID Attributes */}
          {hoveredConceptData.idAttributes && hoveredConceptData.idAttributes.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                ID Attributes
              </h4>
              <div className="space-y-1.5 pl-3.5">
                {hoveredConceptData.idAttributes.map((idAttr, idx) => (
                  <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded">
                    {idAttr.attributes.map(attr => `${attr.table}.${attr.column}`).join(', ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attributes */}
          {hoveredConceptData.attributes && hoveredConceptData.attributes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                Attributes ({hoveredConceptData.attributes.length})
              </h4>
              <div className="space-y-1 max-h-36 overflow-y-auto pl-3.5 pr-1 custom-scrollbar">
                {hoveredConceptData.attributes.map((attr, idx) => (
                  <div key={idx} className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded">
                    {attr.table}.{attr.column}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions overlay */}
      {dragLine && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary-600 to-primary-500 text-white px-6 py-3 rounded-xl shadow-2xl border-2 border-white/20 backdrop-blur-sm z-20">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Click on another concept to create a relationship, or click anywhere else to cancel
          </p>
        </div>
      )}

      {/* Help text */}
      {!dragLine && !dragNode && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-lg text-xs backdrop-blur-sm">
          <span className="font-semibold">Tip:</span> Drag to pan • Scroll to zoom • Click node to start relationship • <span className="font-semibold">Shift+Drag</span> node to move
        </div>
      )}
    </div>
  )
}
