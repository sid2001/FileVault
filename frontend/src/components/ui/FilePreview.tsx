'use client'

import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import {
  XMarkIcon,
  CloudArrowDownIcon,
  EyeIcon,
  DocumentIcon,
  PhotoIcon,
  VideoCameraIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/outline'

interface FilePreviewProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: string
    filename: string
    fileContent: {
      mimeType: string
      size: number
      sha256Hash: string
    }
  } | null
  downloadUrl?: string
}

export function FilePreview({ isOpen, onClose, file, downloadUrl }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [audioVolume, setAudioVolume] = useState(1)

  useEffect(() => {
    if (isOpen && file && downloadUrl) {
      loadPreview()
    } else {
      setPreviewUrl(null)
      setError(null)
    }
  }, [isOpen, file, downloadUrl])

  const loadPreview = async () => {
    if (!file || !downloadUrl) {
      console.log('Preview load skipped - file:', !!file, 'downloadUrl:', !!downloadUrl)
      return
    }

    console.log('Starting preview load for file:', file.filename, 'MIME type:', file.fileContent.mimeType)
    console.log('Download URL:', downloadUrl)

    setIsLoading(true)
    setError(null)

    try {
      // For images, videos, and audio, we can create object URLs
      if (isPreviewable(file.fileContent.mimeType)) {
        // Convert download URL to preview URL
        let previewUrl
        if (downloadUrl.startsWith('http')) {
          previewUrl = downloadUrl.replace('/download/', '/preview/')
        } else {
          // Use backend URL instead of frontend origin
          const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL?.replace('/graphql', '') || 'http://localhost:8080'
          const cleanUrl = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`
          previewUrl = `${backendUrl}${cleanUrl.replace('/download/', '/preview/')}`
        }
        
        console.log('Original download URL:', downloadUrl)
        console.log('Constructed preview URL:', previewUrl)
        console.log('Window origin:', window.location.origin)
        console.log('Backend URL:', process.env.NEXT_PUBLIC_GRAPHQL_URL?.replace('/graphql', '') || 'http://localhost:8080')
        
        const response = await fetch(previewUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        })
        
        console.log('Preview response status:', response.status)
        console.log('Preview response headers:', Object.fromEntries(response.headers.entries()))
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Preview fetch failed:', response.status, response.statusText, errorText)
          
          // Try fallback to download URL if preview fails
          console.log('Trying fallback to download URL...')
          const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL?.replace('/graphql', '') || 'http://localhost:8080'
          const fallbackUrl = downloadUrl.startsWith('http') 
            ? downloadUrl 
            : `${backendUrl}${downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`}`
          console.log('Fallback URL:', fallbackUrl)
          const downloadResponse = await fetch(fallbackUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          })
          
          if (downloadResponse.ok) {
            console.log('Fallback download successful')
            const blob = await downloadResponse.blob()
            const url = URL.createObjectURL(blob)
            setPreviewUrl(url)
            return
          } else {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`)
          }
        }
        
        const blob = await response.blob()
        console.log('Preview blob size:', blob.size, 'type:', blob.type)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        console.log('Preview loaded successfully, object URL:', url)
      } else {
        // For non-previewable files, we'll show a placeholder
        setPreviewUrl(null)
      }
    } catch (err) {
      console.error('Preview load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setIsLoading(false)
    }
  }

  const isPreviewable = (mimeType: string): boolean => {
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/') ||
      mimeType.startsWith('audio/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/')
    )
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return PhotoIcon
    if (mimeType.startsWith('video/')) return VideoCameraIcon
    if (mimeType.startsWith('audio/')) return MusicalNoteIcon
    if (mimeType === 'application/pdf') return DocumentTextIcon
    if (mimeType.startsWith('text/')) return DocumentTextIcon
    if (mimeType.includes('zip') || mimeType.includes('rar')) return ArchiveBoxIcon
    return DocumentIcon
  }

  const getFileTypeCategory = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image'
    if (mimeType.startsWith('video/')) return 'Video'
    if (mimeType.startsWith('audio/')) return 'Audio'
    if (mimeType === 'application/pdf') return 'PDF Document'
    if (mimeType.startsWith('text/')) return 'Text File'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archive'
    return 'File'
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDownload = () => {
    if (downloadUrl) {
      const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL?.replace('/graphql', '') || 'http://localhost:8080'
      const absoluteUrl = downloadUrl.startsWith('http') 
        ? downloadUrl 
        : `${backendUrl}${downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`}`
      
      console.log('Download URL:', absoluteUrl)
      
      const link = document.createElement('a')
      link.href = absoluteUrl
      link.download = file?.filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const renderPreview = () => {
    if (!file) return null

    const { mimeType } = file.fileContent
    const FileIcon = getFileIcon(mimeType)

    // Show loading if we don't have download URL yet
    if (!downloadUrl) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Loading file...</p>
          </div>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileIcon className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          
          {/* Debug Information */}
          <div className="bg-gray-100 p-3 rounded text-xs text-left mb-4 max-w-md">
            <p><strong>File:</strong> {file?.filename}</p>
            <p><strong>MIME Type:</strong> {file?.fileContent.mimeType}</p>
            <p><strong>Download URL:</strong> {downloadUrl}</p>
            <p><strong>Previewable:</strong> {isPreviewable(file?.fileContent.mimeType || '') ? 'Yes' : 'No'}</p>
          </div>
          
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <CloudArrowDownIcon className="h-4 w-4" />
            Download File
          </Button>
        </div>
      )
    }

    if (!isPreviewable(mimeType)) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileIcon className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Supported</h3>
          <p className="text-sm text-gray-500 mb-4">
            This file type ({getFileTypeCategory(mimeType)}) cannot be previewed in the browser.
          </p>
          <Button onClick={handleDownload} className="flex items-center gap-2">
            <CloudArrowDownIcon className="h-4 w-4" />
            Download File
          </Button>
        </div>
      )
    }

    if (mimeType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center h-full">
          <img
            src={previewUrl || ''}
            alt={file.filename}
            className="max-w-full max-h-full object-contain rounded-lg"
            onError={() => setError('Failed to load image')}
          />
        </div>
      )
    }

    if (mimeType.startsWith('video/')) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <video
            src={previewUrl || ''}
            controls
            className="max-w-full max-h-full rounded-lg"
            onPlay={() => setIsVideoPlaying(true)}
            onPause={() => setIsVideoPlaying(false)}
            onError={() => setError('Failed to load video')}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }

    if (mimeType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <MusicalNoteIcon className="h-16 w-16 text-gray-400" />
          <audio
            src={previewUrl || ''}
            controls
            className="w-full max-w-md"
            onPlay={() => setIsAudioPlaying(true)}
            onPause={() => setIsAudioPlaying(false)}
            onError={() => setError('Failed to load audio')}
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      )
    }

    if (mimeType === 'application/pdf') {
      return (
        <div className="h-full">
          <iframe
            src={previewUrl || ''}
            className="w-full h-full border-0 rounded-lg"
            title={file.filename}
            onError={() => setError('Failed to load PDF')}
          />
        </div>
      )
    }

    if (mimeType.startsWith('text/')) {
      return (
        <div className="h-full">
          <iframe
            src={previewUrl || ''}
            className="w-full h-full border-0 rounded-lg"
            title={file.filename}
            onError={() => setError('Failed to load text file')}
          />
        </div>
      )
    }

    return null
  }

  if (!file) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <EyeIcon className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">File Preview</h2>
              <p className="text-sm text-gray-500">{file.filename}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <CloudArrowDownIcon className="h-4 w-4" />
              Download
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* File Info */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>
                <strong>Type:</strong> {getFileTypeCategory(file.fileContent.mimeType)}
              </span>
              <span>
                <strong>Size:</strong> {formatBytes(file.fileContent.size)}
              </span>
              <span>
                <strong>MIME:</strong> {file.fileContent.mimeType}
              </span>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {renderPreview()}
        </div>
      </div>
    </Modal>
  )
}
