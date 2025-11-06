'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Loading } from '@/components/ui/Loading';
import { JobProgressIndicator } from '@/components/ui/JobProgressIndicator';
import { apiClient, mockClient } from '@/lib/api/services';
import { useJobPolling } from '@/hooks/useJobPolling';
import type { Database, ClusteringResult, ClusterInfo } from '@/lib/types';
import dynamic from 'next/dynamic';

// Dynamically import the graph component (client-side only)
const ClusteringGraph = dynamic(() => import('@/components/clustering/ClusteringGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loading size="lg" />
    </div>
  ),
});

interface DatabaseClusteringStepProps {
  databaseId: string;
  useMockApi?: boolean;
  onComplete?: (clusteringResult: ClusteringResult) => void;
  onConfirm?: () => void;
}

type LoadingStage = 'creating' | 'clustering' | 'complete' | 'error';

// Cluster Card Component with Expand/Collapse and Drag & Drop
function ClusterCard({
  cluster,
  color,
  isExpanded,
  onToggle,
  onTableDrop,
  onNameChange,
  isEditing,
  onStartEdit,
  onConfirmEdit,
}: {
  cluster: ClusterInfo;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  onTableDrop: (tableName: string) => void;
  onNameChange: (name: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [editName, setEditName] = useState(cluster.name);

  useEffect(() => {
    setEditName(cluster.name);
  }, [cluster.name]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const tableName = e.dataTransfer.getData('tableName');
    if (tableName) {
      onTableDrop(tableName);
    }
  };

  const handleTableDragStart = (e: React.DragEvent, tableName: string) => {
    e.dataTransfer.setData('tableName', tableName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleConfirm = () => {
    onNameChange(editName);
    onConfirmEdit();
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isDragOver ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="text-left flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm font-semibold border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') onConfirmEdit();
                  }}
                />
                <button
                  onClick={handleConfirm}
                  className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                  title="Confirm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{cluster.name}</h4>
                <button
                  onClick={onStartEdit}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit name"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            {cluster.description && !isEditing && (
              <p className="text-xs text-gray-600 dark:text-gray-400">{cluster.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">{cluster.tables.length} tables</span>
          <button
            onClick={onToggle}
            className="p-1"
          >
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confidence Bar */}
      {cluster.confidence !== undefined && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Confidence</span>
            <span className="font-medium">{Math.round(cluster.confidence * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${cluster.confidence * 100}%`,
                backgroundColor: cluster.confidence > 0.8 ? '#10b981' : cluster.confidence > 0.5 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded Table List */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-1">
          {cluster.tables.map((table) => (
            <div
              key={table}
              draggable
              onDragStart={(e) => handleTableDragStart(e, table)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300 cursor-move hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm0 2h6v12H7V4z" />
              </svg>
              {table}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatabaseClusteringStep({
  databaseId,
  useMockApi = false,
  onComplete,
  onConfirm,
}: DatabaseClusteringStepProps) {
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('creating');
  const [database, setDatabase] = useState<Database | null>(null);
  const [clusteringResult, setClusteringResult] = useState<ClusteringResult | null>(null);
  const [modifiedClusters, setModifiedClusters] = useState<ClusterInfo[] | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());
  const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  const client = useMockApi ? mockClient : apiClient;

  // Poll job status
  const { status, progress, result, error: jobError } = useJobPolling(
    (id) => client.jobs.getStatus(id),
    {
      jobId,
      enabled: !!jobId && loadingStage === 'clustering',
      onComplete: (clusterResult: ClusteringResult) => {
        setClusteringResult(clusterResult);
        setModifiedClusters(clusterResult.clusters);
        setLoadingStage('complete');
        onComplete?.(clusterResult);
        toast.success('Clustering completed successfully!');
      },
      onError: (err) => {
        setError(err);
        setLoadingStage('error');
        toast.error(`Clustering failed: ${err}`);
      },
    }
  );

  // Cluster colors
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

  const initializeDatabase = useCallback(async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    try {
      setLoadingStage('creating');
      setError(null);

      // Step 1: Get the database details
      const dbData = await client.databases.get(databaseId);
      setDatabase(dbData);

      // Step 2: Start clustering job
      setLoadingStage('clustering');
      const jobResponse = await client.clustering.cluster(databaseId);
      setJobId(jobResponse.jobId);
      
      // Job polling will handle the rest
    } catch (err) {
      console.error('Error during database initialization:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoadingStage('error');
      toast.error('Failed to start clustering');
    }
  }, [databaseId, client]);

  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  const toggleCluster = (clusterId: number) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  const handleTableDrop = (tableName: string, targetClusterId: number) => {
    if (!modifiedClusters) return;

    // Find source cluster
    const sourceCluster = modifiedClusters.find((c) => c.tables.includes(tableName));
    if (!sourceCluster || sourceCluster.clusterId === targetClusterId) return;

    // Create new clusters array
    const newClusters = modifiedClusters.map((cluster) => {
      if (cluster.clusterId === sourceCluster.clusterId) {
        // Remove table from source cluster
        return {
          ...cluster,
          tables: cluster.tables.filter((t) => t !== tableName),
        };
      } else if (cluster.clusterId === targetClusterId) {
        // Add table to target cluster
        return {
          ...cluster,
          tables: [...cluster.tables, tableName],
        };
      }
      return cluster;
    });

    setModifiedClusters(newClusters);
    setHasChanges(true);
  };

  const handleAddCluster = () => {
    if (!modifiedClusters) return;

    // Find the next available cluster ID
    const maxId = Math.max(...modifiedClusters.map(c => c.clusterId), -1);
    const newClusterId = maxId + 1;

    const newCluster: ClusterInfo = {
      clusterId: newClusterId,
      name: 'New Cluster',
      description: '',
      tables: [],
      confidence: 0,
    };

    setModifiedClusters([...modifiedClusters, newCluster]);
    setExpandedClusters(prev => new Set([...prev, newClusterId]));
    setEditingClusterId(newClusterId);
    setHasChanges(true);
  };

  const handleClusterNameChange = (clusterId: number, newName: string) => {
    if (!modifiedClusters) return;

    setModifiedClusters(
      modifiedClusters.map((cluster) =>
        cluster.clusterId === clusterId
          ? { ...cluster, name: newName }
          : cluster
      )
    );
    setHasChanges(true);
  };

  const handleClusteringChange = useCallback((updatedClustering: ClusteringResult) => {
    setModifiedClusters(updatedClustering.clusters);
    setClusteringResult(updatedClustering);
    setHasChanges(true);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    setHasChanges(false);
  }, []);  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'creating':
        return 'Creating database and analyzing schema...';
      case 'clustering':
        return 'Running clustering algorithm on database tables...';
      case 'complete':
        return 'Clustering complete!';
      case 'error':
        return 'An error occurred';
      default:
        return 'Processing...';
    }
  };

  if (loadingStage === 'error') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Database Clustering</h2>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadingStage === 'creating' || loadingStage === 'clustering') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full p-8 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
          <div className="flex flex-col items-center justify-center space-y-6">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {loadingStage === 'creating' ? 'Loading Database' : 'Analyzing Database Structure'}
            </p>
            <JobProgressIndicator progress={progress} className="w-full" />
          </div>
        </div>
      </div>
    );
  }

  const displayClusters = modifiedClusters || clusteringResult?.clusters || [];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Database Clustering Results
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {useMockApi && (
                <span className="inline-block px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded mr-2">
                  MOCK MODE
                </span>
              )}
              {database?.name && `Database: ${database.name}`}
              {clusteringResult && ` • ${displayClusters.length} clusters identified`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph Area - Left Side */}
        <div className="flex-1 relative p-6">
          <div className="absolute inset-6 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
            {clusteringResult && database && (
              <ClusteringGraph
                clusteringResult={{
                  ...clusteringResult,
                  clusters: displayClusters,
                }}
                databaseId={databaseId}
                useMockApi={useMockApi}
                onClusteringChange={handleClusteringChange}
                onSaveSuccess={handleSaveSuccess}
              />
            )}
          </div>

          {/* Controls hint */}
          <div className="absolute top-10 left-10 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 z-10">
            <div className="font-semibold mb-2 text-gray-900 dark:text-white">Graph Controls</div>
            <div className="space-y-1">
              <div>🖱️ Scroll to zoom</div>
              <div>✋ Drag to pan</div>
              <div>👆 Hover nodes for details</div>
            </div>
          </div>
        </div>

        {/* Cluster Panel - Right Side */}
        <div className="w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cluster Management
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Expand clusters and drag tables to reorganize
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {displayClusters.map((cluster, index) => (
              <ClusterCard
                key={cluster.clusterId}
                cluster={cluster}
                color={CLUSTER_COLORS[cluster.clusterId % CLUSTER_COLORS.length]}
                isExpanded={expandedClusters.has(cluster.clusterId)}
                onToggle={() => toggleCluster(cluster.clusterId)}
                onTableDrop={(tableName) => handleTableDrop(tableName, cluster.clusterId)}
                isEditing={editingClusterId === cluster.clusterId}
                onStartEdit={() => setEditingClusterId(cluster.clusterId)}
                onConfirmEdit={() => setEditingClusterId(null)}
                onNameChange={(name) => handleClusterNameChange(cluster.clusterId, name)}
              />
            ))}
          </div>

          {/* Add Cluster Button */}
          <div className="px-4 pb-4 flex-shrink-0">
            <button
              onClick={handleAddCluster}
              className="w-full py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Cluster
            </button>
          </div>

          {/* Confirm & Continue Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <button
              onClick={onConfirm}
              disabled={hasChanges}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all shadow-sm ${
                !hasChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              title={hasChanges ? 'Please save your changes before continuing' : 'Continue to concept editing'}
            >
              <div className="flex items-center justify-center gap-2">
                {hasChanges ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Save Changes First
                  </>
                ) : (
                  <>
                    Confirm & Continue to Concepts
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
