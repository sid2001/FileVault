// File type verification using magic numbers (file signatures)
// This helps detect if a file's extension matches its actual content

export interface FileTypeInfo {
  extension: string
  mimeType: string
  magicNumbers: number[][]
  description: string
}

// Common file type signatures
export const FILE_TYPES: FileTypeInfo[] = [
  {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    magicNumbers: [[0xFF, 0xD8, 0xFF]],
    description: 'JPEG Image'
  },
  {
    extension: 'png',
    mimeType: 'image/png',
    magicNumbers: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    description: 'PNG Image'
  },
  {
    extension: 'gif',
    mimeType: 'image/gif',
    magicNumbers: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    description: 'GIF Image'
  },
  {
    extension: 'pdf',
    mimeType: 'application/pdf',
    magicNumbers: [[0x25, 0x50, 0x44, 0x46]],
    description: 'PDF Document'
  },
  {
    extension: 'zip',
    mimeType: 'application/zip',
    magicNumbers: [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
    description: 'ZIP Archive'
  },
  {
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magicNumbers: [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based format
    description: 'Word Document (DOCX)'
  },
  {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magicNumbers: [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based format
    description: 'Excel Spreadsheet (XLSX)'
  },
  {
    extension: 'pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    magicNumbers: [[0x50, 0x4B, 0x03, 0x04]], // ZIP-based format
    description: 'PowerPoint Presentation (PPTX)'
  },
  {
    extension: 'txt',
    mimeType: 'text/plain',
    magicNumbers: [], // Text files don't have magic numbers
    description: 'Text File'
  },
  {
    extension: 'mp4',
    mimeType: 'video/mp4',
    magicNumbers: [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]],
    description: 'MP4 Video'
  },
  {
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    magicNumbers: [[0x49, 0x44, 0x33], [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2]],
    description: 'MP3 Audio'
  }
]

export interface FileValidationResult {
  isValid: boolean
  detectedType: FileTypeInfo | null
  expectedType: FileTypeInfo | null
  warning?: string
  isExtensionMismatch: boolean
}

/**
 * Reads the first few bytes of a file to get its magic number
 */
async function readFileHeader(file: File, bytesToRead: number = 16): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer
      const bytes = new Uint8Array(arrayBuffer)
      resolve(Array.from(bytes.slice(0, bytesToRead)))
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file.slice(0, bytesToRead))
  })
}

/**
 * Checks if the file's magic number matches any of the expected magic numbers
 */
function matchesMagicNumber(fileBytes: number[], expectedMagicNumbers: number[][]): boolean {
  return expectedMagicNumbers.some(magicNumber => {
    if (magicNumber.length === 0) return false // Skip empty magic numbers (like text files)
    return magicNumber.every((byte, index) => fileBytes[index] === byte)
  })
}

/**
 * Gets file type info by extension
 */
function getFileTypeByExtension(extension: string): FileTypeInfo | null {
  return FILE_TYPES.find(type => type.extension.toLowerCase() === extension.toLowerCase()) || null
}

/**
 * Detects the actual file type based on magic numbers
 */
function detectFileTypeByMagicNumber(fileBytes: number[]): FileTypeInfo | null {
  for (const fileType of FILE_TYPES) {
    if (matchesMagicNumber(fileBytes, fileType.magicNumbers)) {
      return fileType
    }
  }
  return null
}

/**
 * Validates if a file's extension matches its actual content
 */
export async function validateFileType(file: File): Promise<FileValidationResult> {
  try {
    // Get file extension
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const expectedType = getFileTypeByExtension(extension)
    
    // Read file header
    const fileBytes = await readFileHeader(file)
    
    // Detect actual file type
    const detectedType = detectFileTypeByMagicNumber(fileBytes)
    
    // Check for extension mismatch
    const isExtensionMismatch = expectedType && detectedType && 
      expectedType.extension !== detectedType.extension
    
    let warning: string | undefined
    
    if (isExtensionMismatch) {
      warning = `File extension (.${extension}) doesn't match actual file type (${detectedType.description}). This might be a renamed file.`
    } else if (!expectedType && !detectedType) {
      warning = `Unknown file type. File extension (.${extension}) is not recognized.`
    } else if (!expectedType && detectedType) {
      warning = `File extension (.${extension}) is not recognized, but file appears to be ${detectedType.description}.`
    }
    
    return {
      isValid: !isExtensionMismatch,
      detectedType,
      expectedType,
      warning,
      isExtensionMismatch: !!isExtensionMismatch
    }
  } catch (error) {
    console.error('Error validating file type:', error)
    return {
      isValid: false,
      detectedType: null,
      expectedType: null,
      warning: 'Unable to validate file type',
      isExtensionMismatch: false
    }
  }
}

/**
 * Validates multiple files
 */
export async function validateMultipleFiles(files: File[]): Promise<FileValidationResult[]> {
  const validationPromises = files.map(file => validateFileType(file))
  return Promise.all(validationPromises)
}

/**
 * Gets a user-friendly file type description
 */
export function getFileTypeDescription(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const fileType = getFileTypeByExtension(extension)
  return fileType?.description || `Unknown file type (.${extension})`
}
