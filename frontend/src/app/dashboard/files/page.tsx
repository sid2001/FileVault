'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@apollo/client'
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
  mutation UploadFiles($files: [Upload!]!, $folderID: ID) {
    uploadFiles(files: $files, folderId: $folderID) {
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
  mutation DeleteFile($fileID: ID!) {
    deleteFile(fileID: $fileID)
  }
`

const SHARE_FILE_MUTATION = gql`
  mutation ShareFile($fileID: ID!, $shareType: ShareType!, $userID: ID) {
    shareFile(fileID: $fileID, shareType: $shareType, userID: $userID) {
      id
      shareType
      createdAt
    }
  }
`

export default function FilesPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  const { data, loading: filesLoading, refetch } = useQuery(FILES_QUERY, {
    variables: {
      filters: searchTerm ? { search: searchTerm } : undefined,
      limit: 50,
      offset: 0,
    },
    skip: !isAuthenticated,
  })

  const [uploadFiles] = useMutation(UPLOAD_FILES_MUTATION)
  const [deleteFile] = useMutation(DELETE_FILE_MUTATION)
  const [shareFile] = useMutation(SHARE_FILE_MUTATION)

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

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    try {
      const { data } = await uploadFiles({
        variables: {
          files: selectedFiles,
          folderID: selectedFolder,
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
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    try {
      await deleteFile({
        variables: { fileID: fileId },
      })
      toast.success('File deleted successfully')
      refetch()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(error.message || 'Delete failed')
    }
  }

  const handleShareFile = async (fileId: string) => {
    try {
      await shareFile({
        variables: {
          fileID: fileId,
          shareType: 'PUBLIC',
        },
      })
      toast.success('File shared successfully')
      refetch()
    } catch (error: any) {
      console.error('Share error:', error)
      toast.error(error.message || 'Share failed')
    }
  }

  const handleDownloadFile = (fileId: string, filename: string) => {
    // This would typically make a request to get the download URL
    toast(`Downloading ${filename}...`)
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

        {/* Search */}
        <div className="relative">
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
                        onClick={() => handleDownloadFile(file.id, file.filename)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Download"
                      >
                        <CloudArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleShareFile(file.id)}
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by uploading your first file.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsUploadModalOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Upload Files"
          size="lg"
        >
          <div className="space-y-4">
            <FileUpload
              onFilesSelected={setSelectedFiles}
              maxFiles={10}
              maxSize={50 * 1024 * 1024}
            />
            
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Selected Files:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={selectedFiles.length === 0}
              >
                Upload {selectedFiles.length} File(s)
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
