package graph

// THIS CODE WILL BE UPDATED WITH SCHEMA CHANGES. PREVIOUS IMPLEMENTATION FOR SCHEMA CHANGES WILL BE KEPT IN THE COMMENT SECTION. IMPLEMENTATION FOR UNCHANGED SCHEMA WILL BE KEPT.

import (
	"context"
	"database/sql"
	backend "file-vault"
	"file-vault/internal/auth"
	"file-vault/internal/config"
	"file-vault/internal/graph/generated"
	"file-vault/internal/models"
	"file-vault/internal/services"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Resolver struct {
	DB             *sql.DB
	FileService    *services.FileService
	DedupService   *services.DeduplicationService
	RateLimiter    *services.RateLimiter
	StorageService *services.StorageService
	Config         *config.Config
}

// Size is the resolver for the size field.
func (r *fileContentResolver) Size(ctx context.Context, obj *models.FileContent) (int, error) {
	return int(obj.Size), nil
	// panic("not implemented size")
}

// UploadFiles is the resolver for the uploadFiles field.
func (r *mutationResolver) UploadFiles(ctx context.Context, files []*graphql.Upload, folderId *uuid.UUID) ([]*models.UserFile, error) {
	// panic("not implemented uploadFiles")
	fmt.Printf(" UploadFiles: Starting UploadFiles query\n")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	// // Convert GraphQL uploads to service uploads
	var serviceFiles []*services.UploadFile
	for _, file := range files {
		fileContent, err := io.ReadAll(file.File)
		if err != nil {
			fmt.Printf("Read failed: %v\n", err)
			return nil, fmt.Errorf("Falied::Read file: %w", err)
		}
		fmt.Printf("Read file Content\n")
		hash, err := GenerateSHA256Hash(&fileContent)
		if err != nil {
			fmt.Printf("failed hash generation: %v\n", err)
			return nil, err
		}
		serviceFile := &services.UploadFile{
			Content:  fileContent,
			Size:     file.Size,
			Hash:     hash,
			MimeType: sanitizeMimeType(file.ContentType),
			Name:     sanitizeFilename(file.Filename),
		}
		serviceFiles = append(serviceFiles, serviceFile)
	}
	fmt.Printf(" Generated hash for %d files\n", len(serviceFiles))
	filePaths, err := r.FileService.UploadFiles(serviceFiles)
	if err != nil {
		return nil, err
	}
	for i, file := range serviceFiles {
		var fileId uuid.UUID
		query := `
			INSERT INTO file_contents (sha256_hash, file_path, size, mime_type, reference_count)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (sha256_hash)
			DO UPDATE SET reference_count = file_contents.reference_count + 1
			RETURNING id;`

		// Debug logging to identify UTF-8 issues
		fmt.Printf("DEBUG: Inserting file_content - Hash: %s, Path: %s, Size: %d, MimeType: %s\n",
			file.Hash, filePaths[i], file.Size, file.MimeType)

		err := r.DB.QueryRow(query, file.Hash, filePaths[i], file.Size, file.MimeType, 1).Scan(&fileId)
		if err != nil {
			fmt.Printf("ERROR: Failed to insert file_content: %v\n", err)
			return nil, fmt.Errorf("failed to insert file content: %w", err)
		}
		query = `
			INSERT INTO user_files (user_id, file_content_id, filename, folder_id)	
			VALUES ($1, $2, $3, $4);
		`
		// Debug logging for user_files insertion
		fmt.Printf("DEBUG: Inserting user_file - UserID: %s, FileID: %s, Filename: %s, FolderID: %v\n",
			userID, fileId, file.Name, folderId)

		_, err = r.DB.Exec(query, userID, fileId, file.Name, folderId)
		if err != nil {
			fmt.Printf("ERROR: Failed to insert user_file: %v\n", err)
			return nil, fmt.Errorf("failed to insert user file: %w", err)
		}
	}

	// Get the uploaded file IDs to return
	var result []*models.UserFile
	for _, file := range serviceFiles {
		// Get the file content ID that was inserted
		var fileContentID uuid.UUID
		query := `SELECT id FROM file_contents WHERE sha256_hash = $1`
		err := r.DB.QueryRow(query, file.Hash).Scan(&fileContentID)
		if err != nil {
			return nil, fmt.Errorf("failed to get file content ID: %w", err)
		}

		// Get the user file ID that was inserted
		var userFileID uuid.UUID
		query = `SELECT id FROM user_files WHERE user_id = $1 AND file_content_id = $2 AND filename = $3`
		err = r.DB.QueryRow(query, userID, fileContentID, file.Name).Scan(&userFileID)
		if err != nil {
			return nil, fmt.Errorf("failed to get user file ID: %w", err)
		}

		// Load the full file object with relations
		fullFile, err := r.loadUserFileWithRelations(userFileID.String())
		if err != nil {
			return nil, fmt.Errorf("failed to load file relations: %w", err)
		}
		result = append(result, fullFile)
	}

	// Log audit event for file upload
	ipAddress, userAgent := r.getClientInfo(ctx)
	fmt.Printf("UploadFiles: Creating audit logs for %d files\n", len(result))
	for _, file := range result {
		fileIDStr := file.ID.String()
		fmt.Printf("UploadFiles: Creating audit log for file %s\n", fileIDStr)
		err := r.createAuditLog(ctx, userID, models.AuditActionUpload, &fileIDStr, ipAddress, userAgent)
		if err != nil {
			fmt.Printf("Warning: Failed to create audit log for upload: %v\n", err)
		} else {
			fmt.Printf("UploadFiles: Successfully created audit log for file %s\n", fileIDStr)
		}
	}

	return result, nil
}

// DeleteFile is the resolver for the deleteFile field.
func (r *mutationResolver) DeleteFile(ctx context.Context, fileId uuid.UUID) (bool, error) {
	// panic("not implemented deleteFile")
	userID, err := auth.RequireAuth(ctx)
	fmt.Printf(" DeleteFile: Starting DeleteFile query: %v\n", fileId.String())
	if err != nil {
		return false, fmt.Errorf("authentication required")
	}

	// Check if user is admin
	userRole := auth.GetUserRoleFromContext(ctx)
	isAdmin := userRole == "ADMIN"

	// transaction
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	// Verify file ownership (admin can delete any file, regular users only their own)
	var exists bool
	var fileContentID uuid.UUID
	var query string
	var args []interface{}

	if isAdmin {
		// Admin can delete any file
		query = `SELECT file_content_id FROM user_files WHERE id = $1`
		args = []interface{}{fileId}
	} else {
		// Regular users can only delete their own files
		query = `SELECT file_content_id FROM user_files WHERE id = $1 AND user_id = $2`
		args = []interface{}{fileId, userID}
	}

	err = tx.QueryRow(query, args...).Scan(&fileContentID)
	exists = (err != sql.ErrNoRows)
	if err != nil {
		return false, err
	}
	if exists {
		// Delete file
		fmt.Printf(" DeleteFile: Deleting file: %v\n", fileId.String())
		query := `UPDATE file_contents SET reference_count = reference_count - 1 WHERE id = $1 RETURNING reference_count`
		var referenceCount int

		if err := tx.QueryRow(query, fileContentID).Scan(&referenceCount); err != nil {
			fmt.Printf(" DeleteFile: Failed to update reference count: %v\n", err)
			return false, err
		}
		fmt.Printf(" DeleteFile: Reference count updated: %v\n", referenceCount)
		var filePath string
		if referenceCount <= 0 {
			query := `DELETE FROM file_contents WHERE id = $1 RETURNING file_path`
			if err := tx.QueryRow(query, fileContentID).Scan(&filePath); err != nil {
				return false, err
			}
		}

		query = `DELETE FROM user_files WHERE id = $1`
		if _, err := tx.Exec(query, fileId); err != nil {
			return false, err
		}

		if err := tx.Commit(); err != nil {
			return false, err
		}
		if referenceCount <= 0 && r.FileService.DeleteFile(filePath) != nil {
			fmt.Printf("Warning::Failed to delete the file from storage\n")
		}

		// Log audit event for file deletion
		ipAddress, userAgent := r.getClientInfo(ctx)
		fileIDStr := fileId.String()
		fmt.Printf("DeleteFile: Creating audit log for file deletion %s\n", fileIDStr)
		err = r.createAuditLog(ctx, userID, models.AuditActionDelete, &fileIDStr, ipAddress, userAgent)
		if err != nil {
			fmt.Printf("Warning: Failed to create audit log for deletion: %v\n", err)
		} else {
			fmt.Printf("DeleteFile: Successfully created audit log for file deletion %s\n", fileIDStr)
		}

		return true, nil
	} else {
		return false, fmt.Errorf("file not found or access denied")
	}
}

// UpdateFile is the resolver for the updateFile field.
func (r *mutationResolver) UpdateFile(ctx context.Context, fileID uuid.UUID, input *backend.UpdateFileInput) (*models.UserFile, error) {
	// panic("not implemented updateFile")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	// Build update query dynamically
	setParts := []string{}
	args := []interface{}{fileID, userID}
	argCount := 2

	if input.Filename != nil {
		argCount++
		setParts = append(setParts, fmt.Sprintf("filename = $%d", argCount))
		args = append(args, *input.Filename)
	}

	if input.Tags != nil {
		argCount++
		setParts = append(setParts, fmt.Sprintf("tags = $%d", argCount))
		args = append(args, pq.Array((*input).Tags))
	}

	if input.IsPublic != nil {
		argCount++
		setParts = append(setParts, fmt.Sprintf("is_public = $%d", argCount))
		args = append(args, *input.IsPublic)
	}

	if input.FolderID != nil {
		argCount++
		setParts = append(setParts, fmt.Sprintf("folder_id = $%d", argCount))
		if (*input.FolderID).String() == "" {
			args = append(args, nil)
		} else {
			args = append(args, *input.FolderID)
		}
	}

	if len(setParts) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	argCount++
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argCount))
	args = append(args, time.Now())

	query := fmt.Sprintf(`
		UPDATE user_files 
		SET %s 
		WHERE id = $1 AND user_id = $2
	`, strings.Join(setParts, ", "))

	result, err := r.DB.Exec(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update file: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to get affected rows: %w", err)
	}
	if rowsAffected == 0 {
		return nil, fmt.Errorf("file not found or access denied")
	}

	return r.loadUserFileWithRelations(fileID.String())
}

// CreateFolder is the resolver for the createFolder field.
func (r *mutationResolver) CreateFolder(ctx context.Context, input backend.CreateFolderInput) (*models.Folder, error) {
	// panic("not implemented createFolder")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	folder := &models.Folder{
		ID:        uuid.New(),
		UserID:    uuid.MustParse(userID),
		Name:      input.Name,
		IsPublic:  *input.IsPublic,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if input.ParentFolderID != nil {
		parentID := *input.ParentFolderID
		folder.ParentFolderID = &parentID
	}

	query := `
		INSERT INTO folders (id, user_id, name, parent_folder_id, is_public, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = r.DB.Exec(query, folder.ID, folder.UserID, folder.Name,
		folder.ParentFolderID, folder.IsPublic, folder.CreatedAt, folder.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create folder: %w", err)
	}

	return folderToGraphQL(folder), nil
}

// DeleteFolder is the resolver for the deleteFolder field.
func (r *mutationResolver) DeleteFolder(ctx context.Context, folderID uuid.UUID) (bool, error) {
	panic("not implemented deleteFolder")
}

// UpdateFolder is the resolver for the updateFolder field.
func (r *mutationResolver) UpdateFolder(ctx context.Context, folderID uuid.UUID, name string) (*models.Folder, error) {
	panic("not implemented updateFolder")
}

// ShareFile is the resolver for the shareFile field.
func (r *mutationResolver) ShareFile(ctx context.Context, fileId uuid.UUID, shareType models.ShareType, userId *uuid.UUID) (*models.FileShare, error) {
	// panic("not implemented shareFile")
	currentUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	// Verify file ownership
	var count int
	err = r.DB.QueryRow("SELECT COUNT(*) FROM user_files WHERE id = $1 AND user_id = $2",
		fileId, currentUserID).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if count == 0 {
		return nil, fmt.Errorf("file not found or access denied")
	}

	// Create file share
	share := &models.FileShare{
		ID:        uuid.New(),
		FileID:    fileId,
		ShareType: models.ShareType(shareType),
		CreatedAt: time.Now(),
	}

	if userId != nil {
		sharedWithUserID := *userId
		share.SharedWithUserID = &sharedWithUserID
	}

	query := `
		INSERT INTO file_shares (id, file_id, shared_with_user_id, share_type, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err = r.DB.Exec(query, share.ID, share.FileID, share.SharedWithUserID,
		share.ShareType, share.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create file share: %w", err)
	}

	// Update file visibility if public
	if shareType == models.ShareTypePublic {
		_, err = r.DB.Exec("UPDATE user_files SET is_public = true WHERE id = $1", fileId)
		if err != nil {
			return nil, fmt.Errorf("failed to update file visibility: %w", err)
		}
	}

	return fileShareToGraphQL(share), nil
}

// UnshareFile is the resolver for the unshareFile field.
func (r *mutationResolver) UnshareFile(ctx context.Context, fileID uuid.UUID) (bool, error) {
	panic("not implemented unshareFile")
}

// UpdateUserQuota is the resolver for the updateUserQuota field.
func (r *mutationResolver) UpdateUserQuota(ctx context.Context, userID uuid.UUID, quota int) (*models.User, error) {
	panic("not implemented updateUserQuota")
}

// DeleteUser is the resolver for the deleteUser field.
func (r *mutationResolver) DeleteUser(ctx context.Context, userID uuid.UUID) (bool, error) {
	userId, err := auth.RequireAuth(ctx)
	if err != nil {
		return false, fmt.Errorf("authentication required")
	}
	if userId != userID.String() {
		return false, fmt.Errorf("unauthorized")
	}

	query := `DELETE FROM users WHERE id = $1`
	_, err = r.DB.Exec(query, userID)
	if err != nil {
		return false, fmt.Errorf("failed to delete user: %w", err)
	}
	return true, nil
}

// Me is the resolver for the me field.
func (r *queryResolver) Me(ctx context.Context) (*models.User, error) {
	fmt.Printf(" Me: Starting Me query\n")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		fmt.Printf(" Me: Authentication failed: %v\n", err)
		return nil, fmt.Errorf("Failed::Authentication required: %w", err)
	}
	fmt.Printf(" Me: Authenticated user ID: %v\n", userID)

	var user models.User
	query := `SELECT id, username, email, password_hash, role, storage_quota, created_at, updated_at FROM users WHERE id = $1`
	err = r.DB.QueryRow(query, userID).Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.Role, &user.StorageQuota, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		fmt.Printf(" Me: Database error: %v\n", err)
		return nil, fmt.Errorf("Failed::User not found: %w", err)
	}

	fmt.Printf(" Me: Found user: %v\n", user.Username)
	return userToGraphQL(&user), nil
}

// Users is the resolver for the users field.
func (r *queryResolver) Users(ctx context.Context, limit *int, offset *int) ([]*models.User, error) {
	// Require admin authentication
	_, err := auth.RequireAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin authentication required: %w", err)
	}

	// Set default values
	limitValue := 20
	if limit != nil {
		limitValue = *limit
	}
	offsetValue := 0
	if offset != nil {
		offsetValue = *offset
	}

	query := `
		SELECT id, username, email, password_hash, role, storage_quota, created_at, updated_at 
		FROM users 
		ORDER BY created_at DESC 
		LIMIT $1 OFFSET $2
	`

	rows, err := r.DB.Query(query, limitValue, offsetValue)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID, &user.Username, &user.Email, &user.PasswordHash,
			&user.Role, &user.StorageQuota, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, &user)
	}

	return users, nil
}

// Files is the resolver for the files field.
func (r *queryResolver) Files(ctx context.Context, filters *backend.FileFiltersInput, limit *int, offset *int) ([]*models.UserFile, error) {
	// panic("not implemented Files")
	fmt.Printf(" Files: Starting Files query\n")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	// Build query with filters
	baseQuery := `
		SELECT uf.id, uf.user_id, uf.file_content_id, uf.filename, uf.folder_id,
			   uf.is_public, uf.download_count, uf.tags, uf.created_at, uf.updated_at
		FROM user_files uf
		JOIN file_contents fc ON uf.file_content_id = fc.id
		WHERE uf.user_id = $1
	`

	args := []interface{}{userID}
	argCount := 1
	conditions := []string{}

	if filters != nil {
		fmt.Printf("Filter request\n")
		if filters.Search != nil {
			fmt.Printf("Search: %s\n", *filters.Search)
		}
		if filters.Search != nil && *filters.Search != "" {
			argCount++
			conditions = append(conditions, fmt.Sprintf("uf.filename ILIKE $%d", argCount))
			args = append(args, "%"+*filters.Search+"%")
		}

		if filters.MimeType != nil && *filters.MimeType != "" {
			argCount++
			conditions = append(conditions, fmt.Sprintf("fc.mime_type LIKE $%d", argCount))
			args = append(args, *filters.MimeType+"%")
		}

		if filters.SizeMin != nil {
			argCount++
			conditions = append(conditions, fmt.Sprintf("fc.size >= $%d", argCount))
			args = append(args, *filters.SizeMin)
		}

		if filters.SizeMax != nil {
			argCount++
			conditions = append(conditions, fmt.Sprintf("fc.size <= $%d", argCount))
			args = append(args, *filters.SizeMax)
		}

		if filters.DateFrom != nil {
			argCount++
			conditions = append(conditions, fmt.Sprintf("uf.created_at >= $%d", argCount))
			args = append(args, *filters.DateFrom)
		}

		if filters.DateTo != nil {
			argCount++
			conditions = append(conditions, fmt.Sprintf("uf.created_at <= $%d", argCount))
			args = append(args, *filters.DateTo)
		}

		if len(filters.Tags) > 0 {
			argCount++
			conditions = append(conditions, fmt.Sprintf("uf.tags && $%d", argCount))
			args = append(args, pq.Array(filters.Tags))
		}

		if filters.FolderID != nil {
			if (*filters.FolderID).String() == "" {
				conditions = append(conditions, "uf.folder_id IS NULL")
			} else {
				argCount++
				conditions = append(conditions, fmt.Sprintf("uf.folder_id = $%d", argCount))
				args = append(args, *filters.FolderID)
			}
		}
	}

	if len(conditions) > 0 {
		baseQuery += " AND " + strings.Join(conditions, " AND ")
	}

	baseQuery += " ORDER BY uf.created_at DESC"

	// Add pagination
	limitValue := 20
	if limit != nil {
		limitValue = *limit
	}
	offsetValue := 0
	if offset != nil {
		offsetValue = *offset
	}

	argCount++
	baseQuery += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limitValue)

	argCount++
	baseQuery += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offsetValue)

	fmt.Printf("Final SQL Query: %s\n", baseQuery)
	fmt.Printf("Query Args: %v\n", args)

	rows, err := r.DB.Query(baseQuery, args...)
	if err != nil {
		fmt.Printf("Database query error: %v\n", err)
		fmt.Printf("Query: %s\n", baseQuery)
		fmt.Printf("Args: %v\n", args)
		return nil, fmt.Errorf("failed to query files: %w", err)
	}
	defer rows.Close()

	var files []*models.UserFile
	for rows.Next() {
		var file models.UserFile
		err := rows.Scan(
			&file.ID, &file.UserID, &file.FileContentID, &file.Filename,
			&file.FolderID, &file.IsPublic, &file.DownloadCount,
			pq.Array(&file.Tags), &file.CreatedAt, &file.UpdatedAt,
		)
		if err != nil {
			fmt.Printf("Row scan error: %v\n", err)
			return nil, fmt.Errorf("failed to scan file: %w", err)
		}

		graphqlFile, err := r.loadUserFileWithRelations(file.ID.String())
		if err != nil {
			return nil, err
		}
		files = append(files, graphqlFile)
	}

	return files, nil
}

// File is the resolver for the file field.
func (r *queryResolver) File(ctx context.Context, id uuid.UUID) (*models.UserFile, error) {
	panic("not implemented File")
}

// PublicFile is the resolver for the publicFile field.
func (r *queryResolver) PublicFile(ctx context.Context, id uuid.UUID) (*models.UserFile, error) {
	panic("not implemented PublicFile")
}

// DownloadFile is the resolver for the downloadFile field.
func (r *queryResolver) DownloadFile(ctx context.Context, id uuid.UUID) (string, error) {
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("authentication required")
	}

	// Get file information and verify ownership
	var fileContentID uuid.UUID
	var filename string
	var userFileID uuid.UUID
	var ownerID uuid.UUID
	query := `
		SELECT uf.file_content_id, uf.filename, uf.id, uf.user_id
		FROM user_files uf
		WHERE uf.id = $1 AND (uf.user_id = $2 OR uf.is_public = true)
	`
	err = r.DB.QueryRow(query, id, userID).Scan(&fileContentID, &filename, &userFileID, &ownerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("file not found or access denied")
		}
		return "", fmt.Errorf("failed to query file: %w", err)
	}

	// dowload link will remain valid for 1 hour
	var downloadID uuid.UUID
	query = `INSERT INTO file_downloads (user_id, owner_id, user_file_id, file_name, file_content_id, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	err = r.DB.QueryRow(query, userID, ownerID, userFileID, filename, fileContentID, time.Now().Add(time.Hour)).Scan(&downloadID)
	if err != nil {
		return "", fmt.Errorf("failed to insert file download: %w", err)
	}

	// download URL will include userID whom the file issued for download for verification
	// we extract userID from token and compare it with the userID from the URI when downlading file
	// Return the download URL
	// download URL from a http handler
	downloadURL := fmt.Sprintf("/api/files/%s/download/%s", downloadID.String(), userID)
	return downloadURL, nil
}

// Folders is the resolver for the folders field.
func (r *queryResolver) Folders(ctx context.Context, parentId *uuid.UUID) ([]*models.Folder, error) {
	panic("not implemented Folders")
	// userId, err := auth.RequireAuth(ctx)
	// if err != nil {
	// 	return nil, fmt.Errorf("Failed::User authentication: %w", err)
	// }
	// return r.loadFoldersWithRelations(userId, parentId)
}

// Folder is the resolver for the folder field.
func (r *queryResolver) Folder(ctx context.Context, id uuid.UUID) (*models.Folder, error) {
	panic("not implemented Folder")
}

// StorageStats is the resolver for the storageStats field.
func (r *queryResolver) StorageStats(ctx context.Context) (*models.StorageStats, error) {
	_, err := auth.RequireAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	stats, err := r.StorageService.GetGlobalStats()
	if err != nil {
		return nil, fmt.Errorf("failed to get storage stats: %w", err)
	}

	return storageStatsToGraphQL(stats), nil
	// panic("not implemented StorageStats")
}

// UserStorageStats is the resolver for the userStorageStats field.
func (r *queryResolver) UserStorageStats(ctx context.Context, userId *uuid.UUID) (*models.StorageStats, error) {
	// panic("not implemented UserStorageStats")
	userID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("Failed::User authentication: %w", err)
	}
	if userID == "" {
		return nil, fmt.Errorf("Failed::User not found")
	}
	// fmt.Println("User Id:", userId)
	// fmt.Println("User ID:", userID)
	stats, err := r.StorageService.GetUserStats(userID)
	if err != nil {
		return nil, fmt.Errorf("Failed::Failed to get user storage stats: %w", err)
	}
	return storageStatsToGraphQL(stats), nil
}

// AuditLogs is the resolver for the auditLogs field.
func (r *queryResolver) AuditLogs(ctx context.Context, limit *int, offset *int) ([]*models.AuditLog, error) {
	// Require admin authentication
	_, err := auth.RequireAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin authentication required: %w", err)
	}

	// Set default values
	limitValue := 50
	if limit != nil {
		limitValue = *limit
	}
	offsetValue := 0
	if offset != nil {
		offsetValue = *offset
	}

	fmt.Printf("AuditLogs: Querying audit logs with limit=%d, offset=%d\n", limitValue, offsetValue)

	query := `
		SELECT al.id, al.user_id, al.action, al.file_id, al.ip_address, al.user_agent, al.created_at
		FROM audit_logs al
		ORDER BY al.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.DB.Query(query, limitValue, offsetValue)
	if err != nil {
		fmt.Printf("AuditLogs: Database query error: %v\n", err)
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var auditLogs []*models.AuditLog
	rowCount := 0
	for rows.Next() {
		rowCount++
		var auditLog models.AuditLog
		var userID uuid.UUID
		var fileID *uuid.UUID
		err := rows.Scan(
			&auditLog.ID, &userID, &auditLog.Action, &fileID,
			&auditLog.IPAddress, &auditLog.UserAgent, &auditLog.CreatedAt,
		)
		if err != nil {
			fmt.Printf("AuditLogs: Failed to scan row %d: %v\n", rowCount, err)
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		fmt.Printf("AuditLogs: Processing row %d - ID: %s, UserID: %s, Action: %s\n", rowCount, auditLog.ID, userID, auditLog.Action)

		// Load user information
		user, err := r.loadUserByID(userID.String())
		if err != nil {
			// If user doesn't exist (deleted), create a placeholder user
			fmt.Printf("Warning: User %s not found for audit log, creating placeholder\n", userID.String())
			auditLog.User = &models.User{
				ID:       userID,
				Username: "Deleted User",
				Email:    "deleted@user.com",
				Role:     models.UserRoleUser,
			}
		} else {
			auditLog.User = user
		}

		// Load file information if file_id exists
		if fileID != nil {
			file, err := r.loadUserFileForAuditLog(fileID.String())
			if err != nil {
				// If file doesn't exist (deleted), we'll just skip it
				fmt.Printf("AuditLogs: File %s not found for audit log: %v\n", fileID.String(), err)
				auditLog.File = nil
			} else {
				auditLog.File = file
			}
		}

		auditLogs = append(auditLogs, &auditLog)
	}

	fmt.Printf("AuditLogs: Successfully processed %d audit log entries\n", len(auditLogs))
	return auditLogs, nil
}

// Helper function to load user by ID
func (r *queryResolver) loadUserByID(userID string) (*models.User, error) {
	query := `
		SELECT id, username, email, password_hash, role, storage_quota, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user models.User
	err := r.DB.QueryRow(query, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash,
		&user.Role, &user.StorageQuota, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// Helper function to load user file by ID
func (r *queryResolver) loadUserFileByID(fileID string) (*models.UserFile, error) {
	query := `
		SELECT uf.id, uf.user_id, uf.file_content_id, uf.filename, uf.folder_id,
			   uf.is_public, uf.download_count, uf.tags, uf.created_at, uf.updated_at
		FROM user_files uf
		WHERE uf.id = $1
	`

	var file models.UserFile
	err := r.DB.QueryRow(query, fileID).Scan(
		&file.ID, &file.UserID, &file.FileContentID, &file.Filename,
		&file.FolderID, &file.IsPublic, &file.DownloadCount,
		pq.Array(&file.Tags), &file.CreatedAt, &file.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &file, nil
}

// Helper function to load user file for audit logs (handles deleted files)
func (r *queryResolver) loadUserFileForAuditLog(fileID string) (*models.UserFile, error) {
	query := `
		SELECT uf.id, uf.user_id, uf.file_content_id, uf.filename, uf.folder_id,
			   uf.is_public, uf.download_count, uf.tags, uf.created_at, uf.updated_at,
			   u.id, u.username, u.email, u.role, u.storage_quota, u.created_at, u.updated_at,
			   fc.id, fc.sha256_hash, fc.file_path, fc.size, fc.mime_type, fc.reference_count, fc.created_at
		FROM user_files uf
		JOIN users u ON uf.user_id = u.id
		LEFT JOIN file_contents fc ON uf.file_content_id = fc.id
		WHERE uf.id = $1
	`

	var file models.UserFile
	var user models.User
	var fileContent models.FileContent
	var fileContentID *uuid.UUID

	err := r.DB.QueryRow(query, fileID).Scan(
		&file.ID, &file.UserID, &fileContentID, &file.Filename,
		&file.FolderID, &file.IsPublic, &file.DownloadCount,
		pq.Array(&file.Tags), &file.CreatedAt, &file.UpdatedAt,
		&user.ID, &user.Username, &user.Email, &user.Role,
		&user.StorageQuota, &user.CreatedAt, &user.UpdatedAt,
		&fileContent.ID, &fileContent.SHA256Hash, &fileContent.FilePath,
		&fileContent.Size, &fileContent.MimeType, &fileContent.ReferenceCount,
		&fileContent.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	file.User = &user

	// Only set file content if it exists (not deleted)
	if fileContentID != nil && fileContent.ID != uuid.Nil {
		file.FileContent = &fileContent
	} else {
		// Create a placeholder file content for deleted files
		file.FileContent = &models.FileContent{
			ID:             uuid.Nil,
			SHA256Hash:     "deleted",
			FilePath:       "deleted",
			Size:           0,
			MimeType:       "application/octet-stream",
			ReferenceCount: 0,
			CreatedAt:      time.Now(),
		}
	}

	return &file, nil
}

// Helper function to create audit log entries
func (r *queryResolver) createAuditLog(ctx context.Context, userID string, action models.AuditAction, fileID *string, ipAddress, userAgent string) error {
	auditLogID := uuid.New()

	query := `
		INSERT INTO audit_logs (id, user_id, action, file_id, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`

	var fileUUID *uuid.UUID
	if fileID != nil {
		parsedFileID, err := uuid.Parse(*fileID)
		if err == nil {
			fileUUID = &parsedFileID
		}
	}

	fmt.Printf("createAuditLog: Inserting audit log - ID: %s, UserID: %s, Action: %s, FileID: %v, IP: %s, UserAgent: %s\n",
		auditLogID, userID, action, fileUUID, ipAddress, userAgent)

	_, err := r.DB.Exec(query, auditLogID, userID, action, fileUUID, ipAddress, userAgent)
	if err != nil {
		fmt.Printf("createAuditLog: Database error: %v\n", err)
	}
	return err
}

// Helper function to get client IP and User Agent from context
func (r *queryResolver) getClientInfo(ctx context.Context) (string, string) {
	// Default values
	ipAddress := "127.0.0.1"
	userAgent := "FileVault-Client"

	// Try to extract from HTTP headers if available
	if req := graphql.GetOperationContext(ctx); req != nil {
		if headers := req.Headers; headers != nil {
			// Extract User-Agent header
			if ua := headers.Get("User-Agent"); ua != "" {
				userAgent = ua
				fmt.Printf("getClientInfo: Extracted User-Agent: %s\n", userAgent)
			} else {
				fmt.Printf("getClientInfo: No User-Agent header found\n")
			}

			// Extract IP address from various headers
			if xff := headers.Get("X-Forwarded-For"); xff != "" {
				// X-Forwarded-For can contain multiple IPs, take the first one
				if ips := strings.Split(xff, ","); len(ips) > 0 {
					ipAddress = strings.TrimSpace(ips[0])
					fmt.Printf("getClientInfo: Extracted IP from X-Forwarded-For: %s\n", ipAddress)
				}
			} else if xri := headers.Get("X-Real-IP"); xri != "" {
				ipAddress = xri
				fmt.Printf("getClientInfo: Extracted IP from X-Real-IP: %s\n", ipAddress)
			} else if xri := headers.Get("X-Forwarded"); xri != "" {
				ipAddress = xri
				fmt.Printf("getClientInfo: Extracted IP from X-Forwarded: %s\n", ipAddress)
			} else {
				fmt.Printf("getClientInfo: No IP headers found, using default: %s\n", ipAddress)
			}
		} else {
			fmt.Printf("getClientInfo: No headers available in context\n")
		}
	} else {
		fmt.Printf("getClientInfo: No operation context available\n")
	}

	return ipAddress, userAgent
}

// AllFiles is the resolver for the allFiles field.
func (r *queryResolver) AllFiles(ctx context.Context, limit *int, offset *int) ([]*models.UserFile, error) {
	// Require admin authentication
	_, err := auth.RequireAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin authentication required: %w", err)
	}

	// Set default values
	limitValue := 50
	if limit != nil {
		limitValue = *limit
	}
	offsetValue := 0
	if offset != nil {
		offsetValue = *offset
	}

	query := `
		SELECT uf.id, uf.user_id, uf.file_content_id, uf.filename, uf.folder_id,
			   uf.is_public, uf.download_count, uf.tags, uf.created_at, uf.updated_at
		FROM user_files uf
		ORDER BY uf.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.DB.Query(query, limitValue, offsetValue)
	if err != nil {
		return nil, fmt.Errorf("failed to query all files: %w", err)
	}
	defer rows.Close()

	var files []*models.UserFile
	for rows.Next() {
		var file models.UserFile
		err := rows.Scan(
			&file.ID, &file.UserID, &file.FileContentID, &file.Filename,
			&file.FolderID, &file.IsPublic, &file.DownloadCount,
			pq.Array(&file.Tags), &file.CreatedAt, &file.UpdatedAt,
		)
		if err != nil {
			fmt.Printf("Row scan error: %v\n", err)
			return nil, fmt.Errorf("failed to scan file: %w", err)
		}

		graphqlFile, err := r.loadUserFileWithRelations(file.ID.String())
		if err != nil {
			return nil, err
		}
		files = append(files, graphqlFile)
	}

	return files, nil
}

// TotalUsed is the resolver for the totalUsed field.
func (r *storageStatsResolver) TotalUsed(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.TotalUsed), nil
}

// OriginalSize is the resolver for the originalSize field.
func (r *storageStatsResolver) OriginalSize(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.OriginalSize), nil
}

// SavedBytes is the resolver for the savedBytes field.
func (r *storageStatsResolver) SavedBytes(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.SavedBytes), nil
}

// FileUploaded is the resolver for the fileUploaded field.
func (r *subscriptionResolver) FileUploaded(ctx context.Context, userID uuid.UUID) (<-chan *models.UserFile, error) {
	panic("not implemented fileUploaded")
}

// DownloadCountUpdated is the resolver for the downloadCountUpdated field.
func (r *subscriptionResolver) DownloadCountUpdated(ctx context.Context, fileID uuid.UUID) (<-chan *models.UserFile, error) {
	panic("not implemented downloadCountUpdated")
}

// StorageQuota is the resolver for the storageQuota field.
func (r *userResolver) StorageQuota(ctx context.Context, obj *models.User) (int, error) {
	return int(obj.StorageQuota), nil
	// panic("not implemented storageQuota")
}

// Files is the resolver for the files field.
func (r *userResolver) Files(ctx context.Context, obj *models.User) ([]*models.UserFile, error) {
	panic("not implemented files")
}

// Folders is the resolver for the folders field.
func (r *userResolver) Folders(ctx context.Context, obj *models.User) ([]*models.Folder, error) {
	panic("not implemented folders")
}

// ShareURL is the resolver for the shareURL field.
func (r *userFileResolver) ShareURL(ctx context.Context, obj *models.UserFile) (*string, error) {
	return &obj.ShareURL, nil
}

// FileContent returns generated.FileContentResolver implementation.
func (r *Resolver) FileContent() generated.FileContentResolver { return &fileContentResolver{r} }

// Mutation returns generated.MutationResolver implementation.
func (r *Resolver) Mutation() generated.MutationResolver { return &mutationResolver{r} }

// Query returns generated.QueryResolver implementation.
func (r *Resolver) Query() generated.QueryResolver { return &queryResolver{r} }

// StorageStats returns generated.StorageStatsResolver implementation.
func (r *Resolver) StorageStats() generated.StorageStatsResolver { return &storageStatsResolver{r} }

// Subscription returns generated.SubscriptionResolver implementation.
func (r *Resolver) Subscription() generated.SubscriptionResolver { return &subscriptionResolver{r} }

// User returns generated.UserResolver implementation.
func (r *Resolver) User() generated.UserResolver { return &userResolver{r} }

// UserFile returns generated.UserFileResolver implementation.
func (r *Resolver) UserFile() generated.UserFileResolver { return &userFileResolver{r} }

type fileContentResolver struct{ *Resolver }
type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type storageStatsResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
type userResolver struct{ *Resolver }
type userFileResolver struct{ *Resolver }
