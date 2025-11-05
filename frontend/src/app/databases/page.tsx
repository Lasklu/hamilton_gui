'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export default function DatabasesPage() {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement database upload using apiClient
    console.log('Upload database:', { name, file })
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Database Management</h1>

        <Card>
          <CardHeader>
            <CardTitle>Upload Database Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Database Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-database"
                  required
                />
              </div>

              <div>
                <label htmlFor="file" className="block text-sm font-medium mb-1">
                  SQL File
                </label>
                <Input
                  id="file"
                  type="file"
                  accept=".sql"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Upload Database
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* TODO: Add database list */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Your Databases</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Database list will appear here after implementation.
          </p>
        </div>
      </div>
    </div>
  )
}
