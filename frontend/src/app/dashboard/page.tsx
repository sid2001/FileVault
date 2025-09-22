'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery } from '@apollo/client'
import { gql } from '@apollo/client'
import {
  DocumentIcon,
  FolderIcon,
  ShareIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

const STORAGE_STATS_QUERY = gql`
  query UserStorageStats {
    userStorageStats {
      totalUsed
      originalSize
      savedBytes
      savedPercentage
      fileCount
    }
  }
`

const RECENT_FILES_QUERY = gql`
  query Files($limit: Int) {
    files(limit: $limit) {
      id
      filename
      createdAt
      fileContent {
        size
        mimeType
      }
      isPublic
    }
  }
`

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  const { data: storageData } = useQuery(STORAGE_STATS_QUERY, {
    skip: !isAuthenticated,
  })

  const { data: recentFilesData } = useQuery(RECENT_FILES_QUERY, {
    variables: { limit: 5 },
    skip: !isAuthenticated,
  })

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const storageStats = storageData?.userStorageStats
  const recentFiles = recentFilesData?.files || []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome section */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username}!
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your files and folders from your secure vault.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DocumentIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Files
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {storageStats?.fileCount || 0}
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
                  <ChartBarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Storage Used
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {storageStats ? formatBytes(storageStats.totalUsed) : '0 Bytes'}
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
                  <CloudArrowUpIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Space Saved
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {storageStats ? formatBytes(storageStats.savedBytes) : '0 Bytes'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage overview */}
        {storageStats && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Storage Overview
              </h3>
              <div className="mt-5">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Used: {formatBytes(storageStats.totalUsed)}</span>
                  <span>Quota: {formatBytes(user?.storageQuota || 0)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(
                        (storageStats.totalUsed / (user?.storageQuota || 1)) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {storageStats.savedBytes > 0 && (
                    <span>Space saved through deduplication: {formatBytes(storageStats.savedBytes)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent files */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Files
            </h3>
            <div className="mt-5">
              {recentFiles.length > 0 ? (
                <div className="flow-root">
                  <ul className="-my-5 divide-y divide-gray-200">
                    {recentFiles.map((file: any) => (
                      <li key={file.id} className="py-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <DocumentIcon className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.filename}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatBytes(file.fileContent.size)} • {file.fileContent.mimeType}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {file.isPublic && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Public
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-6">
                  <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No files yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by uploading your first file.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
