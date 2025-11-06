'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Loading } from '@/components/ui/Loading';
import { JobProgressIndicator } from '@/components/ui/JobProgressIndicator';
import { TableClusterView } from '@/components/concepts/TableClusterView';
import { ConceptSuggestionView } from '@/components/concepts/ConceptSuggestionView';
import { ConceptOverview } from '@/components/concepts/ConceptOverview';
import { apiClient, mockClient } from '@/lib/api/services';
import { useJobPolling } from '@/hooks/useJobPolling';
import type { ClusteringResult, DatabaseSchema, Concept, ConceptSuggestion } from '@/lib/types';

interface ConceptsStepProps {
  databaseId: string;
  clusteringResult: ClusteringResult;
  useMockApi?: boolean;
  onComplete?: () => void;
  onConceptsUpdate?: (concepts: Record<string, { concepts: Concept[]; confirmed: boolean }>) => void;
}

type ProcessingState = 'idle' | 'generating' | 'complete';

interface ClusterConcepts {
  clusterId: number;
  concepts: Concept[];
  confirmed: boolean;
}

export function ConceptsStep({
  databaseId,
  clusteringResult,
  useMockApi = false,
  onComplete,
  onConceptsUpdate,
}: ConceptsStepProps) {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [currentClusterIndex, setCurrentClusterIndex] = useState(0);
  const [clusterConcepts, setClusterConcepts] = useState<Map<number, ClusterConcepts>>(new Map());
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);
  const [dialogHighlightedTables, setDialogHighlightedTables] = useState<string[]>([]);
  const [selectedTableForDialog, setSelectedTableForDialog] = useState<string | null>(null);
  const [selectedColumnForDialog, setSelectedColumnForDialog] = useState<string | null>(null);
  const [isDialogActive, setIsDialogActive] = useState(false);
  const hasInitialized = useRef(false);

  const client = useMockApi ? mockClient : apiClient;
  const currentCluster = clusteringResult.clusters[currentClusterIndex];

  // Poll job status for concept generation
  const { progress, result, error: jobError } = useJobPolling(
    (id) => client.jobs.getStatus(id),
    {
      jobId,
      enabled: !!jobId && processingState === 'generating',
      onComplete: (conceptResult: ConceptSuggestion) => {
        if (currentCluster) {
          const newClusterConcepts = new Map(clusterConcepts);
          newClusterConcepts.set(currentCluster.clusterId, {
            clusterId: currentCluster.clusterId,
            concepts: conceptResult.concepts,
            confirmed: false,
          });
          setClusterConcepts(newClusterConcepts);
          setProcessingState('complete');
          setJobId(null);
        }
      },
      onError: (error) => {
        toast.error(`Failed to generate concepts: ${error}`);
        setProcessingState('idle');
        setJobId(null);
      },
    }
  );

  // Fetch schema
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const schemaData = await client.databases.getSchema(databaseId);
        setSchema(schemaData);
      } catch (error) {
        console.error('Error fetching schema:', error);
        toast.error('Failed to load database schema');
      }
    };

    fetchSchema();
  }, [databaseId, client]);

  // Sync concepts to parent component
  useEffect(() => {
    if (onConceptsUpdate && clusterConcepts.size > 0) {
      const conceptsRecord: Record<string, { concepts: Concept[]; confirmed: boolean }> = {};
      clusterConcepts.forEach((value, key) => {
        conceptsRecord[key.toString()] = {
          concepts: value.concepts,
          confirmed: value.confirmed,
        };
      });
      onConceptsUpdate(conceptsRecord);
    }
  }, [clusterConcepts, onConceptsUpdate]);

  // Auto-generate concepts for current cluster if not already generated
  useEffect(() => {
    if (!currentCluster || hasInitialized.current || processingState !== 'idle') return;
    
    const existingConcepts = clusterConcepts.get(currentCluster.clusterId);
    if (existingConcepts) {
      setProcessingState('complete');
      return;
    }

    // Start generating concepts
    const generateConcepts = async () => {
      try {
        setProcessingState('generating');
        const response = await client.concepts.generateConcepts(
          databaseId,
          currentCluster.clusterId
        );
        setJobId(response.jobId);
        hasInitialized.current = true;
      } catch (error) {
        console.error('Error starting concept generation:', error);
        toast.error('Failed to start concept generation');
        setProcessingState('idle');
      }
    };

    generateConcepts();
  }, [currentCluster, clusterConcepts, databaseId, client, processingState]);

  const handlePrevious = useCallback(() => {
    if (currentClusterIndex > 0) {
      setCurrentClusterIndex(currentClusterIndex - 1);
      setProcessingState('idle');
      hasInitialized.current = false;
    }
  }, [currentClusterIndex]);

  const handleNext = useCallback(() => {
    if (currentClusterIndex < clusteringResult.clusters.length - 1) {
      setCurrentClusterIndex(currentClusterIndex + 1);
      setProcessingState('idle');
      hasInitialized.current = false;
    }
  }, [currentClusterIndex, clusteringResult.clusters.length]);

  const handleConfirmCluster = useCallback(async () => {
    if (!currentCluster) return;

    const concepts = clusterConcepts.get(currentCluster.clusterId);
    if (!concepts) return;

    try {
      await client.concepts.saveConcepts(
        databaseId,
        currentCluster.clusterId,
        { concepts: concepts.concepts }
      );

      // Mark as confirmed
      const updatedConcepts = new Map(clusterConcepts);
      updatedConcepts.set(currentCluster.clusterId, {
        ...concepts,
        confirmed: true,
      });
      setClusterConcepts(updatedConcepts);

      toast.success(`Concepts for ${currentCluster.name} confirmed`);

      // Move to next cluster if available
      if (currentClusterIndex < clusteringResult.clusters.length - 1) {
        handleNext();
      }
    } catch (error) {
      console.error('Error saving concepts:', error);
      toast.error('Failed to save concepts');
    }
  }, [currentCluster, clusterConcepts, databaseId, client, currentClusterIndex, clusteringResult.clusters.length, handleNext]);

  const handleSkipCluster = useCallback(() => {
    if (!currentCluster) return;

    // Mark cluster as confirmed with empty concepts (skipped)
    const updatedConcepts = new Map(clusterConcepts);
    updatedConcepts.set(currentCluster.clusterId, {
      clusterId: currentCluster.clusterId,
      concepts: [],
      confirmed: true,
    });
    setClusterConcepts(updatedConcepts);

    toast.success(`Skipped ${currentCluster.name}`);

    // Move to next cluster if available
    if (currentClusterIndex < clusteringResult.clusters.length - 1) {
      handleNext();
    }
  }, [currentCluster, clusterConcepts, currentClusterIndex, clusteringResult.clusters.length, handleNext]);

  const handleConfirmAllSuggested = useCallback(async () => {
    if (!currentCluster) return;

    const concepts = clusterConcepts.get(currentCluster.clusterId);
    if (!concepts) return;

    // Simply confirm without any changes - accept all suggested concepts as-is
    handleConfirmCluster();
  }, [currentCluster, clusterConcepts, handleConfirmCluster]);

  const handleConfirmAllClustersImmediately = useCallback(async () => {
    // Confirm all clusters immediately without requiring individual confirmation
    // This is useful in mock mode to quickly test the flow
    const updatedConcepts = new Map(clusterConcepts);
    
    // Mark all clusters as confirmed
    for (const cluster of clusteringResult.clusters) {
      const existingConcepts = updatedConcepts.get(cluster.clusterId);
      if (existingConcepts) {
        updatedConcepts.set(cluster.clusterId, {
          ...existingConcepts,
          confirmed: true,
        });
      }
    }
    
    setClusterConcepts(updatedConcepts);
    toast.success('All clusters confirmed immediately!');
    
    // Wait a moment then proceed
    setTimeout(() => {
      onComplete?.();
    }, 500);
  }, [clusterConcepts, clusteringResult.clusters, onComplete]);

  const handleConfirmAll = useCallback(async () => {
    // Check if all clusters have been confirmed
    const allConfirmed = clusteringResult.clusters.every(cluster => 
      clusterConcepts.get(cluster.clusterId)?.confirmed
    );

    if (!allConfirmed) {
      toast.error('Please confirm concepts for all clusters before proceeding');
      return;
    }

    toast.success('All concepts confirmed!');
    onComplete?.();
  }, [clusteringResult.clusters, clusterConcepts, onComplete]);

  if (!schema) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  const currentConcepts = currentCluster ? clusterConcepts.get(currentCluster.clusterId) : null;
  const allConfirmedConcepts: Concept[] = Array.from(clusterConcepts.values())
    .filter(cc => cc.confirmed)
    .flatMap(cc => cc.concepts);

  const confirmedCount = Array.from(clusterConcepts.values()).filter(cc => cc.confirmed).length;
  const totalClusters = clusteringResult.clusters.length;

  // Get tables referenced by the hovered concept
  const getHighlightedTables = (): string[] => {
    // Include tables from dialog highlights
    if (dialogHighlightedTables.length > 0) {
      return dialogHighlightedTables;
    }
    
    if (!hoveredConceptId || !currentConcepts) return [];
    
    const findConcept = (concepts: Concept[], id: string): Concept | null => {
      for (const concept of concepts) {
        if (concept.id === id) return concept;
        if (concept.subConcepts) {
          const found = findConcept(concept.subConcepts, id);
          if (found) return found;
        }
      }
      return null;
    };

    const concept = findConcept(currentConcepts.concepts, hoveredConceptId);
    if (!concept) return [];

    const tables = new Set<string>();
    
    // Add tables from ID attributes
    concept.idAttributes?.forEach(idAttr => {
      idAttr.attributes?.forEach(attr => {
        if (attr.table) tables.add(attr.table);
      });
    });

    // Add tables from regular attributes
    concept.attributes?.forEach(attr => {
      if (attr.table) tables.add(attr.table);
    });

    return Array.from(tables);
  };

  // Handlers for dialog interactions
  const handleTableClick = (tableName: string) => {
    if (isDialogActive) {
      setSelectedTableForDialog(tableName);
      setSelectedColumnForDialog(null); // Reset column when table changes
    }
  };

  const handleColumnClick = (tableName: string, columnName: string) => {
    if (isDialogActive) {
      setSelectedTableForDialog(tableName);
      setSelectedColumnForDialog(columnName);
    }
  };

  const handleDialogOpen = () => {
    setIsDialogActive(true);
    setSelectedTableForDialog(null);
    setSelectedColumnForDialog(null);
  };

  const handleDialogClose = () => {
    setIsDialogActive(false);
    setSelectedTableForDialog(null);
    setSelectedColumnForDialog(null);
  };

  const handleConceptUpdate = (conceptId: string, updates: Partial<Concept>) => {
    if (!currentCluster || !currentConcepts) return;

    const updateConceptInList = (concepts: Concept[]): Concept[] => {
      return concepts.map(concept => {
        if (concept.id === conceptId) {
          return { ...concept, ...updates };
        }
        if (concept.subConcepts) {
          return {
            ...concept,
            subConcepts: updateConceptInList(concept.subConcepts)
          };
        }
        return concept;
      });
    };

    const updatedConcepts = updateConceptInList(currentConcepts.concepts);
    const newClusterConcepts = new Map(clusterConcepts);
    newClusterConcepts.set(currentCluster.clusterId, {
      ...currentConcepts,
      concepts: updatedConcepts
    });
    setClusterConcepts(newClusterConcepts);
  };

  const handleConceptDelete = (conceptId: string) => {
    if (!currentCluster || !currentConcepts) return;

    const deleteConceptFromList = (concepts: Concept[]): Concept[] => {
      return concepts.filter(concept => {
        if (concept.id === conceptId) return false;
        if (concept.subConcepts) {
          concept.subConcepts = deleteConceptFromList(concept.subConcepts);
        }
        return true;
      });
    };

    const updatedConcepts = deleteConceptFromList(currentConcepts.concepts);
    const newClusterConcepts = new Map(clusterConcepts);
    newClusterConcepts.set(currentCluster.clusterId, {
      ...currentConcepts,
      concepts: updatedConcepts
    });
    setClusterConcepts(newClusterConcepts);
    toast.success('Concept deleted');
  };

  const handleConceptCreate = () => {
    if (!currentCluster || !currentConcepts) return;

    const newConcept: Concept = {
      id: `concept_${currentCluster.clusterId}_new_${Date.now()}`,
      name: 'New Concept',
      clusterId: currentCluster.clusterId,
      idAttributes: [],
      attributes: [],
      confidence: 0.5
    };

    const newClusterConcepts = new Map(clusterConcepts);
    newClusterConcepts.set(currentCluster.clusterId, {
      ...currentConcepts,
      concepts: [...currentConcepts.concepts, newConcept]
    });
    setClusterConcepts(newClusterConcepts);
    toast.success('New concept created');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header with Navigation */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Concept Builder
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Review and confirm concepts for each cluster
              </p>
            </div>
            <div className="flex items-center gap-3">
              {useMockApi && (
                <button
                  onClick={handleConfirmAllClustersImmediately}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg font-medium transition-colors shadow-sm"
                  title="Confirm all clusters immediately (Mock Mode)"
                >
                  ⚡ Confirm All Immediately
                </button>
              )}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Progress: {confirmedCount} / {totalClusters} clusters confirmed
              </div>
            </div>
          </div>

          {/* Cluster Navigation Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentClusterIndex === 0}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Cluster Pills */}
            <div className="flex-1 flex items-center gap-2 overflow-x-auto py-2">
              {clusteringResult.clusters.map((cluster, index) => {
                const concepts = clusterConcepts.get(cluster.clusterId);
                const isConfirmed = concepts?.confirmed || false;
                const isCurrent = index === currentClusterIndex;
                const hasProcessed = concepts !== undefined;

                return (
                  <button
                    key={cluster.clusterId}
                    onClick={() => {
                      setCurrentClusterIndex(index);
                      setProcessingState('idle');
                      hasInitialized.current = false;
                    }}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      isCurrent
                        ? 'bg-primary-500 text-white shadow-md'
                        : isConfirmed
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : hasProcessed
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{cluster.name}</span>
                      {isConfirmed && <span>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNext}
              disabled={currentClusterIndex === clusteringResult.clusters.length - 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left: Table Cluster View + Concept Suggestions */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Table Cluster Visualization */}
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentCluster?.name || 'Cluster'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentCluster?.tables.length || 0} table(s)
              </p>
            </div>
            <div className="h-[calc(100%-80px)]">
              {currentCluster && (
                <TableClusterView
                  cluster={currentCluster}
                  schema={schema}
                  highlightedTables={getHighlightedTables()}
                  onTableClick={handleTableClick}
                  onColumnClick={handleColumnClick}
                  clickableTables={isDialogActive}
                  clickableColumns={isDialogActive}
                  className="h-full"
                />
              )}
            </div>
          </div>

          {/* Concept Suggestions */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {processingState === 'generating' ? (
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="max-w-md w-full p-6">
                  <JobProgressIndicator progress={progress} className="w-full" />
                </div>
              </div>
            ) : processingState === 'complete' && currentConcepts ? (
              <>
                <ConceptSuggestionView
                  concepts={currentConcepts.concepts}
                  schema={schema}
                  onConceptHover={setHoveredConceptId}
                  onConceptUpdate={handleConceptUpdate}
                  onConceptDelete={handleConceptDelete}
                  onConceptCreate={handleConceptCreate}
                  onTableHighlight={setDialogHighlightedTables}
                  onDialogOpen={handleDialogOpen}
                  onDialogClose={handleDialogClose}
                  selectedTable={selectedTableForDialog}
                  selectedColumn={selectedColumnForDialog}
                  onTableClick={handleTableClick}
                  onColumnClick={handleColumnClick}
                  className="flex-1 overflow-hidden"
                />
                {!currentConcepts.confirmed && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleSkipCluster}
                      className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors shadow-sm"
                    >
                      Skip Cluster
                    </button>
                    <button
                      onClick={handleConfirmAllSuggested}
                      className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                      Confirm As Suggested
                    </button>
                  </div>
                )}
                {currentConcepts.confirmed && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center text-green-800 dark:text-green-200 font-medium">
                    ✓ Concepts Confirmed
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <Loading size="lg" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Concept Overview */}
        <div className="w-96 flex flex-col">
          <ConceptOverview
            allConcepts={allConfirmedConcepts}
            className="flex-1 overflow-hidden"
          />
          
          {/* Confirm All Button */}
          <button
            onClick={handleConfirmAll}
            disabled={confirmedCount < totalClusters}
            className={`mt-4 w-full py-3 px-4 rounded-lg font-medium transition-all shadow-sm ${
              confirmedCount === totalClusters
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title={confirmedCount < totalClusters ? 'Confirm all clusters first' : 'Proceed to next step'}
          >
            <div className="flex items-center justify-center gap-2">
              {confirmedCount === totalClusters ? (
                <>
                  Confirm All & Continue
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Confirm All Clusters ({confirmedCount}/{totalClusters})
                </>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
