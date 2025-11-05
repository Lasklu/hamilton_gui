'use client';

import type { Concept } from '@/lib/types';

interface ConceptOverviewProps {
  allConcepts: Concept[];
  className?: string;
}

export function ConceptOverview({ allConcepts, className = '' }: ConceptOverviewProps) {
  // Group concepts by cluster
  const conceptsByCluster = allConcepts.reduce((acc, concept) => {
    if (!acc[concept.clusterId]) {
      acc[concept.clusterId] = [];
    }
    acc[concept.clusterId].push(concept);
    return acc;
  }, {} as Record<number, Concept[]>);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Concept Overview
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {allConcepts.length} concept(s) created from {Object.keys(conceptsByCluster).length} cluster(s)
        </p>
      </div>

      <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {allConcepts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-600 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No concepts created yet
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Process clusters to create concepts
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(conceptsByCluster)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([clusterId, concepts]) => (
                <div key={clusterId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Cluster Header */}
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cluster {clusterId}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {concepts.length} concept(s)
                      </span>
                    </div>
                  </div>

                  {/* Concepts List */}
                  <div className="p-3 space-y-2">
                    {concepts.map((concept) => (
                      <div
                        key={concept.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {concept.name || concept.id}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {concept.idAttributes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {concept.idAttributes[0].attributes.map((attr, idx) => (
                                  <span key={idx} className="font-mono">
                                    {attr.table}.{attr.column}
                                    {idx < concept.idAttributes[0].attributes.length - 1 && ', '}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {concept.confidence !== undefined && (
                          <div className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium ${
                            concept.confidence > 0.8
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {Math.round(concept.confidence * 100)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
