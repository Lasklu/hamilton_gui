'use client'

import { useState, useEffect, useRef } from 'react'
import { ProgressBar } from '@/components/ProgressBar'
import { DatabaseUploadStep } from '@/components/steps/DatabaseUploadStep'
import { DatabaseClusteringStep } from '@/components/steps/DatabaseClusteringStep'
import { ConceptsStep } from '@/components/steps/ConceptsStep'
import { AttributesStep } from '@/components/steps/AttributesStep'
import { RelationshipsStep } from '@/components/steps/RelationshipsStep'
import type { ClusteringResult, Concept } from '@/lib/types'

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
  const [concepts, setConcepts] = useState<Record<string, { concepts: Concept[]; confirmed: boolean }>>({})
  const [useMockApi, setUseMockApi] = useState(true) // Debug mode toggle
  const [showProgressBar, setShowProgressBar] = useState(true)
  const progressBarRef = useRef<HTMLDivElement>(null)

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

  const handleConceptsUpdate = (updatedConcepts: Record<string, { concepts: Concept[]; confirmed: boolean }>) => {
    setConcepts(updatedConcepts)
  }

  const handleAttributesComplete = () => {
    // Move to relationships step
    setCurrentStep(4)
  }

  const handleStepClick = (stepIndex: number) => {
    // Only allow going back to completed steps
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex)
      // Show progress bar when navigating away from concepts step
      if (stepIndex !== 2) {
        setShowProgressBar(true)
      }
    }
  }

  // Show/hide progress bar for concepts, attributes, and relationships steps (steps 2, 3, and 4)
  const isConceptsStep = currentStep === 2
  const isAttributesStep = currentStep === 3
  const isRelationshipsStep = currentStep === 4
  const shouldHideProgressBar = isConceptsStep || isAttributesStep || isRelationshipsStep

  // Initialize progress bar as hidden on concepts, attributes, and relationships steps
  useEffect(() => {
    if (currentStep === 2 || currentStep === 3 || currentStep === 4) {
      setShowProgressBar(false)
    } else {
      setShowProgressBar(true)
    }
  }, [currentStep])

  // Click outside to hide progress bar on concepts and attributes steps
  useEffect(() => {
    if (!shouldHideProgressBar || !showProgressBar) return

    const handleClickOutside = (event: MouseEvent) => {
      if (progressBarRef.current && !progressBarRef.current.contains(event.target as Node)) {
        setShowProgressBar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shouldHideProgressBar, showProgressBar])

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Debug Mode Toggle - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50">
        <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow">
          <input
            type="checkbox"
            checked={useMockApi}
            onChange={(e) => setUseMockApi(e.target.checked)}
            className="w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
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

      {/* Progress Bar with toggle button on concepts and attributes steps */}
      {shouldHideProgressBar ? (
        <div>
          {/* Show Button - Minimal arrow pointing down */}
          {!showProgressBar && (
            <button
              onClick={() => setShowProgressBar(true)}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-40 bg-primary-500 hover:bg-primary-600 text-white p-1 rounded-b shadow-lg transition-colors"
              aria-label="Show progress bar"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          
          {/* Progress Bar - Overlaid when visible */}
          {showProgressBar && (
            <div ref={progressBarRef} className="fixed top-0 left-0 right-0 z-40 shadow-lg">
              <div className="relative">
                <ProgressBar 
                  steps={STEPS} 
                  currentStep={currentStep} 
                  onStepClick={handleStepClick}
                />
                {/* Hide Button - Minimal arrow pointing up */}
                <button
                  onClick={() => setShowProgressBar(false)}
                  className="absolute top-2 right-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-1 rounded shadow transition-colors"
                  aria-label="Hide progress bar"
                >
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ProgressBar 
          steps={STEPS} 
          currentStep={currentStep} 
          onStepClick={handleStepClick}
        />
      )}

      {/* Main Content */}
      <div className={
        currentStep === 0 
          ? "max-w-7xl mx-auto px-4 py-8" 
          : currentStep === 4 
            ? "flex flex-col h-screen" 
            : ""
      }>
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
            onConceptsUpdate={handleConceptsUpdate}
          />
        )}

        {/* Attributes Step */}
        {currentStep === 3 && databaseId && clusteringResult && (
          <AttributesStep
            databaseId={databaseId}
            clusteringResult={clusteringResult}
            concepts={concepts}
            useMockApi={useMockApi}
            onComplete={handleAttributesComplete}
          />
        )}

        {/* Relationships Step */}
        {currentStep === 4 && databaseId && clusteringResult && (
          <RelationshipsStep
            databaseId={databaseId}
            concepts={concepts}
            useMockApi={useMockApi}
            onComplete={() => setCurrentStep(5)}
          />
        )}

        {/* Placeholder for export step */}
        {currentStep > 4 && (
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
