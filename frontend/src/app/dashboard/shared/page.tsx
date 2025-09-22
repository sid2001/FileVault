'use client'

import React, { useState } from 'react'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
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

// Using normal HTTP routes instead of GraphQL

// Using normal HTTP routes instead of GraphQL

export default function SharedPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'my-shared' | 'shared-with-me'>('my-shared')
  const [mySharedFiles, setMySharedFiles] = useState<any[]>([])
  const [filesSharedWithMe, setFilesSharedWithMe] = useState<any[]>([])
  const [mySharedLoading, setMySharedLoading] = useState(false)
  const [sharedWithMeLoading, setSharedWithMeLoading] = useState(false)

  // Using normal HTTP routes instead of GraphQL mutations

  // Fetch my shared files
  const fetchMySharedFiles = async () => {
    setMySharedLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shares/my-shared?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setMySharedFiles(data.shares || [])
      } else {
        console.error('Failed to fetch my shared files')
        setMySharedFiles([])
      }
    } catch (error) {
      console.error('Error fetching my shared files:', error)
      setMySharedFiles([])
    } finally {
      setMySharedLoading(false)
    }
  }

  // Fetch files shared with me
  const fetchFilesSharedWithMe = async () => {
    setSharedWithMeLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shares/shared-with-me?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setFilesSharedWithMe(data.shares || [])
      } else {
        console.error('Failed to fetch files shared with me')
        setFilesSharedWithMe([])
      }
    } catch (error) {
      console.error('Error fetching files shared with me:', error)
      setFilesSharedWithMe([])
    } finally {
      setSharedWithMeLoading(false)
    }
  }

  // Load data when component mounts
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchMySharedFiles()
      fetchFilesSharedWithMe()
    }
  }, [isAuthenticated])

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

  const filteredMyShared = mySharedFiles.filter((share: any) =>
    share.file.filename.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const filteredSharedWithMe = filesSharedWithMe.filter((share: any) =>
    share.file.filename.toLowerCase().includes(searchTerm.toLowerCase())
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shares/unshare/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (response.ok) {
        toast.success('File unshared successfully')
        fetchMySharedFiles()
        fetchFilesSharedWithMe()
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to unshare file')
      }
    } catch (error: any) {
      console.error('Unshare error:', error)
      toast.error(error.message || 'Failed to unshare file')
    }
  }

  const handleDownloadFile = async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shares/download/${fileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (response.ok) {
        // Check if response is JSON (error) or binary (file)
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          // It's an error response
          const errorData = await response.json()
          toast.error(errorData.error || 'Failed to download file')
        } else {
          // It's a file download
          const blob = await response.blob()
          
          // Create a download link
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          toast.success(`Downloaded ${filename}`)
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to download file')
      }
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(error.message || 'Failed to download file')
    }
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
            <p className="text-gray-600">Manage your file sharing</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('my-shared')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-shared'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Files I Shared ({mySharedFiles.length})
            </button>
            <button
              onClick={() => setActiveTab('shared-with-me')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'shared-with-me'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Files Shared With Me ({filesSharedWithMe.length})
            </button>
          </nav>
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
                      Files I Shared
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {mySharedFiles.length}
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
                      Shared With Me
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {filesSharedWithMe.length}
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
                      Total Downloads
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {mySharedFiles.reduce((sum: number, share: any) => sum + share.file.downloadCount, 0)}
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

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'my-shared' ? (
            /* Files I Shared */
            mySharedLoading ? (
              <div className="flex justify-center py-12">
                <div className="loading-spinner"></div>
              </div>
            ) : filteredMyShared.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {filteredMyShared.map((share: any) => (
                    <li key={share.id}>
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <ShareIcon className="h-8 w-8 text-blue-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {share.file.filename}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatBytes(share.file.fileContent.size)} • {share.file.fileContent.mimeType}
                            </div>
                            <div className="text-xs text-gray-400">
                              Shared {formatDate(share.createdAt)} • {share.file.downloadCount} downloads
                              {share.shareType === 'USER_SPECIFIC' && share.sharedWithUser && (
                                <span> • with {share.sharedWithUser.username}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyShareLink(share.file.id)}
                          >
                            <LinkIcon className="h-4 w-4 mr-1" />
                            Copy Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadFile(share.file.id, share.file.filename)}
                          >
                            <CloudArrowDownIcon className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnshareFile(share.file.id, share.file.filename)}
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
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No files shared</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by sharing a file from your files page.
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            /* Files Shared With Me */
            sharedWithMeLoading ? (
              <div className="flex justify-center py-12">
                <div className="loading-spinner"></div>
              </div>
            ) : filteredSharedWithMe.length > 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {filteredSharedWithMe.map((share: any) => (
                    <li key={share.id}>
                      <div className="px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <EyeIcon className="h-8 w-8 text-green-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {share.file.filename}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatBytes(share.file.fileContent.size)} • {share.file.fileContent.mimeType}
                            </div>
                            <div className="text-xs text-gray-400">
                              Shared by {share.file.user.username} on {formatDate(share.createdAt)}
                              {share.shareType === 'USER_SPECIFIC' && (
                                <span> • specifically with you</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadFile(share.file.id, share.file.filename)}
                          >
                            <CloudArrowDownIcon className="h-4 w-4 mr-1" />
                            Download
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
                  <EyeIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No files shared with you</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Files shared with you by other users will appear here.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
