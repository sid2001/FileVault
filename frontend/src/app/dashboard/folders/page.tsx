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
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  FolderIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const FOLDERS_QUERY = gql`
  query Folders($parentId: ID) {
    folders(parentId: $parentId) {
      id
      name
      createdAt
      updatedAt
      isPublic
      user {
        id
        username
      }
      files {
        id
        filename
      }
    }
  }
`

const CREATE_FOLDER_MUTATION = gql`
  mutation CreateFolder($input: CreateFolderInput!) {
    createFolder(input: $input) {
      id
      name
      createdAt
      isPublic
    }
  }
`

const UPDATE_FOLDER_MUTATION = gql`
  mutation UpdateFolder($folderId: ID!, $name: String!) {
    updateFolder(folderId: $folderId, name: $name) {
      id
      name
      updatedAt
    }
  }
`

const DELETE_FOLDER_MUTATION = gql`
  mutation DeleteFolder($folderId: ID!) {
    deleteFolder(folderId: $folderId)
  }
`

export default function FoldersPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<any>(null)
  const [folderName, setFolderName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data, loading: foldersLoading, refetch } = useQuery(FOLDERS_QUERY, {
    skip: !isAuthenticated,
  })

  const [createFolder] = useMutation(CREATE_FOLDER_MUTATION)
  const [updateFolder] = useMutation(UPDATE_FOLDER_MUTATION)
  const [deleteFolder] = useMutation(DELETE_FOLDER_MUTATION)

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

  const folders = data?.folders || []
  const filteredFolders = folders.filter((folder: any) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      await createFolder({
        variables: {
          input: {
            name: folderName.trim(),
            isPublic: false,
          },
        },
      })
      toast.success('Folder created successfully')
      setFolderName('')
      setIsCreateModalOpen(false)
      refetch()
    } catch (error: any) {
      console.error('Create folder error:', error)
      toast.error(error.message || 'Failed to create folder')
    }
  }

  const handleEditFolder = async () => {
    if (!folderName.trim() || !editingFolder) {
      toast.error('Please enter a folder name')
      return
    }

    try {
      await updateFolder({
        variables: {
          folderID: editingFolder.id,
          name: folderName.trim(),
        },
      })
      toast.success('Folder updated successfully')
      setFolderName('')
      setEditingFolder(null)
      setIsEditModalOpen(false)
      refetch()
    } catch (error: any) {
      console.error('Update folder error:', error)
      toast.error(error.message || 'Failed to update folder')
    }
  }

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteFolder({
        variables: { folderID: folderId },
      })
      toast.success('Folder deleted successfully')
      refetch()
    } catch (error: any) {
      console.error('Delete folder error:', error)
      toast.error(error.message || 'Failed to delete folder')
    }
  }

  const openEditModal = (folder: any) => {
    setEditingFolder(folder)
    setFolderName(folder.name)
    setIsEditModalOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
            <p className="text-gray-600">Organize your files into folders</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create Folder
          </Button>
        </div>

        {/* Coming Soon Info */}
        <div className="max-w-2xl mx-auto bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3 text-left">
              <h3 className="text-sm font-medium text-yellow-800">Coming Soon</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Enhanced folder management features are being developed:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Advanced folder organization and structure</li>
                  <li>Folder sharing and collaboration</li>
                  <li>Folder permissions and access control</li>
                  <li>Bulk folder operations</li>
                  <li>Folder templates and presets</li>
                </ul>
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
            placeholder="Search folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>

        {/* Folders Grid */}
        {foldersLoading ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredFolders.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredFolders.map((folder: any) => (
              <Card key={folder.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <FolderIcon className="h-8 w-8 text-blue-500" />
                    <div className="flex space-x-1">
                      <button
                        onClick={() => openEditModal(folder)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(folder.id, folder.name)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-medium text-gray-900 truncate" title={folder.name}>
                    {folder.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {folder.files?.length || 0} files
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {formatDate(folder.createdAt)}
                  </p>
                  {folder.isPublic && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                      Public
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No folders</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create your first folder to organize your files.
              </p>
              <div className="mt-6">
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Folder Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Folder"
        >
          <div className="space-y-4">
            <Input
              label="Folder Name"
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setFolderName('')
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create Folder
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Folder Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Folder"
        >
          <div className="space-y-4">
            <Input
              label="Folder Name"
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEditFolder()}
            />
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false)
                  setFolderName('')
                  setEditingFolder(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditFolder}>
                Update Folder
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
