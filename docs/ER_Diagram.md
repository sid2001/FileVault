# Entity Relationship (ER) Diagram - File Vault Database

## Database Schema Overview

The File Vault application uses PostgreSQL as the primary database with the following core entities and relationships.

## ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        enum role
        bigint storage_quota
        timestamptz created_at
        timestamptz updated_at
    }

    FILE_CONTENTS {
        uuid id PK
        varchar sha256_hash UK
        varchar file_path
        bigint size
        varchar mime_type
        int reference_count
        timestamptz created_at
    }

    USER_FILES {
        uuid id PK
        uuid user_id FK
        uuid file_content_id FK
        varchar filename
        uuid folder_id FK
        boolean is_public
        int download_count
        text[] tags
        timestamptz created_at
        timestamptz updated_at
    }

    FOLDERS {
        uuid id PK
        uuid user_id FK
        varchar name
        uuid parent_folder_id FK
        boolean is_public
        timestamptz created_at
        timestamptz updated_at
    }

    FILE_SHARES {
        uuid id PK
        uuid file_id FK
        uuid shared_with_user_id FK
        enum share_type
        enum share_period
        timestamptz created_at
        timestamptz updated_at
        timestamptz expires_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        enum action
        uuid file_id FK
        inet ip_address
        text user_agent
        timestamptz created_at
    }

    FILE_DOWNLOADS {
        uuid id PK
        uuid file_id FK
        uuid user_id FK
        inet ip_address
        text user_agent
        timestamptz created_at
        timestamptz expires_at
    }

    %% Relationships
    USERS ||--o{ USER_FILES : "owns"
    USERS ||--o{ FOLDERS : "creates"
    USERS ||--o{ FILE_SHARES : "shares"
    USERS ||--o{ AUDIT_LOGS : "performs"
    USERS ||--o{ FILE_DOWNLOADS : "downloads"

    FILE_CONTENTS ||--o{ USER_FILES : "contains"
    USER_FILES ||--o{ FILE_SHARES : "shared_as"
    USER_FILES ||--o{ AUDIT_LOGS : "involved_in"
    USER_FILES ||--o{ FILE_DOWNLOADS : "downloaded_as"

    FOLDERS ||--o{ USER_FILES : "contains"
    FOLDERS ||--o{ FOLDERS : "parent_of"

    USERS ||--o{ FILE_SHARES : "shared_with"
```

## Indexes

### Primary Indexes
- All tables have primary key indexes on `id` fields

### Unique Indexes
- `users.username` (unique)
- `users.email` (unique)
- `file_contents.sha256_hash` (unique)

### Performance Indexes
- `user_files.user_id` (frequent queries by user)
- `user_files.file_content_id` (file content lookups)
- `user_files.folder_id` (folder contents)
- `user_files.is_public` (public file queries)
- `file_shares.file_id` (file sharing lookups)
- `file_shares.shared_with_user_id` (user's shared files)
- `audit_logs.user_id` (user activity)
- `audit_logs.created_at` (time-based queries)

## Constraints

### Foreign Key Constraints
- `user_files.user_id` → `users.id` (CASCADE DELETE)
- `user_files.file_content_id` → `file_contents.id` (CASCADE DELETE)
- `user_files.folder_id` → `folders.id` (CASCADE DELETE)
- `folders.user_id` → `users.id` (CASCADE DELETE)
- `folders.parent_folder_id` → `folders.id` (CASCADE DELETE)
- `file_shares.file_id` → `user_files.id` (CASCADE DELETE)
- `file_shares.shared_with_user_id` → `users.id` (CASCADE DELETE)
- `audit_logs.user_id` → `users.id` (CASCADE DELETE)
- `audit_logs.file_id` → `user_files.id` (CASCADE DELETE)
- `file_downloads.file_id` → `user_files.id` (CASCADE DELETE)
- `file_downloads.user_id` → `users.id` (CASCADE DELETE)

### Check Constraints
- `users.storage_quota >= 0`
- `file_contents.size > 0`
- `file_contents.reference_count >= 0`
- `user_files.download_count >= 0`
- `audit_logs.created_at <= NOW()`
- `file_downloads.created_at <= NOW()`

## Triggers

### Update Timestamps
- `update_users_updated_at`: Updates `updated_at` on user changes
- `update_user_files_updated_at`: Updates `updated_at` on file changes
- `update_folders_updated_at`: Updates `updated_at` on folder changes
- `update_file_shares_updated_at`: Updates `updated_at` on share changes

### Storage Quota Management
- `update_storage_quota`: Automatically updates user storage quota when file reference counts change

## Data Integrity

### Referential Integrity
- All foreign key relationships are enforced
- Cascade deletes ensure data consistency
- Orphaned records are automatically cleaned up

### Business Logic Integrity
- File deduplication through SHA256 hashing
- Reference counting prevents premature file deletion
- Storage quota enforcement
- Share expiration handling

### Security Integrity
- Password hashing with bcrypt
- Audit trail for all user actions
- IP address and user agent tracking
- Secure file path storage
