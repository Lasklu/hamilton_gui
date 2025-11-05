'use client'

import { useState } from 'react'
import { ProgressBar } from '@/components/ProgressBar'
import { DatabaseUploadStep } from '@/components/steps/DatabaseUploadStep'
import { DatabaseClusteringStep } from '@/components/steps/DatabaseClusteringStep'
import { ConceptsStep } from '@/components/steps/ConceptsStep'
import type { ClusteringResult } from '@/lib/types'

const STEPS = [
  { id: 'upload', label: 'Upload Database' },
  { id: 'clustering', label: 'Review Clustering' },
  { id: 'concepts', label: 'Edit Concepts' },
  { id: 'attributes', label: 'Edit Attributes' },
  { id: 'relationships', label: 'Edit Relationships' },
  { id: 'export', label: 'Export Ontology' },
]

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0)
  const [databaseId, setDatabaseId] = useState<string | null>(null)
  const [clusteringResult, setClusteringResult] = useState<ClusteringResult | null>(null)
  const [useMockApi, setUseMockApi] = useState(true) // Debug mode toggle

  const handleDatabaseUploaded = (dbId: string) => {
    setDatabaseId(dbId)
    // Move to next step after successful upload
    setCurrentStep(1)
  }

  const handleClusteringComplete = (result: ClusteringResult) => {
    setClusteringResult(result)
  }

  const handleClusteringConfirm = () => {
    // Move to concepts step
    setCurrentStep(2)
  }

  const handleConceptsComplete = () => {
    // Move to attributes step
    setCurrentStep(3)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Debug Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow">
          <input
            type="checkbox"
            checked={useMockApi}
            onChange={(e) => setUseMockApi(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mock API Mode
          </span>
          {useMockApi && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded">
              DEBUG
            </span>
          )}
        </label>
      </div>

      {/* Progress Bar */}
      <ProgressBar steps={STEPS} currentStep={currentStep} />

      {/* Main Content */}
      <div className={currentStep === 0 ? "max-w-7xl mx-auto px-4 py-8" : ""}>
        {currentStep === 0 && (
          <DatabaseUploadStep onSuccess={handleDatabaseUploaded} useMockApi={useMockApi} />
        )}

        {currentStep === 1 && databaseId && (
          <DatabaseClusteringStep
            databaseId={databaseId}
            useMockApi={useMockApi}
            onComplete={handleClusteringComplete}
            onConfirm={handleClusteringConfirm}
          />
        )}

        {/* Concepts Step */}
        {currentStep === 2 && databaseId && clusteringResult && (
          <ConceptsStep
            databaseId={databaseId}
            clusteringResult={clusteringResult}
            useMockApi={useMockApi}
            onComplete={handleConceptsComplete}
          />
        )}

        {/* Placeholder for other steps */}
        {currentStep > 2 && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4">
              Step {currentStep + 1}: {STEPS[currentStep].label}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              This step will be implemented next.
            </p>
            {databaseId && (
              <p className="mt-4 text-sm text-gray-500">
                Database ID: {databaseId}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
