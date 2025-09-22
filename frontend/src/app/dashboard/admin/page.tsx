'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { gql } from '@apollo/client'
import { 
  UserIcon, 
  DocumentIcon, 
  EyeIcon, 
  CalendarIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  ShieldCheckIcon,
  TrashIcon,
  ArrowLeftIcon,
  XMarkIcon,
  InformationCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { FilePreview } from '@/components/ui/FilePreview'

// GraphQL queries
const ALL_FILES_QUERY = gql`
  query AllFiles($limit: Int, $offset: Int) {
    allFiles(limit: $limit, offset: $offset) {
      id
      filename
      isPublic
      downloadCount
      createdAt
      updatedAt
      user {
        id
        username
        email
        role
      }
      fileContent {
        id
        size
        mimeType
        sha256Hash
      }
      folder {
        id
        name
      }
    }
  }
`

const ALL_USERS_QUERY = gql`
  query Users($limit: Int, $offset: Int) {
    users(limit: $limit, offset: $offset) {
      id
      username
      email
      role
      storageQuota
      createdAt
      updatedAt
    }
  }
`

const STORAGE_STATS_QUERY = gql`
  query StorageStats {
    storageStats {
      totalUsed
      originalSize
      savedBytes
      savedPercentage
      userCount
      fileCount
    }
  }
`

const DELETE_FILE_MUTATION = gql`
  mutation DeleteFile($fileId: ID!) {
    deleteFile(fileId: $fileId)
  }
`

const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($limit: Int, $offset: Int) {
    auditLogs(limit: $limit, offset: $offset) {
      id
      action
      ipAddress
      userAgent
      createdAt
      user {
        id
        username
        email
        role
      }
      file {
        id
        filename
        fileContent {
          size
          mimeType
          sha256Hash
        }
      }
    }
  }
`

const DOWNLOAD_FILE_QUERY = gql`
  query DownloadFile($fileId: ID!) {
    downloadFile(id: $fileId)
  }
`

interface UserFile {
  id: string
  filename: string
  isPublic: boolean
  downloadCount: number
  createdAt: string
  updatedAt: string
  user: {
    id: string
    username: string
    email: string
    role: string
  }
  fileContent: {
    id: string
    size: number
    mimeType: string
    sha256Hash: string
  }
  folder?: {
    id: string
    name: string
  }
}

interface User {
  id: string
  username: string
  email: string
  role: string
  storageQuota: number
  createdAt: string
  updatedAt: string
}

interface StorageStats {
  totalUsed: number
  originalSize: number
  savedBytes: number
  savedPercentage: number
  userCount: number
  fileCount: number
}

interface AuditLog {
  id: string
  action: string
  ipAddress: string
  userAgent: string
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    role: string
  }
  file?: {
    id: string
    filename: string
    fileContent: {
      size: number
      mimeType: string
      sha256Hash: string
    }
  }
}

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'files' | 'folders' | 'users' | 'stats' | 'audit'>('files')
  const [filesPage, setFilesPage] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [auditPage, setAuditPage] = useState(0)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<UserFile | null>(null)
  const [isFileDetailsModalOpen, setIsFileDetailsModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<UserFile | null>(null)
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null)
  const [totalFiles, setTotalFiles] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const itemsPerPage = 10

  // Redirect if not admin
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Access denied. Admin privileges required.')
      window.location.href = '/dashboard'
    }
  }, [isAdmin, authLoading])

  const { data: filesData, loading: filesLoading, error: filesError, refetch: refetchFiles } = useQuery(ALL_FILES_QUERY, {
    variables: { limit: itemsPerPage, offset: filesPage * itemsPerPage },
    skip: !isAdmin || activeTab !== 'files',
    fetchPolicy: 'cache-and-network'
  })

  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery(ALL_USERS_QUERY, {
    variables: { limit: itemsPerPage, offset: usersPage * itemsPerPage },
    skip: !isAdmin || activeTab !== 'users',
    fetchPolicy: 'cache-and-network'
  })

  const { data: statsData, loading: statsLoading, error: statsError } = useQuery(STORAGE_STATS_QUERY, {
    skip: !isAdmin
  })

  const { data: auditData, loading: auditLoading, error: auditError } = useQuery(AUDIT_LOGS_QUERY, {
    variables: { limit: itemsPerPage, offset: auditPage * itemsPerPage },
    skip: !isAdmin || activeTab !== 'audit',
    fetchPolicy: 'cache-and-network'
  })

  const [deleteFile] = useMutation(DELETE_FILE_MUTATION, {
    refetchQueries: [
      { query: ALL_FILES_QUERY, variables: { limit: itemsPerPage, offset: filesPage * itemsPerPage } },
      { query: STORAGE_STATS_QUERY }
    ],
  })

  const [getDownloadUrl] = useLazyQuery(DOWNLOAD_FILE_QUERY)

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
      minute: '2-digit'
    })
  }

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return
    }

    setDeletingFileId(fileId)
    try {
      await deleteFile({
        variables: { fileId }
      })
      toast.success(`File "${filename}" deleted successfully`)
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(error.message || 'Failed to delete file')
    } finally {
      setDeletingFileId(null)
    }
  }

  const handleBackToDashboard = () => {
    window.location.href = '/dashboard'
  }

  const handleViewFileDetails = (file: UserFile) => {
    setSelectedFile(file)
    setIsFileDetailsModalOpen(true)
  }

  const handlePreviewFile = async (file: UserFile) => {
    try {
      console.log('Starting preview for file:', file)
      setSelectedFileForPreview(file)
      setIsPreviewModalOpen(true)
      
      // Reset download URL first
      setPreviewDownloadUrl(null)
      
      // Get download URL for preview
      console.log('Fetching download URL for file ID:', file.id)
      const { data, error } = await getDownloadUrl({
        variables: { fileId: file.id }
      })
      
      console.log('Download URL response:', data)
      console.log('Download URL error:', error)
      
      if (data?.downloadFile) {
        console.log('Setting download URL:', data.downloadFile)
        setPreviewDownloadUrl(data.downloadFile)
      } else {
        console.error('No download URL received')
        toast.error('Failed to get download URL')
      }
    } catch (error) {
      console.error('Error getting download URL:', error)
      toast.error('Failed to load file preview')
    }
  }

  const closeFileDetailsModal = () => {
    setSelectedFile(null)
    setIsFileDetailsModalOpen(false)
  }

  const handleFilesPageChange = (newPage: number) => {
    setFilesPage(newPage)
  }

  const handleUsersPageChange = (newPage: number) => {
    setUsersPage(newPage)
  }

  const handleAuditPageChange = (newPage: number) => {
    setAuditPage(newPage)
  }

  const totalFilesPages = Math.ceil(totalFiles / itemsPerPage)
  const totalUsersPages = Math.ceil(totalUsers / itemsPerPage)

  // Debug logging
  console.log('Pagination Debug:', {
    totalFiles,
    totalUsers,
    filesPage,
    usersPage,
    totalFilesPages,
    totalUsersPages,
    itemsPerPage,
    filesDataLength: filesData?.allFiles?.length,
    usersDataLength: usersData?.users?.length
  })

  // Pagination component
  const Pagination = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    totalItems, 
    itemsPerPage 
  }: {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    totalItems: number
    itemsPerPage: number
  }) => {
    const startItem = currentPage * itemsPerPage + 1
    const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems)

    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{startItem}</span> to{' '}
              <span className="font-medium">{endItem}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => onPageChange(i)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    i === currentPage
                      ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    )
  }

  // Update total counts from storage stats
  useEffect(() => {
    if (statsData?.storageStats) {
      setTotalFiles(statsData.storageStats.fileCount)
      setTotalUsers(statsData.storageStats.userCount)
    }
  }, [statsData])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Manage files, users, and system statistics</p>
            </div>
          </div>
          <button
            onClick={handleBackToDashboard}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'files', name: 'All Files', icon: DocumentIcon },
              { id: 'folders', name: 'Folders', icon: FolderIcon },
              { id: 'users', name: 'Users', icon: UserIcon },
              { id: 'stats', name: 'Statistics', icon: EyeIcon },
              { id: 'audit', name: 'Audit Logs', icon: ClipboardDocumentListIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">All Files</h2>
                <span className="text-sm text-gray-500">
                  {filesData?.allFiles?.length || 0} files
                </span>
              </div>

              {filesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : filesError ? (
                <div className="text-red-600 text-center py-4">
                  Error loading files: {filesError.message}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          File
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Downloads
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filesData?.allFiles?.map((file: UserFile) => (
                        <tr key={file.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center max-w-xs">
                              <DocumentIcon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate" title={file.filename}>
                                  {file.filename}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {file.fileContent.mimeType}
                                </div>
                              </div>
                              <button
                                onClick={() => handlePreviewFile(file)}
                                className="ml-2 p-1 text-gray-400 hover:text-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                                title="Preview file"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleViewFileDetails(file)}
                                className="ml-1 p-1 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                                title="View full details"
                              >
                                <InformationCircleIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {file.user.username}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {file.user.email}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {file.user.role}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatBytes(file.fileContent.size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <ArrowDownTrayIcon className="h-4 w-4 text-gray-400 mr-1" />
                              {file.downloadCount}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                              {formatDate(file.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              file.isPublic 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {file.isPublic ? 'Public' : 'Private'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteFile(file.id, file.filename)}
                              disabled={deletingFileId === file.id}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingFileId === file.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <TrashIcon className="h-3 w-3 mr-1" />
                                  Delete
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Files Pagination */}
              {filesData?.allFiles && totalFilesPages > 1 && (
                <Pagination
                  currentPage={filesPage}
                  totalPages={totalFilesPages}
                  onPageChange={handleFilesPageChange}
                  totalItems={totalFiles}
                  itemsPerPage={itemsPerPage}
                />
              )}
            </div>
          )}

          {/* Folders Tab */}
          {activeTab === 'folders' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Folders Management</h2>
              <p className="text-sm text-gray-600">Manage user folders and folder structure</p>

              <div className="text-center py-12">
                <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Folders Management</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Folder management functionality is not implemented yet.
                </p>
                <div className="mt-4 max-w-2xl mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <InformationCircleIcon className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3 text-left">
                      <h3 className="text-sm font-medium text-yellow-800">Coming Soon</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>This feature will include:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>View all user folders</li>
                          <li>Create and manage folder structure</li>
                          <li>Folder permissions and access control</li>
                          <li>Folder statistics and usage</li>
                          <li>Bulk folder operations</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
                <span className="text-sm text-gray-500">
                  {usersData?.users?.length || 0} users
                </span>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : usersError ? (
                <div className="text-red-600 text-center py-4">
                  Error loading users: {usersError.message}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Storage Quota
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usersData?.users?.map((user: User) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <UserIcon className="h-5 w-5 text-gray-400 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {user.username}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'ADMIN' 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatBytes(user.storageQuota)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                              {formatDate(user.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                              {formatDate(user.updatedAt)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Users Pagination */}
              {usersData?.users && totalUsersPages > 1 && (
                <Pagination
                  currentPage={usersPage}
                  totalPages={totalUsersPages}
                  onPageChange={handleUsersPageChange}
                  totalItems={totalUsers}
                  itemsPerPage={itemsPerPage}
                />
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">System Statistics</h2>

              {statsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : statsError ? (
                <div className="text-red-600 text-center py-4">
                  Error loading statistics: {statsError.message}
                </div>
              ) : statsData?.storageStats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <DocumentIcon className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-blue-600">Total Files</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {statsData.storageStats.fileCount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <UserIcon className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-green-600">Total Users</p>
                        <p className="text-2xl font-bold text-green-900">
                          {statsData.storageStats.userCount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <FolderIcon className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-purple-600">Storage Used</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {formatBytes(statsData.storageStats.totalUsed)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <ArrowDownTrayIcon className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-orange-600">Space Saved</p>
                        <p className="text-2xl font-bold text-orange-900">
                          {formatBytes(statsData.storageStats.savedBytes)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <EyeIcon className="h-8 w-8 text-indigo-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-indigo-600">Deduplication Rate</p>
                        <p className="text-2xl font-bold text-indigo-900">
                          {statsData.storageStats.savedPercentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="flex items-center">
                      <DocumentIcon className="h-8 w-8 text-gray-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Original Size</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatBytes(statsData.storageStats.originalSize)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
              <p className="text-sm text-gray-600">Track user activities and system events</p>

              {auditLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : auditError ? (
                <div className="text-red-600 text-center py-4">
                  Error loading audit logs: {auditError.message}
                </div>
              ) : auditData?.auditLogs ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            File
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP Address
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User Agent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {auditData.auditLogs.map((log: AuditLog) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <UserIcon className="h-5 w-5 text-gray-400 mr-3" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {log.user.username}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {log.user.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                log.action === 'UPLOAD' ? 'bg-green-100 text-green-800' :
                                log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                                log.action === 'DOWNLOAD' ? 'bg-blue-100 text-blue-800' :
                                log.action === 'SHARE' ? 'bg-purple-100 text-purple-800' :
                                log.action === 'REGISTER' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {log.file ? (
                                <div className="flex items-center">
                                  <DocumentIcon className="h-4 w-4 text-gray-400 mr-2" />
                                  <div>
                                    <div className="text-sm text-gray-900 truncate max-w-xs" title={log.file.filename}>
                                      {log.file.filename}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {log.file.fileContent.sha256Hash === "deleted" ? (
                                        <span className="text-red-500 italic">File Deleted</span>
                                      ) : (
                                        `${formatBytes(log.file.fileContent.size)} • ${log.file.fileContent.mimeType}`
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.ipAddress}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                              <div className="flex items-center">
                                <div className="truncate flex-1" title={log.userAgent}>
                                  {log.userAgent}
                                </div>
                                <InformationCircleIcon className="h-4 w-4 text-gray-400 ml-1 flex-shrink-0" />
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                {new Date(log.createdAt).toLocaleString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Audit Logs Pagination */}
                  {auditData?.auditLogs && auditData.auditLogs.length === itemsPerPage && (
                    <Pagination
                      currentPage={auditPage}
                      totalPages={auditPage + 2} // Approximate, since we don't have total count
                      onPageChange={handleAuditPageChange}
                      totalItems={(auditPage + 1) * itemsPerPage}
                      itemsPerPage={itemsPerPage}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No audit logs found in the system.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* File Details Modal */}
      {isFileDetailsModalOpen && selectedFile && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DocumentIcon className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">File Details</h3>
                    <p className="text-sm text-gray-500">Complete file information</p>
                  </div>
                </div>
                <button
                  onClick={closeFileDetailsModal}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6 space-y-6">
                {/* File Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">File Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filename</label>
                      <p className="mt-1 text-sm text-gray-900 break-all">{selectedFile.filename}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">MIME Type</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.fileContent.mimeType}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Size</label>
                      <p className="mt-1 text-sm text-gray-900">{formatBytes(selectedFile.fileContent.size)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Downloads</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.downloadCount}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        selectedFile.isPublic 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedFile.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">SHA256 Hash</label>
                      <p className="mt-1 text-xs text-gray-900 font-mono break-all">{selectedFile.fileContent.sha256Hash}</p>
                    </div>
                  </div>
                </div>

                {/* Owner Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Owner Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Username</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.user.username}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.user.email}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        selectedFile.user.role === 'ADMIN' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedFile.user.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Timestamps</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedFile.createdAt)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedFile.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Folder Information */}
                {selectedFile.folder && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Folder Information</h4>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Folder Name</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedFile.folder.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={() => handleDeleteFile(selectedFile.id, selectedFile.filename)}
                  disabled={deletingFileId === selectedFile.id}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingFileId === selectedFile.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete File
                    </>
                  )}
                </button>
                <button
                  onClick={closeFileDetailsModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreview
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false)
          setSelectedFileForPreview(null)
          setPreviewDownloadUrl(null)
        }}
        file={selectedFileForPreview}
        downloadUrl={previewDownloadUrl || undefined}
      />
    </div>
  )
}
