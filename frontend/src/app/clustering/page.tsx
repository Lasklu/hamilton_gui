'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function ClusteringPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Table Clustering</h1>

        <Card>
          <CardHeader>
            <CardTitle>Cluster Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select a database to analyze table groupings and relationships.
            </p>
            
            {/* TODO: Add database selector and clustering results */}
            <Button variant="outline">
              Select Database
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Clustering Results</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Clustering suggestions will appear here after running the analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
