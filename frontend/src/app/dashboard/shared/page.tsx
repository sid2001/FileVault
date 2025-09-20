'use client'

import { useState } from 'react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
import { gql } from '@apollo/client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  ShareIcon,
  LinkIcon,
  EyeIcon,
  TrashIcon,
  CloudArrowDownIcon,
  MagnifyingGlassIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const SHARED_FILES_QUERY = gql`
  query Files($filters: FileFiltersInput) {
    files(filters: $filters) {
      id
      filename
      createdAt
      isPublic
      downloadCount
      fileContent {
        id
        size
        mimeType
      }
      folder {
        id
        name
      }
    }
  }
`

const UNSHARE_FILE_MUTATION = gql`
  mutation UnshareFile($fileID: ID!) {
    unshareFile(fileID: $fileID)
  }
`

export default function SharedPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  const { data, loading: filesLoading, refetch } = useQuery(SHARED_FILES_QUERY, {
    variables: {
      filters: { isPublic: true },
    },
    skip: !isAuthenticated,
  })

  const [unshareFile] = useMutation(UNSHARE_FILE_MUTATION)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    router.push('/login')
    return null
  }

  const allFiles = data?.files || []
  const sharedFiles = allFiles.filter((file: any) => file.isPublic)
  const filteredFiles = sharedFiles.filter((file: any) =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleUnshareFile = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to unshare "${filename}"?`)) {
      return
    }

    try {
      await unshareFile({
        variables: { fileID: fileId },
      })
      toast.success('File unshared successfully')
      refetch()
    } catch (error: any) {
      console.error('Unshare error:', error)
      toast.error(error.message || 'Failed to unshare file')
    }
  }

  const handleDownloadFile = (fileId: string, filename: string) => {
    // This would typically make a request to get the download URL
    toast(`Downloading ${filename}...`)
  }

  const copyShareLink = (fileId: string) => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/shared/${fileId}`
      navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied to clipboard!')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shared Files</h1>
            <p className="text-gray-600">Files you've shared publicly</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShareIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Shared
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {sharedFiles.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <EyeIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Views
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {sharedFiles.reduce((sum: number, file: any) => sum + file.downloadCount, 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Recently Shared
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {sharedFiles.filter((file: any) => {
                        const fileDate = new Date(file.createdAt)
                        const weekAgo = new Date()
                        weekAgo.setDate(weekAgo.getDate() - 7)
                        return fileDate > weekAgo
                      }).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search shared files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        {/* Shared Files List */}
        {filesLoading ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredFiles.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredFiles.map((file: any) => (
                <li key={file.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ShareIcon className="h-8 w-8 text-green-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {file.filename}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatBytes(file.fileContent.size)} • {file.fileContent.mimeType}
                        </div>
                        <div className="text-xs text-gray-400">
                          Shared {formatDate(file.createdAt)} • {file.downloadCount} downloads
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyShareLink(file.id)}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadFile(file.id, file.filename)}
                      >
                        <CloudArrowDownIcon className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnshareFile(file.id, file.filename)}
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Unshare
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <ShareIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No shared files</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't shared any files yet. Go to your files and share them to make them public.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
