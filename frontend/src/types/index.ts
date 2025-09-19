export interface User {
  id: string
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  storageQuota: number
  createdAt: string
  updatedAt: string
}

export interface FileContent {
  id: string
  sha256Hash: string
  filePath: string
  size: number
  mimeType: string
  referenceCount: number
  createdAt: string
}

export interface UserFile {
  id: string
  userId: string
  fileContentId: string
  filename: string
  folderId?: string
  isPublic: boolean
  downloadCount: number
  tags: string[]
  createdAt: string
  updatedAt: string
  user?: User
  fileContent?: FileContent
  folder?: Folder
}

export interface Folder {
  id: string
  userId: string
  name: string
  parentFolderId?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
  user?: User
  parentFolder?: Folder
  subfolders?: Folder[]
  files?: UserFile[]
}

export interface FileShare {
  id: string
  fileId: string
  sharedWithUserId?: string
  shareType: 'PUBLIC' | 'PRIVATE' | 'USER_SPECIFIC'
  sharePeriod: 'PERMANENT' | 'TEMPORARY'
  createdAt: string
  updatedAt: string
  expiresAt?: string
  file?: UserFile
  sharedWithUser?: User
}

export interface AuditLog {
  id: string
  userId: string
  action: 'UPLOAD' | 'DOWNLOAD' | 'DELETE' | 'SHARE' | 'UNSHARE'
  fileId?: string
  ipAddress: string
  userAgent: string
  createdAt: string
  user?: User
  file?: UserFile
}

export interface StorageStats {
  totalUsed: number
  originalSize: number
  savedBytes: number
  savedPercentage: number
  userCount: number
  fileCount: number
}

export interface AuthPayload {
  token: string
  user: User
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  username: string
  email: string
  password: string
}

export interface CreateFolderInput {
  name: string
  parentFolderId?: string
  isPublic?: boolean
}

export interface UpdateFileInput {
  filename?: string
  tags?: string[]
  isPublic?: boolean
  folderId?: string
}

export interface FileFiltersInput {
  search?: string
  mimeType?: string
  sizeMin?: number
  sizeMax?: number
  dateFrom?: string
  dateTo?: string
  tags?: string[]
  uploadedBy?: string
  folderId?: string
  isPublic?: boolean
}
