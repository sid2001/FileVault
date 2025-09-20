package graph

import (
	"crypto/sha256"
	"encoding/hex"
	"file-vault/internal/models"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/lib/pq"
)

// func (r *Resolver) loadFoldersWithRelations(userID string, parentID *uuid.UUID) ([]*models.Folder, error) {
// 	// query := `
// 		// SELECT id, user_id, name, parent_folder_id, is_public, created_at, updated_at, `
// }

func (r *Resolver) loadUserFileWithRelations(fileID string) (*models.UserFile, error) {
	query := `
		SELECT uf.id, uf.user_id, uf.file_content_id, uf.filename, uf.folder_id,
			   uf.is_public, uf.download_count, uf.tags, uf.created_at, uf.updated_at,
			   u.id, u.username, u.email, u.role, u.storage_quota, u.created_at, u.updated_at,
			   fc.id, fc.sha256_hash, fc.file_path, fc.size, fc.mime_type, fc.reference_count, fc.created_at
		FROM user_files uf
		JOIN users u ON uf.user_id = u.id
		JOIN file_contents fc ON uf.file_content_id = fc.id
		WHERE uf.id = $1
	`

	var file models.UserFile
	var user models.User
	var fileContent models.FileContent

	err := r.DB.QueryRow(query, fileID).Scan(
		&file.ID, &file.UserID, &file.FileContentID, &file.Filename,
		&file.FolderID, &file.IsPublic, &file.DownloadCount,
		pq.Array(&file.Tags), &file.CreatedAt, &file.UpdatedAt,
		&user.ID, &user.Username, &user.Email, &user.Role,
		&user.StorageQuota, &user.CreatedAt, &user.UpdatedAt,
		&fileContent.ID, &fileContent.SHA256Hash, &fileContent.FilePath,
		&fileContent.Size, &fileContent.MimeType, &fileContent.ReferenceCount,
		&fileContent.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load file: %w", err)
	}

	file.User = &user
	file.FileContent = &fileContent

	return userFileToGraphQL(&file), nil
}

// Type conversion functions
func userToGraphQL(user *models.User) *models.User {
	return &models.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		Role:         models.UserRole(user.Role),
		StorageQuota: user.StorageQuota,
		CreatedAt:    user.CreatedAt,
		UpdatedAt:    user.UpdatedAt,
	}
}

func userFileToGraphQL(file *models.UserFile) *models.UserFile {
	result := &models.UserFile{
		ID:            file.ID,
		Filename:      file.Filename,
		IsPublic:      file.IsPublic,
		DownloadCount: file.DownloadCount,
		Tags:          file.Tags,
		CreatedAt:     file.CreatedAt,
		UpdatedAt:     file.UpdatedAt,
	}

	if file.User != nil {
		result.User = userToGraphQL(file.User)
	}

	if file.FileContent != nil {
		result.FileContent = &models.FileContent{
			ID:             file.FileContent.ID,
			SHA256Hash:     file.FileContent.SHA256Hash,
			Size:           int64(file.FileContent.Size),
			MimeType:       file.FileContent.MimeType,
			ReferenceCount: file.FileContent.ReferenceCount,
			CreatedAt:      file.FileContent.CreatedAt,
		}
	}

	if file.IsPublic {
		result.ShareURL = file.ID.String() // Simplified - would be full URL in production
	}

	return result
}

func folderToGraphQL(folder *models.Folder) *models.Folder {
	return &models.Folder{
		ID:        folder.ID,
		Name:      folder.Name,
		IsPublic:  folder.IsPublic,
		CreatedAt: folder.CreatedAt,
		UpdatedAt: folder.UpdatedAt,
	}
}

func fileShareToGraphQL(share *models.FileShare) *models.FileShare {
	return &models.FileShare{
		ID:        share.ID,
		ShareType: models.ShareType(share.ShareType),
		CreatedAt: share.CreatedAt,
	}
}

func storageStatsToGraphQL(stats *models.StorageStats) *models.StorageStats {
	return &models.StorageStats{
		TotalUsed:       int64(stats.TotalUsed),
		OriginalSize:    int64(stats.OriginalSize),
		SavedBytes:      int64(stats.SavedBytes),
		SavedPercentage: stats.SavedPercentage,
		UserCount:       stats.UserCount,
		FileCount:       stats.FileCount,
	}
}

func GenerateSHA256Hash(data *[]byte) (string, error) {
	hash := sha256.Sum256(*data)
	hashString := hex.EncodeToString(hash[:])

	return hashString, nil
}

// sanitizeFilename removes or replaces invalid characters for database storage
func sanitizeFilename(filename string) string {
	// Check if the string is valid UTF-8
	if !utf8.ValidString(filename) {
		// Replace invalid UTF-8 sequences with a placeholder
		filename = strings.ToValidUTF8(filename, "?")
	}

	// Remove or replace characters that might cause issues
	// Keep only alphanumeric, dots, hyphens, underscores, and spaces
	reg := regexp.MustCompile(`[^a-zA-Z0-9.\-_ ]+`)
	filename = reg.ReplaceAllString(filename, "_")

	// Remove leading/trailing spaces and dots
	filename = strings.Trim(filename, " .")

	// Ensure filename is not empty
	if filename == "" {
		filename = "unnamed_file"
	}

	// Limit filename length
	if len(filename) > 255 {
		filename = filename[:255]
	}

	return filename
}

// sanitizeMimeType ensures MIME type is valid UTF-8
func sanitizeMimeType(mimeType string) string {
	// Check if the string is valid UTF-8
	if !utf8.ValidString(mimeType) {
		// Replace invalid UTF-8 sequences with a placeholder
		mimeType = strings.ToValidUTF8(mimeType, "?")
	}

	// Remove any null bytes or control characters
	reg := regexp.MustCompile(`[\x00-\x1f\x7f]`)
	mimeType = reg.ReplaceAllString(mimeType, "")

	// Ensure MIME type is not empty
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Limit MIME type length
	if len(mimeType) > 255 {
		mimeType = mimeType[:255]
	}

	return mimeType
}
