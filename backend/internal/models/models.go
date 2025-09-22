package models

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	UserRoleUser  UserRole = "USER"
	UserRoleAdmin UserRole = "ADMIN"
)

type ShareType string

const (
	ShareTypePublic       ShareType = "PUBLIC"
	ShareTypePrivate      ShareType = "PRIVATE"
	ShareTypeUserSpecific ShareType = "USER_SPECIFIC"
)

type SharePeriod string

const (
	SharePeriodPermanent SharePeriod = "PERMANENT"
	SharePeriodTemporary SharePeriod = "TEMPORARY"
)

type AuditAction string

const (
	AuditActionUpload   AuditAction = "UPLOAD"
	AuditActionDownload AuditAction = "DOWNLOAD"
	AuditActionDelete   AuditAction = "DELETE"
	AuditActionShare    AuditAction = "SHARE"
	AuditActionUnshare  AuditAction = "UNSHARE"
)

type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         UserRole  `json:"role" db:"role"`
	StorageQuota int64     `json:"storage_quota" db:"storage_quota"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type FileContent struct {
	ID             uuid.UUID `json:"id" db:"id"`
	SHA256Hash     string    `json:"sha256_hash" db:"sha256_hash"`
	FilePath       string    `json:"file_path" db:"file_path"`
	Size           int64     `json:"size" db:"size"`
	MimeType       string    `json:"mime_type" db:"mime_type"`
	ReferenceCount int       `json:"reference_count" db:"reference_count"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type UserFile struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	UserID        uuid.UUID  `json:"user_id" db:"user_id"`
	FileContentID uuid.UUID  `json:"file_content_id" db:"file_content_id"`
	Filename      string     `json:"filename" db:"filename"`
	FolderID      *uuid.UUID `json:"folder_id,omitempty" db:"folder_id"`
	IsPublic      bool       `json:"is_public" db:"is_public"`
	DownloadCount int        `json:"download_count" db:"download_count"`
	Tags          []string   `json:"tags" db:"tags"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	ShareURL      string     `json:"share_url,omitempty"`

	User        *User        `json:"user,omitempty"`
	FileContent *FileContent `json:"file_content,omitempty"`
	Folder      *Folder      `json:"folder,omitempty"`
}

type Folder struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	UserID         uuid.UUID  `json:"user_id" db:"user_id"`
	Name           string     `json:"name" db:"name"`
	ParentFolderID *uuid.UUID `json:"parent_folder_id,omitempty" db:"parent_folder_id"`
	IsPublic       bool       `json:"is_public" db:"is_public"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`

	User         *User       `json:"user,omitempty"`
	ParentFolder *Folder     `json:"parent_folder,omitempty"`
	Subfolders   []*Folder   `json:"subfolders,omitempty"`
	Files        []*UserFile `json:"files,omitempty"`
}

type FileShare struct {
	ID               uuid.UUID   `json:"id" db:"id"`
	FileID           uuid.UUID   `json:"file_id" db:"file_id"`
	SharedWithUserID *uuid.UUID  `json:"shared_with_user_id,omitempty" db:"shared_with_user_id"`
	ShareType        ShareType   `json:"share_type" db:"share_type"`
	SharePeriod      SharePeriod `json:"share_period" db:"share_period"`
	CreatedAt        time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at" db:"updated_at"`

	File           *UserFile `json:"file,omitempty"`
	SharedWithUser *User     `json:"shared_with_user,omitempty"`
}

type AuditLog struct {
	ID        uuid.UUID   `json:"id" db:"id"`
	UserID    uuid.UUID   `json:"user_id" db:"user_id"`
	Action    AuditAction `json:"action" db:"action"`
	FileID    *uuid.UUID  `json:"file_id,omitempty" db:"file_id"`
	IPAddress string      `json:"ip_address" db:"ip_address"`
	UserAgent string      `json:"user_agent" db:"user_agent"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`

	User *User     `json:"user,omitempty"`
	File *UserFile `json:"file,omitempty"`
}

type StorageStats struct {
	TotalUsed       int64   `json:"total_used"`
	OriginalSize    int64   `json:"original_size"`
	SavedBytes      int64   `json:"saved_bytes"`
	SavedPercentage float64 `json:"saved_percentage"`
	UserCount       int     `json:"user_count"`
	FileCount       int     `json:"file_count"`
}
