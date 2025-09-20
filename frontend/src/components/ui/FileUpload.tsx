import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudArrowUpIcon, DocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { validateFileType, FileValidationResult } from '@/lib/fileValidation'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  onFileValidation?: (validations: FileValidationResult[]) => void
  maxFiles?: number
  maxSize?: number
  accept?: Record<string, string[]>
  disabled?: boolean
  appendMode?: boolean
  existingFiles?: File[]
  enableValidation?: boolean
}

export function FileUpload({
  onFilesSelected,
  onFileValidation,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    'application/pdf': ['.pdf'],
    'text/*': ['.txt', '.md'],
    'application/*': ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  },
  disabled = false,
  appendMode = false,
  existingFiles = [],
  enableValidation = true,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      let finalFiles = acceptedFiles
      
      if (appendMode) {
        // Append new files to existing ones
        finalFiles = [...existingFiles, ...acceptedFiles]
      }
      
      // Validate file types if enabled
      if (enableValidation && onFileValidation) {
        try {
          const validationPromises = finalFiles.map(file => validateFileType(file))
          const validations = await Promise.all(validationPromises)
          onFileValidation(validations)
        } catch (error) {
          console.error('Error validating files:', error)
        }
      }
      
      onFilesSelected(finalFiles)
      setDragActive(false)
    },
    [onFilesSelected, onFileValidation, appendMode, existingFiles, enableValidation]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: appendMode ? maxFiles - existingFiles.length : maxFiles,
    maxSize,
    accept,
    disabled,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  })

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${isDragActive || dragActive
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-300 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="space-y-2">
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <div className="text-sm text-gray-600">
          {isDragActive ? (
            <p>Drop the files here...</p>
          ) : (
            <div>
              <p className="font-medium">
                {appendMode ? 'Add more files or drag and drop' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {appendMode 
                  ? `${existingFiles.length}/${maxFiles} files selected, up to ${Math.round(maxSize / (1024 * 1024))}MB each`
                  : `Max ${maxFiles} files, up to ${Math.round(maxSize / (1024 * 1024))}MB each`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
