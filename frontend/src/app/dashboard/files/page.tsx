'use client'

import { useState, useEffect } from 'react'
import { FileValidationResult } from '@/lib/fileValidation'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { gql } from '@apollo/client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FileUpload } from '@/components/ui/FileUpload'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  DocumentIcon,
  FolderIcon,
  ShareIcon,
  TrashIcon,
  EyeIcon,
  CloudArrowDownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  UserIcon,
  ClipboardDocumentIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const FILES_QUERY = gql`
  query Files($filters: FileFiltersInput, $limit: Int, $offset: Int) {
    files(filters: $filters, limit: $limit, offset: $offset) {
      id
      filename
      createdAt
      updatedAt
      isPublic
      downloadCount
      tags
      user {
        id
        username
        email
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


const UPLOAD_FILES_MUTATION = gql`
  mutation UploadFiles($files: [Upload!]!, $folderId: ID) {
    uploadFiles(files: $files, folderId: $folderId) {
      id
      filename
      createdAt
      fileContent {
        size
        mimeType
      }
    }
  }
`

const DELETE_FILE_MUTATION = gql`
  mutation DeleteFile($fileId: ID!) {
    deleteFile(fileId: $fileId)
  }
`

const SHARE_FILE_MUTATION = gql`
  mutation ShareFile($fileId: ID!, $shareType: ShareType!, $userId: ID) {
    shareFile(fileId: $fileId, shareType: $shareType, userId: $userId) {
      id
      shareType
      createdAt
    }
  }
`

const DOWNLOAD_FILE_QUERY = gql`
  query DownloadFile($fileId: ID!) {
    downloadFile(id: $fileId)
  }
`

const UPDATE_FILE_MUTATION = gql`
  mutation UpdateFile($fileId: ID!, $input: UpdateFileInput!) {
    updateFile(fileId: $fileId, input: $input) {
      id
      filename
      isPublic
      tags
      folder {
        id
        name
      }
      user {
        id
        username
        email
      }
      fileContent {
        id
        size
        mimeType
        sha256Hash
      }
      createdAt
      updatedAt
      downloadCount
    }
  }
`

export default function FilesPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileValidations, setFileValidations] = useState<FileValidationResult[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showAddMoreFiles, setShowAddMoreFiles] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [isFileDetailsModalOpen, setIsFileDetailsModalOpen] = useState(false)
  const [selectedFileForDetails, setSelectedFileForDetails] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFileForEdit, setSelectedFileForEdit] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    filename: '',
    tags: [] as string[],
    isPublic: false,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [selectedFileForShare, setSelectedFileForShare] = useState<any>(null)
  const [shareType, setShareType] = useState<'PUBLIC' | 'PRIVATE' | 'USER_SPECIFIC'>('PUBLIC')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [filters, setFilters] = useState({
    mimeType: '',
    sizeMin: '',
    sizeMax: '',
    dateFrom: '',
    dateTo: '',
  })
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)

  const ITEMS_PER_PAGE = 20

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset pagination when search term, filters, or folder changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filters, selectedFolder])

  // Build filters object
  const buildFilters = () => {
    const filterObj: any = {}
    
    if (debouncedSearchTerm) filterObj.search = debouncedSearchTerm
    if (filters.mimeType) filterObj.mimeType = filters.mimeType
    if (filters.sizeMin && filters.sizeMin !== '') {
      const sizeMinBytes = parseInt(filters.sizeMin) * 1024 * 1024
      if (!isNaN(sizeMinBytes)) {
        filterObj.sizeMin = sizeMinBytes
      }
    }
    if (filters.sizeMax && filters.sizeMax !== '') {
      const sizeMaxBytes = parseInt(filters.sizeMax) * 1024 * 1024
      if (!isNaN(sizeMaxBytes)) {
        filterObj.sizeMax = sizeMaxBytes
      }
    }
    if (filters.dateFrom) {
      // Convert date string to ISO string for proper parsing
      const dateFrom = new Date(filters.dateFrom + 'T00:00:00.000Z')
      filterObj.dateFrom = dateFrom.toISOString()
    }
    if (filters.dateTo) {
      // Convert date string to end of day ISO string for proper parsing
      const dateTo = new Date(filters.dateTo + 'T23:59:59.999Z')
      filterObj.dateTo = dateTo.toISOString()
    }
    if (selectedFolder) filterObj.folderId = selectedFolder
    
    console.log('Frontend filters being sent:', filterObj)
    return Object.keys(filterObj).length > 0 ? filterObj : undefined
  }

  const { data, loading: filesLoading, refetch } = useQuery(FILES_QUERY, {
    variables: {
      filters: buildFilters(),
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
    },
    skip: !isAuthenticated,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  })


  const [uploadFiles] = useMutation(UPLOAD_FILES_MUTATION)
  const [deleteFile] = useMutation(DELETE_FILE_MUTATION)
  const [shareFile] = useMutation(SHARE_FILE_MUTATION)
  const [updateFile] = useMutation(UPDATE_FILE_MUTATION)
  const [getDownloadUrl] = useLazyQuery(DOWNLOAD_FILE_QUERY)

  // Refetch files when authentication status changes
  useEffect(() => {
    if (isAuthenticated && refetch) {
      refetch()
    }
  }, [isAuthenticated, refetch])

  // Calculate pagination state
  useEffect(() => {
    if (data?.files) {
      const currentFilesCount = data.files.length
      const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
      
      setHasNextPage(currentPage < totalPages)
      setHasPreviousPage(currentPage > 1)
    }
  }, [data, currentPage, totalCount])

  // Update total count when data changes
  useEffect(() => {
    if (data?.files) {
      const currentFilesCount = data.files.length
      
      if (currentFilesCount === ITEMS_PER_PAGE) {
        // If we got a full page, there might be more
        // We'll estimate by adding 1 to current count to indicate there might be more
        setTotalCount(currentPage * ITEMS_PER_PAGE + 1)
      } else {
        // If we got less than a full page, this is the last page
        setTotalCount((currentPage - 1) * ITEMS_PER_PAGE + currentFilesCount)
      }
    }
  }, [data, currentPage])

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

  const files = data?.files || []

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

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return PhotoIcon
    if (mimeType.startsWith('video/')) return VideoCameraIcon
    if (mimeType.startsWith('audio/')) return MusicalNoteIcon
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return DocumentTextIcon
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return ArchiveBoxIcon
    return DocumentIcon
  }

  const getFileTypeCategory = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image'
    if (mimeType.startsWith('video/')) return 'Video'
    if (mimeType.startsWith('audio/')) return 'Audio'
    if (mimeType.includes('pdf')) return 'PDF Document'
    if (mimeType.includes('document') || mimeType.includes('text')) return 'Document'
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'Archive'
    return 'File'
  }

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    if (isUploading) {
      toast.error('Upload already in progress. Please wait...')
      return
    }

    setIsUploading(true)
    try {
      const { data } = await uploadFiles({
        variables: {
          files: selectedFiles,
          folderId: selectedFolder,
        },
      })

      if (data?.uploadFiles) {
        toast.success(`${data.uploadFiles.length} file(s) uploaded successfully`)
        setSelectedFiles([])
        setIsUploadModalOpen(false)
        refetch()
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    try {
      await deleteFile({
        variables: { fileId: fileId },
      })
      toast.success('File deleted successfully')
      refetch()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(error.message || 'Delete failed')
    }
  }

  const handleShareFile = (file: any) => {
    setSelectedFileForShare(file)
    setIsShareModalOpen(true)
  }

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false)
    setSelectedFileForShare(null)
    setShareType('PUBLIC')
    setUserSearchQuery('')
    setSearchResults([])
    setSelectedUser(null)
  }

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/users/search?username=${encodeURIComponent(query)}&limit=10&offset=0`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.users || [])
      } else {
        console.error('Failed to search users')
        setSearchResults([])
      }
    } catch (error) {
      console.error('Error searching users:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleUserSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setUserSearchQuery(query)
    searchUsers(query)
  }

  const handleUserSelect = (user: any) => {
    setSelectedUser(user)
    setUserSearchQuery(user.username)
    setSearchResults([])
  }

  const handleShareSubmit = async () => {
    if (!selectedFileForShare) return

    try {
      await shareFile({
        variables: {
          fileId: selectedFileForShare.id,
          shareType: shareType,
          userId: shareType === 'USER_SPECIFIC' ? selectedUser?.id : null,
        },
      })
      toast.success('File shared successfully')
      handleCloseShareModal()
      refetch()
    } catch (error: any) {
      console.error('Share error:', error)
      toast.error(error.message || 'Share failed')
    }
  }

  const handleEditFile = (file: any) => {
    setSelectedFileForEdit(file)
    setEditForm({
      filename: file.filename,
      tags: file.tags || [],
      isPublic: file.isPublic,
    })
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedFileForEdit(null)
    setEditForm({
      filename: '',
      tags: [],
      isPublic: false,
    })
  }

  const handleUpdateFile = async () => {
    if (!selectedFileForEdit) return

    try {
      await updateFile({
        variables: {
          fileId: selectedFileForEdit.id,
          input: {
            filename: editForm.filename,
            tags: editForm.tags,
            isPublic: editForm.isPublic,
          },
        },
      })
      toast.success('File updated successfully')
      refetch()
      handleCloseEditModal()
    } catch (error: any) {
      console.error('Update error:', error)
      toast.error(error.message || 'Update failed')
    }
  }

  const handleDownloadFile = async (fileId: string, filename: string) => {
    try {
      toast(`Getting download link for ${filename}...`)
      
      const { data } = await getDownloadUrl({
        variables: { fileId: fileId },
      })

      if (data?.downloadFile) {
        // Add authorization header by using fetch
        const URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}${data.downloadFile}`
        console.log(URL)
        const response = await fetch(URL, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            
          },
        })

        if (!response.ok) {
          throw new Error(`Download failed: ${response.statusText}`)
        }

        // Get the blob and create download link
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        
        // Create a temporary link and trigger download
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.target = '_blank'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the blob URL
        window.URL.revokeObjectURL(url)
        
        toast.success(`${filename} downloaded successfully`)
        
        // Refetch files to update download count
        refetch()
      }
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error(error.message || 'Download failed')
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleClearAllFiles = () => {
    setSelectedFiles([])
    setFileValidations([])
    setShowAddMoreFiles(false)
  }

  const handleAddMoreFiles = () => {
    setShowAddMoreFiles(true)
  }

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false)
    setSelectedFiles([])
    setFileValidations([])
    setShowAddMoreFiles(false)
  }

  const handleViewFileDetails = (file: any) => {
    setSelectedFileForDetails(file)
    setIsFileDetailsModalOpen(true)
  }

  const handleCloseFileDetailsModal = () => {
    setIsFileDetailsModalOpen(false)
    setSelectedFileForDetails(null)
  }

  const handleFileValidation = (validations: FileValidationResult[]) => {
    setFileValidations(validations)
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const clearFilters = () => {
    setFilters({
      mimeType: '',
      sizeMin: '',
      sizeMax: '',
      dateFrom: '',
      dateTo: '',
    })
    setSearchTerm('')
    setSelectedFolder(null)
  }

  const hasActiveFilters = () => {
    return debouncedSearchTerm || 
           filters.mimeType || 
           filters.sizeMin || 
           filters.sizeMax || 
           filters.dateFrom || 
           filters.dateTo || 
           selectedFolder
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Files</h1>
            <p className="text-gray-600">Manage your uploaded files</p>
          </div>
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Filters
              {hasActiveFilters() && (
                <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-1">
                  Active
                </span>
              )}
            </Button>
            {hasActiveFilters() && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* File Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Type
                  </label>
                  <select
                    value={filters.mimeType}
                    onChange={(e) => handleFilterChange('mimeType', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="">All Types</option>
                    <option value="image/">Images</option>
                    <option value="video/">Videos</option>
                    <option value="audio/">Audio</option>
                    <option value="application/pdf">PDF</option>
                    <option value="text/">Text Files</option>
                    <option value="application/">Documents</option>
                  </select>
                </div>

                {/* Size Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Size (MB)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.sizeMin}
                    onChange={(e) => handleFilterChange('sizeMin', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Size (MB)
                  </label>
                  <input
                    type="number"
                    placeholder="∞"
                    value={filters.sizeMax}
                    onChange={(e) => handleFilterChange('sizeMax', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {!filesLoading && (
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>
              {hasActiveFilters() ? (
                <>Found {files.length} file{files.length !== 1 ? 's' : ''} matching your filters</>
              ) : (
                <>Showing {files.length} file{files.length !== 1 ? 's' : ''}</>
              )}
            </span>
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Files Grid */}
        {filesLoading ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner"></div>
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file: any) => (
              <Card key={file.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleViewFileDetails(file)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="View Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditFile(file)}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Edit File"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(file.id, file.filename)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Download"
                      >
                        <CloudArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleShareFile(file)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Share"
                      >
                        <ShareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-medium text-gray-900 truncate" title={file.filename}>
                    {file.filename}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatBytes(file.fileContent.size)}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <UserIcon className="h-3 w-3 mr-1" />
                    <span>by {file.user?.username || 'Unknown User'}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(file.createdAt)}
                  </p>
                  {file.isPublic && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                      Public
                    </span>
                  )}
                  {file.tags && file.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {file.tags.slice(0, 2).map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                      {file.tags.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{file.tags.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {hasActiveFilters() ? 'No files found' : 'No files'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasActiveFilters() 
                  ? 'Try adjusting your search criteria or clear the filters to see all files.'
                  : 'Get started by uploading your first file.'
                }
              </p>
              <div className="mt-6 flex justify-center gap-3">
                {hasActiveFilters() ? (
                  <Button onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button onClick={() => setIsUploadModalOpen(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination Controls */}
        {!filesLoading && files.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                variant="outline"
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!hasNextPage}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{totalCount}</span>{' '}
                  results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <Button
                    variant="outline"
                    onClick={handlePreviousPage}
                    disabled={!hasPreviousPage}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </Button>
                  
                  {/* Page numbers */}
                  {(() => {
                    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
                    const pages = []
                    const maxVisiblePages = 5
                    
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
                    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
                    
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1)
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={i === currentPage ? "primary" : "outline"}
                          onClick={() => handlePageChange(i)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            i === currentPage
                              ? 'z-10 bg-primary-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                          }`}
                        >
                          {i}
                        </Button>
                      )
                    }
                    
                    return pages
                  })()}
                  
                  <Button
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={!hasNextPage}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={handleCloseUploadModal}
          title="Upload Files"
          size="lg"
        >
          <div className="space-y-4">
            {!showAddMoreFiles ? (
              <FileUpload
                onFilesSelected={setSelectedFiles}
                onFileValidation={handleFileValidation}
                maxFiles={10}
                maxSize={50 * 1024 * 1024}
                enableValidation={true}
                disabled={isUploading}
              />
            ) : (
              <FileUpload
                onFilesSelected={setSelectedFiles}
                onFileValidation={handleFileValidation}
                maxFiles={10}
                maxSize={50 * 1024 * 1024}
                appendMode={true}
                existingFiles={selectedFiles}
                enableValidation={true}
                disabled={isUploading}
              />
            )}
            
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Selected Files:</h4>
                  <div className="flex space-x-2">
                    {!showAddMoreFiles && selectedFiles.length < 10 && (
                      <button
                        onClick={handleAddMoreFiles}
                        disabled={isUploading}
                        className={`text-xs font-medium ${
                          isUploading 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        Add More
                      </button>
                    )}
                    <button
                      onClick={handleClearAllFiles}
                      disabled={isUploading}
                      className={`text-xs font-medium ${
                        isUploading 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-red-600 hover:text-red-800'
                      }`}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => {
                    const validation = fileValidations[index]
                    const hasWarning = validation?.isExtensionMismatch || validation?.warning
                    
                    return (
                      <div key={index} className={`flex items-center justify-between text-sm rounded px-2 py-1 ${
                        hasWarning ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <span className="truncate block">{file.name}</span>
                            {hasWarning && (
                              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-gray-500 text-xs">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                          {validation?.warning && (
                            <div className="text-xs text-yellow-700 mt-1">
                              {validation.warning}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove file"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className={isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isUploading ? 'Uploading...' : 'Cancel'}
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className={isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {isUploading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  `Upload ${selectedFiles.length} File(s)`
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {/* File Details Modal */}
        <Modal
          isOpen={isFileDetailsModalOpen}
          onClose={handleCloseFileDetailsModal}
          title="File Details"
          size="lg"
        >
          {selectedFileForDetails && (
            <div className="space-y-6">
              {/* File Header */}
              <div className="flex items-start space-x-4">
                {(() => {
                  const FileIcon = getFileIcon(selectedFileForDetails.fileContent.mimeType)
                  return <FileIcon className="h-12 w-12 text-gray-400 flex-shrink-0" />
                })()}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {selectedFileForDetails.filename}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {getFileTypeCategory(selectedFileForDetails.fileContent.mimeType)}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedFileForDetails.isPublic 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedFileForDetails.isPublic ? 'Public' : 'Private'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedFileForDetails.downloadCount} downloads
                    </span>
                  </div>
                </div>
              </div>

              {/* File Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center">
                    <InformationCircleIcon className="h-4 w-4 mr-2" />
                    Basic Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">File Size:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatBytes(selectedFileForDetails.fileContent.size)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">MIME Type:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedFileForDetails.fileContent.mimeType}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500 mb-1">SHA256 Hash:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded border">
                          {selectedFileForDetails.fileContent.sha256Hash.substring(0, 16)}...
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedFileForDetails.fileContent.sha256Hash)
                            toast.success('SHA256 hash copied to clipboard')
                          }}
                          className="flex items-center text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          title="Copy full hash"
                        >
                          <ClipboardDocumentIcon className="h-3 w-3 mr-1" />
                          Copy
                        </button>
                      </div>
                    </div>
                    {selectedFileForDetails.folder && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Folder:</span>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedFileForDetails.folder.name}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 flex items-center">
                        <UserIcon className="h-4 w-4 mr-1" />
                        Uploaded by:
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedFileForDetails.user?.username || 'Unknown User'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Timestamps
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Created:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(selectedFileForDetails.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Last Modified:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(selectedFileForDetails.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedFileForDetails.tags && selectedFileForDetails.tags.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center">
                    <TagIcon className="h-4 w-4 mr-2" />
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFileForDetails.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* File Preview */}
              {selectedFileForDetails.fileContent.mimeType.startsWith('image/') && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Preview</h4>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <img
                      src={`/api/files/${selectedFileForDetails.id}/preview`}
                      alt={selectedFileForDetails.filename}
                      className="max-w-full max-h-64 mx-auto rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => handleEditFile(selectedFileForDetails)}
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadFile(selectedFileForDetails.id, selectedFileForDetails.filename)}
                >
                  <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShareFile(selectedFileForDetails)}
                >
                  <ShareIcon className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseFileDetailsModal}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Edit File Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          title="Edit File"
          size="lg"
        >
          {selectedFileForEdit && (
            <div className="space-y-6">
              {/* File Header */}
              <div className="flex items-center space-x-4">
                {(() => {
                  const FileIcon = getFileIcon(selectedFileForEdit.fileContent.mimeType)
                  return <FileIcon className="h-12 w-12 text-gray-400 flex-shrink-0" />
                })()}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {selectedFileForEdit.filename}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {getFileTypeCategory(selectedFileForEdit.fileContent.mimeType)}
                  </p>
                </div>
              </div>

              {/* Edit Form */}
              <div className="space-y-4">
                {/* Filename */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filename
                  </label>
                  <input
                    type="text"
                    value={editForm.filename}
                    onChange={(e) => setEditForm({ ...editForm, filename: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Enter filename"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.tags.join(', ')}
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                      setEditForm({ ...editForm, tags })
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Visibility
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="visibility"
                        checked={editForm.isPublic === true}
                        onChange={() => setEditForm({ ...editForm, isPublic: true })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Public - Anyone can view this file</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="visibility"
                        checked={editForm.isPublic === false}
                        onChange={() => setEditForm({ ...editForm, isPublic: false })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Private - Only you can view this file</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCloseEditModal}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateFile}
                  disabled={!editForm.filename.trim()}
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Update File
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Share File Modal */}
        <Modal
          isOpen={isShareModalOpen}
          onClose={handleCloseShareModal}
          title="Share File"
          size="lg"
        >
          {selectedFileForShare && (
            <div className="space-y-6">
              {/* File Header */}
              <div className="flex items-center space-x-4">
                {(() => {
                  const FileIcon = getFileIcon(selectedFileForShare.fileContent.mimeType)
                  return <FileIcon className="h-12 w-12 text-gray-400 flex-shrink-0" />
                })()}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {selectedFileForShare.filename}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {getFileTypeCategory(selectedFileForShare.fileContent.mimeType)}
                  </p>
                </div>
              </div>

              {/* Share Options */}
              <div className="space-y-4">
                {/* Share Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Share Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="PUBLIC"
                        checked={shareType === 'PUBLIC'}
                        onChange={(e) => setShareType(e.target.value as 'PUBLIC')}
                        className="mr-2"
                      />
                      <span className="text-sm">Public - Anyone with the link can access</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="PRIVATE"
                        checked={shareType === 'PRIVATE'}
                        onChange={(e) => setShareType(e.target.value as 'PRIVATE')}
                        className="mr-2"
                      />
                      <span className="text-sm">Private - Only you can access</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="USER_SPECIFIC"
                        checked={shareType === 'USER_SPECIFIC'}
                        onChange={(e) => setShareType(e.target.value as 'USER_SPECIFIC')}
                        className="mr-2"
                      />
                      <span className="text-sm">User Specific - Share with specific users</span>
                    </label>
                  </div>
                </div>

                {/* User Search (only show for USER_SPECIFIC) */}
                {shareType === 'USER_SPECIFIC' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Users
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={handleUserSearchChange}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="Type username to search..."
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2.5">
                          <div className="loading-spinner"></div>
                        </div>
                      )}
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleUserSelect(user)}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {selectedUser.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-900">{selectedUser.username}</p>
                              <p className="text-xs text-blue-600">{selectedUser.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedUser(null)
                              setUserSearchQuery('')
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={handleCloseShareModal}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShareSubmit}
                  disabled={shareType === 'USER_SPECIFIC' && !selectedUser}
                >
                  <ShareIcon className="h-4 w-4 mr-2" />
                  Share File
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  )
}
