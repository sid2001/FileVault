# High-Level Design (HLD) - File Vault Application

## 1. System Overview

File Vault is a secure cloud storage application that allows users to upload, manage, and share files with advanced features like deduplication and access control.

## 2. Architecture Overview

### 2.1 System Architecture
```
                        ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                        │   Frontend      │    │   Backend       │    │   Database      │
                        │   (Next.js)     │◄──►│   (Go + GraphQL)│◄──►│   (PostgreSQL)  │
                        │                 │    │                 │    │                 │
                        │ - React UI      │    │ - GraphQL API   │    │ - User Data     │
                        │ - Apollo Client │    │ - HTTP Routes   │    │ - File Metadata │
                        │ - Tailwind CSS  │    │ - File Service  │    │ - File Contents │
                        └─────────────────┘    └─────────────────┘    └─────────────────┘
                                                         │                       │
                                                         │                       │
                                                         ▼                       ▼
                                               ┌─────────────────┐    ┌─────────────────┐
                                               │   Redis Cache   │    │   File System   │
                                               │ (Rate Limiting) │    │     (Local)     │
                                               └─────────────────┘    └─────────────────┘
```

## 2. Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant GraphQL as GraphQL API
    participant Backend
    participant Auth as Authentication
    participant FileService as File Service
    participant DedupService as Deduplication Service
    participant FileSystem as File System
    participant Database

    Note over User, Database: 1 File Upload Flow
    
    User->>Frontend: 1. Select files
    Frontend->>Frontend: 2. Validate files (client-side)
    Frontend->>GraphQL: 3. Send files via mutation
    GraphQL->>Backend: Process upload request
    Backend->>FileService: 4. Process files
    FileService->>DedupService: 5. Check for duplicates
    DedupService-->>FileService: Deduplication result
    FileService->>FileSystem: 6. Store files
    FileService->>Database: 7. Save metadata
    Database-->>Backend: Confirmation
    Backend-->>GraphQL: Upload response
    GraphQL-->>Frontend: 8. Response sent
    Frontend->>User: 9. Update UI with uploaded files

    Note over User, Database: 2 File Download Flow
    
    User->>Frontend: 1. Click download
    Frontend->>Backend: 2. Send download request
    Backend->>Auth: 3. Check permissions
    Auth-->>Backend: Permission result
    Backend->>Database: 4. Retrieve file path
    Database-->>Backend: File path data
    Backend->>FileSystem: 5. Request file
    Backend->>Database: 6. Update download count
    FileSystem-->>Backend: File data
    Backend-->>Frontend: 7. Stream file
    Frontend->>User: 8. Download file

    Note over User, Database: 3 File Sharing Flow
    
    User->>Frontend: 1. Select share option
    Frontend->>GraphQL: 2. Send share request
    GraphQL->>Backend: Process share request
    Backend->>Backend: 3. Validate share type
    Backend->>Database: 4. Create share record
    Backend->>Backend: 5. Generate share URL
    Backend-->>GraphQL: Share link response
    GraphQL-->>Frontend: 6. Return share link
    Frontend->>User: 7. Display share link

```


### 3. Technology Stack

**Frontend:**
- Next.js 14 (React Framework)
- Apollo Client (GraphQL Client)
- Tailwind CSS (Styling)
- TypeScript (Type Safety)

**Backend:**
- Go (Programming Language)
- GraphQL (API Layer)
- GQLGen (Code Generation)

**Database:**
- PostgreSQL (Primary Database)
- Redis (Rate Limiting)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (Reverse Proxy)
- File System Storage



## 4. Security Architecture

### 4.1 Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Password Security**: Bcrypt hashing

### 4.2 Data Protection
- **Access Control**: Granular permission system
- **Audit Logging**: User action tracking
- **CORS Protection**: Cross-origin request security

### 4.3 Storage Security
- **File Deduplication**: Secure hash-based deduplication
- **Path Sanitization**: Prevent directory traversal
- **MIME Type Validation**: File type verification
- **Size Limits**: File size restrictions

## 5.1 Performance Optimization
- **Caching Strategy**: Redis for frequently accessed data
- **File Compression**: Automatic file compression
- **Lazy Loading**: On-demand data loading
- **Pagination**: Large dataset handling

### 5.2 Storage Optimization
- **Deduplication**: Reduce storage requirements
- **Storage Quotas**: User storage limits

## 6. Monitoring & Logging

### 6.1 Application Monitoring
- **Health Checks**: Service availability monitoring
- **Performance Metrics**: Response time tracking
- **Error Tracking**: Exception monitoring
- **Usage Analytics**: User behavior tracking

### 6.2 Audit Trail
- **User Actions**: Login, upload, download, delete
- **File Operations**: Share, unshare, modify
- **System Events**: Errors, warnings, info
- **Security Events**: Failed logins, suspicious activity

