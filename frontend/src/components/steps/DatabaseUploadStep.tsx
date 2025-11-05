'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { apiClient, mockClient } from '@/lib/api/services'
import type { Database } from '@/lib/types'

interface DatabaseUploadStepProps {
  onSuccess: (databaseId: string) => void
  useMockApi?: boolean
}

type Mode = 'upload' | 'connect' | 'select'
type UploadMethod = 'file' | 'text'

export function DatabaseUploadStep({ onSuccess, useMockApi = false }: DatabaseUploadStepProps) {
  const [mode, setMode] = useState<Mode>('upload')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sqlText, setSqlText] = useState('')
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('file')
  const [connectionString, setConnectionString] = useState('')
  const [existingDatabases, setExistingDatabases] = useState<Database[]>([])
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = useMockApi ? mockClient : apiClient

  // Load existing databases when switching to select mode
  useEffect(() => {
    const loadExistingDatabases = async () => {
      setIsLoadingDatabases(true)
      setError(null)
      try {
        const databases = await client.databases.list()
        setExistingDatabases(databases)
      } catch (err: any) {
        console.error('Failed to load databases:', err)
        setError('Failed to load existing databases. Please try again.')
      } finally {
        setIsLoadingDatabases(false)
      }
    }

    if (mode === 'select') {
      loadExistingDatabases()
    }
  }, [mode, client])

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter a database name')
      return
    }

    if (uploadMethod === 'file' && !file) {
      setError('Please select a SQL file')
      return
    }

    if (uploadMethod === 'text' && !sqlText.trim()) {
      setError('Please enter SQL content')
      return
    }

    setIsUploading(true)

    try {
      let database
      if (uploadMethod === 'file' && file) {
        database = await client.databases.create(name, file)
      } else {
        database = await client.databases.createFromText(name, sqlText)
      }

      // Success! Move to next step
      onSuccess(database.id)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(
        err.response?.data?.message ||
          'Failed to upload database. Please try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter a database name')
      return
    }

    if (!connectionString.trim()) {
      setError('Please enter a connection string')
      return
    }

    setIsUploading(true)

    try {
      const database = await client.databases.connect(name, connectionString)
      
      // Success! Move to next step
      onSuccess(database.id)
    } catch (err: any) {
      console.error('Connection error:', err)
      setError(
        err.response?.data?.message ||
          'Failed to connect to database. Please check your connection string and try again.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectDatabase = () => {
    if (!selectedDatabaseId) {
      setError('Please select a database')
      return
    }

    // Success! Move to next step with selected database
    onSuccess(selectedDatabaseId)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Welcome to Hamilton
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Transform your relational database schema into a meaningful ontology.
          Let's start by uploading your SQL database script.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-3 mb-6">
          <Button
            type="button"
            variant={mode === 'upload' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('upload')
              setError(null)
            }}
            disabled={isUploading}
            className="flex-1"
          >
            Upload Schema
          </Button>
          <Button
            type="button"
            variant={mode === 'connect' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('connect')
              setError(null)
            }}
            disabled={isUploading}
            className="flex-1"
          >
            Connect Database
          </Button>
          <Button
            type="button"
            variant={mode === 'select' ? 'primary' : 'outline'}
            onClick={() => {
              setMode('select')
              setError(null)
            }}
            disabled={isUploading}
            className="flex-1"
          >
            Select Existing
          </Button>
        </div>
      </div>

      {/* Upload Mode */}
      {mode === 'upload' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Upload Database Schema</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Provide your SQL database schema (DDL/DML statements) to begin the
              ontology learning process.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFileUpload} className="space-y-6">
              {/* Database Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
                >
                  Database Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., my-ecommerce-db"
                  disabled={isUploading}
                  required
                />
              </div>

              {/* Upload Method Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Upload Method
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={uploadMethod === 'file' ? 'primary' : 'outline'}
                    onClick={() => setUploadMethod('file')}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMethod === 'text' ? 'primary' : 'outline'}
                    onClick={() => setUploadMethod('text')}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    Paste SQL
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              {uploadMethod === 'file' && (
                <div>
                  <label
                    htmlFor="file"
                    className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
                  >
                    SQL File
                  </label>
                  <Input
                    id="file"
                    type="file"
                    accept=".sql,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={isUploading}
                    required={uploadMethod === 'file'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Accepted formats: .sql, .txt
                  </p>
                </div>
              )}

              {/* Text Input */}
              {uploadMethod === 'text' && (
                <div>
                  <label
                    htmlFor="sqlText"
                    className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
                  >
                    SQL Content
                  </label>
                  <textarea
                    id="sqlText"
                    value={sqlText}
                    onChange={(e) => setSqlText(e.target.value)}
                    placeholder="Paste your SQL DDL/DML statements here..."
                    disabled={isUploading}
                    required={uploadMethod === 'text'}
                    rows={10}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950"
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  'Upload and Continue'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Connect Mode */}
      {mode === 'connect' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Connect to Database</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Connect directly to your database using a connection string. We'll extract the schema automatically.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-6">
              {/* Database Name */}
              <div>
                <label
                  htmlFor="connect-name"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
                >
                  Database Name
                </label>
                <Input
                  id="connect-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., my-production-db"
                  disabled={isUploading}
                  required
                />
              </div>

              {/* Connection String */}
              <div>
                <label
                  htmlFor="connectionString"
                  className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
                >
                  Connection String
                </label>
                <Input
                  id="connectionString"
                  type="text"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  placeholder="postgresql://user:password@host:5432/dbname"
                  disabled={isUploading}
                  required
                />
                <p className="mt-2 text-xs text-gray-500">
                  Examples:
                </p>
                <ul className="mt-1 text-xs text-gray-500 space-y-1 ml-4">
                  <li>• PostgreSQL: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">postgresql://user:pass@host:5432/db</code></li>
                  <li>• MySQL: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">mysql://user:pass@host:3306/db</code></li>
                  <li>• SQLite: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">sqlite:///path/to/database.db</code></li>
                </ul>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Connecting...
                  </>
                ) : (
                  'Connect and Continue'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Select Mode */}
      {mode === 'select' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Select Existing Database</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Choose from databases you've previously uploaded or connected.
            </p>
          </CardHeader>
          <CardContent>
            {isLoadingDatabases ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading databases...</span>
              </div>
            ) : existingDatabases.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No databases found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  You haven't uploaded or connected any databases yet.
                </p>
                <div className="mt-6 flex gap-3 justify-center">
                  <Button
                    onClick={() => setMode('upload')}
                    variant="primary"
                  >
                    Upload Schema
                  </Button>
                  <Button
                    onClick={() => setMode('connect')}
                    variant="outline"
                  >
                    Connect Database
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Database List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {existingDatabases.map((db) => (
                    <label
                      key={db.id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDatabaseId === db.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="database"
                        value={db.id}
                        checked={selectedDatabaseId === db.id}
                        onChange={(e) => setSelectedDatabaseId(e.target.value)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {db.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(db.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ID: {db.id}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div className="ml-3">
                        <p className="text-sm text-red-800 dark:text-red-200">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Continue Button */}
                <Button
                  onClick={handleSelectDatabase}
                  className="w-full"
                  size="lg"
                  disabled={!selectedDatabaseId}
                >
                  Continue with Selected Database
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Section */}
      <Card className="max-w-2xl mx-auto bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                What happens next?
              </h3>
              <ul className="mt-2 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Your database schema will be analyzed</li>
                <li>• Tables will be automatically clustered</li>
                <li>• You'll review and refine the clustering</li>
                <li>• Concepts and relationships will be generated</li>
                <li>• Finally, you'll export your ontology</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
