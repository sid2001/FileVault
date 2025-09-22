# API Endpoints & Routes Documentation

This document provides comprehensive documentation for all API endpoints, routes, and GraphQL operations available in the File Vault application.

## Table of Contents

- [Overview](#overview)
- [Base URLs](#base-urls)
- [Authentication](#authentication)
- [GraphQL API](#graphql-api)
- [REST Endpoints](#rest-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

File Vault provides a GraphQL-based API for all operations, with some REST endpoints for specific functionality. The API supports:

- **GraphQL**: Primary API for all CRUD operations
- **REST**: File uploads, downloads, and static content
- **WebSocket**: Real-time subscriptions (planned)

## Base URLs

### Development
- **GraphQL API**: `http://localhost:8080/graphql`
- **REST API**: `http://localhost:8080/api`
- **Frontend**: `http://localhost:3000`

### Production
- **GraphQL API**: `https://api.filevault.com/graphql`
- **REST API**: `https://api.filevault.com/api`
- **Frontend**: `https://filevault.com`

## Authentication

### JWT Token Authentication
All API requests require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Token Acquisition
Obtain a token through the login mutation:

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      id
      username
      email
      role
    }
  }
}
```

## GraphQL API

### Base Endpoint
```
POST /graphql
Content-Type: application/json
Authorization: Bearer <token>
```

### Schema Overview

#### Types
- **User**: User account information
- **UserFile**: File metadata and content
- **FileContent**: Actual file data and storage info
- **Folder**: Folder structure and organization
- **FileShare**: File sharing and permissions
- **StorageStats**: Storage usage statistics
- **AuditLog**: System activity logs

#### Enums
- **UserRole**: USER, ADMIN
- **ShareType**: PUBLIC, PRIVATE, USER_SPECIFIC
- **AuditAction**: UPLOAD, DOWNLOAD, DELETE, SHARE, UNSHARE
- **SharePeriod**: TEMPORARY, PERMANENT

### Queries

#### Authentication & User Management

##### Get Current User
```graphql
query Me {
  me {
    id
    username
    email
    role
    storageQuota
    createdAt
    updatedAt
  }
}
```

##### Get All Users (Admin Only)
```graphql
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
```

#### File Management

##### Get User Files
```graphql
query Files($filters: FileFiltersInput, $limit: Int, $offset: Int) {
  files(filters: $filters, limit: $limit, offset: $offset) {
    id
    filename
    isPublic
    downloadCount
    tags
    createdAt
    updatedAt
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
```

##### Get Single File
```graphql
query File($id: ID!) {
  file(id: $id) {
    id
    filename
    isPublic
    downloadCount
    tags
    createdAt
    updatedAt
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
```

##### Get Public File
```graphql
query PublicFile($id: ID!) {
  publicFile(id: $id) {
    id
    filename
    isPublic
    downloadCount
    createdAt
    user {
      username
    }
    fileContent {
      size
      mimeType
    }
  }
}
```

##### Get Download URL
```graphql
query DownloadFile($id: ID!) {
  downloadFile(id: $id)
}
```

##### Get All Files (Admin Only)
```graphql
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
```

#### Folder Management

##### Get Folders
```graphql
query Folders($parentId: ID) {
  folders(parentId: $parentId) {
    id
    name
    isPublic
    createdAt
    updatedAt
    user {
      id
      username
    }
    files {
      id
      filename
    }
    subfolders {
      id
      name
    }
  }
}
```

##### Get Single Folder
```graphql
query Folder($id: ID!) {
  folder(id: $id) {
    id
    name
    isPublic
    createdAt
    updatedAt
    user {
      id
      username
    }
    files {
      id
      filename
      createdAt
    }
    subfolders {
      id
      name
      createdAt
    }
    parentFolder {
      id
      name
    }
  }
}
```

#### Storage & Statistics

##### Get Storage Stats
```graphql
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
```

##### Get User Storage Stats
```graphql
query UserStorageStats($userId: ID) {
  userStorageStats(userId: $userId) {
    totalUsed
    originalSize
    savedBytes
    savedPercentage
    userCount
    fileCount
  }
}
```

#### Audit Logs (Admin Only)

##### Get Audit Logs
```graphql
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
```

### Mutations

#### Authentication

##### Register User
```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      id
      username
      email
      role
      storageQuota
    }
  }
}
```

##### Login User
```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      id
      username
      email
      role
      storageQuota
    }
  }
}
```

#### File Operations

##### Upload Files
```graphql
mutation UploadFiles($files: [Upload!]!, $folderId: ID) {
  uploadFiles(files: $files, folderId: $folderId) {
    id
    filename
    isPublic
    downloadCount
    tags
    createdAt
    user {
      id
      username
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
```

##### Delete File
```graphql
mutation DeleteFile($fileId: ID!) {
  deleteFile(fileId: $fileId)
}
```

##### Update File
```graphql
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
    updatedAt
  }
}
```

#### Folder Operations

##### Create Folder
```graphql
mutation CreateFolder($input: CreateFolderInput!) {
  createFolder(input: $input) {
    id
    name
    isPublic
    createdAt
    user {
      id
      username
    }
    parentFolder {
      id
      name
    }
  }
}
```

##### Delete Folder
```graphql
mutation DeleteFolder($folderId: ID!) {
  deleteFolder(folderId: $folderId)
}
```

##### Update Folder
```graphql
mutation UpdateFolder($folderId: ID!, $name: String!) {
  updateFolder(folderId: $folderId, name: $name) {
    id
    name
    updatedAt
  }
}
```

#### File Sharing

##### Share File
```graphql
mutation ShareFile($fileId: ID!, $shareType: ShareType!, $userId: ID) {
  shareFile(fileId: $fileId, shareType: $shareType, userId: $userId) {
    id
    shareType
    sharePeriod
    createdAt
    file {
      id
      filename
    }
    sharedWithUser {
      id
      username
    }
  }
}
```

##### Unshare File
```graphql
mutation UnshareFile($fileId: ID!) {
  unshareFile(fileId: $fileId)
}
```

#### Admin Operations

##### Update User Quota
```graphql
mutation UpdateUserQuota($userId: ID!, $quota: Int!) {
  updateUserQuota(userId: $userId, quota: $quota) {
    id
    username
    email
    storageQuota
  }
}
```

##### Delete User
```graphql
mutation DeleteUser($userId: ID!) {
  deleteUser(userId: $userId)
}
```

### Subscriptions

#### File Upload Notifications
```graphql
subscription FileUploaded($userId: ID!) {
  fileUploaded(userId: $userId) {
    id
    filename
    createdAt
    user {
      id
      username
    }
  }
}
```

#### Download Count Updates
```graphql
subscription DownloadCountUpdated($fileId: ID!) {
  downloadCountUpdated(fileId: $fileId) {
    id
    filename
    downloadCount
  }
}
```

## REST Endpoints

### File Operations

#### Download File
```http
GET /api/files/{fileId}/download
Authorization: Bearer <token>
```

**Response:**
- **200**: File content with appropriate headers
- **404**: File not found
- **403**: Access denied

#### Upload File (Alternative to GraphQL)
```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
folderId: <optional_folder_id>
```

**Response:**
```json
{
  "success": true,
  "fileId": "uuid",
  "filename": "example.pdf",
  "size": 1024,
  "mimeType": "application/pdf"
}
```

### Health Check

#### System Status
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "database": "connected",
  "storage": "available"
}
```

## Error Handling

### GraphQL Errors

All GraphQL operations return errors in the standard GraphQL error format:

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "locations": [{"line": 2, "column": 3}],
      "path": ["me"],
      "extensions": {
        "code": "UNAUTHENTICATED",
        "timestamp": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "data": null
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 413 | Payload Too Large |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Error Types

| Error Code | Description |
|------------|-------------|
| `UNAUTHENTICATED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Input validation failed |
| `QUOTA_EXCEEDED` | Storage quota exceeded |
| `FILE_TOO_LARGE` | File size exceeds limit |
| `INVALID_FILE_TYPE` | File type not allowed |
| `RATE_LIMITED` | Too many requests |

## Rate Limiting

### Limits
- **GraphQL Queries**: 1000 requests per hour per user
- **File Uploads**: 100 requests per hour per user
- **File Downloads**: 5000 requests per hour per user
- **Admin Operations**: 500 requests per hour per admin

### Headers
Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Examples

### Complete File Upload Flow

1. **Login to get token:**
```graphql
mutation {
  login(input: { email: "user@example.com", password: "password" }) {
    token
    user { id username }
  }
}
```

2. **Upload file:**
```graphql
mutation UploadFile($file: Upload!, $folderId: ID) {
  uploadFiles(files: [$file], folderId: $folderId) {
    id
    filename
    fileContent { size mimeType }
  }
}
```

3. **Get file details:**
```graphql
query GetFile($id: ID!) {
  file(id: $id) {
    id
    filename
    downloadCount
    createdAt
  }
}
```

### File Search with Filters

```graphql
query SearchFiles($filters: FileFiltersInput!) {
  files(filters: $filters) {
    id
    filename
    fileContent { size mimeType }
    createdAt
  }
}
```

**Variables:**
```json
{
  "filters": {
    "search": "document",
    "mimeType": "application/pdf",
    "sizeMin": 1024,
    "sizeMax": 10485760,
    "dateFrom": "2024-01-01T00:00:00Z",
    "dateTo": "2024-12-31T23:59:59Z"
  }
}
```

### Admin Audit Logs

```graphql
query AdminAuditLogs {
  auditLogs(limit: 50) {
    id
    action
    createdAt
    user { username email }
    file { filename }
    ipAddress
    userAgent
  }
}
```

## Security Considerations

### Authentication
- All endpoints require valid JWT tokens
- Tokens expire after 24 hours
- Refresh tokens are not implemented (planned feature)

### Authorization
- Users can only access their own files
- Admins have access to all resources
- File sharing permissions are enforced

### Data Protection
- All file uploads are scanned for malware
- File content is encrypted at rest
- API communications use HTTPS only

### Input Validation
- All inputs are validated and sanitized
- File type restrictions are enforced
- Size limits are applied per user quota

## Testing

### GraphQL Playground
Access the interactive GraphQL playground at:
- **Development**: `http://localhost:8080/graphql`
- **Production**: `https://api.filevault.com/graphql`

### API Testing Tools
- **Postman**: Import the provided collection
- **Insomnia**: Use the GraphQL workspace
- **curl**: Examples provided for each endpoint

### Example curl Commands

```bash
# Login
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { login(input: {email: \"user@example.com\", password: \"password\"}) { token user { id username } } }"}'

# Get files with token
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "query { files { id filename createdAt } }"}'
```

## Changelog

### Version 1.0.0
- Initial API release
- GraphQL schema implementation
- Basic CRUD operations
- Authentication and authorization
- File upload and download
- Admin audit logs

### Planned Features
- WebSocket subscriptions
- Real-time notifications
- Advanced file sharing
- API versioning
- Rate limiting improvements
- OAuth2 integration
