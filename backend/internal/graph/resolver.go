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
	panic("not implemented uploadFiles")
	// userID, err := auth.RequireAuth(ctx)
	// if err != nil {
	// 	return nil, fmt.Errorf("authentication required")
	// }

	// // Convert GraphQL uploads to service uploads
	// var serviceFiles []*services.UploadedFile
	// for _, file := range files {
	// 	serviceFile := &services.UploadedFile{
	// 		Filename: file.Filename,
	// 		Content:  file.File,
	// 		Size:     file.Size,
	// 		MimeType: file.ContentType,
	// 	}
	// 	serviceFiles = append(serviceFiles, serviceFile)
	// }

	// // Upload files
	// uploadedFiles, err := r.FileService.UploadFiles(userID, serviceFiles, folderID)
	// if err != nil {
	// 	return nil, err
	// }

	// // Convert to GraphQL types
	// var result []*models.UserFile
	// for _, file := range uploadedFiles {
	// 	graphqlFile, err := r.loadUserFileWithRelations(file.ID.String())
	// 	if err != nil {
	// 		return nil, err
	// 	}
	// 	result = append(result, graphqlFile)
	// }

	// return result, nil
}

// DeleteFile is the resolver for the deleteFile field.
func (r *mutationResolver) DeleteFile(ctx context.Context, fileID uuid.UUID) (bool, error) {
	panic("not implemented deleteFile")
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
func (r *mutationResolver) ShareFile(ctx context.Context, fileID uuid.UUID, shareType models.ShareType, userID *uuid.UUID) (*models.FileShare, error) {
	// panic("not implemented shareFile")
	currentUserID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, fmt.Errorf("authentication required")
	}

	// Verify file ownership
	var count int
	err = r.DB.QueryRow("SELECT COUNT(*) FROM user_files WHERE id = $1 AND user_id = $2",
		fileID, currentUserID).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if count == 0 {
		return nil, fmt.Errorf("file not found or access denied")
	}

	// Create file share
	share := &models.FileShare{
		ID:        uuid.New(),
		FileID:    fileID,
		ShareType: models.ShareType(shareType),
		CreatedAt: time.Now(),
	}

	if userID != nil {
		sharedWithUserID := *userID
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
		_, err = r.DB.Exec("UPDATE user_files SET is_public = true WHERE id = $1", fileID)
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
	panic("not implemented deleteUser")
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
	panic("not implemented Users")
}

// Files is the resolver for the files field.
func (r *queryResolver) Files(ctx context.Context, filters *backend.FileFiltersInput, limit *int, offset *int) ([]*models.UserFile, error) {
	// panic("not implemented Files")

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
		if filters.Search != nil && *filters.Search != "" {
			argCount++
			conditions = append(conditions, fmt.Sprintf("uf.filename ILIKE $%d", argCount))
			args = append(args, "%"+*filters.Search+"%")
		}

		if filters.MimeType != nil && *filters.MimeType != "" {
			argCount++
			conditions = append(conditions, fmt.Sprintf("fc.mime_type = $%d", argCount))
			args = append(args, *filters.MimeType)
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

	rows, err := r.DB.Query(baseQuery, args...)
	if err != nil {
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
	panic("not implemented DownloadFile")
}

// Folders is the resolver for the folders field.
func (r *queryResolver) Folders(ctx context.Context, parentID *uuid.UUID) ([]*models.Folder, error) {
	panic("not implemented Folders")
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
	panic("not implemented AuditLogs")
}

// AllFiles is the resolver for the allFiles field.
func (r *queryResolver) AllFiles(ctx context.Context, limit *int, offset *int) ([]*models.UserFile, error) {
	panic("not implemented AllFiles")
}

// TotalUsed is the resolver for the totalUsed field.
func (r *storageStatsResolver) TotalUsed(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.TotalUsed), nil
	panic("not implemented totalUsed")
}

// OriginalSize is the resolver for the originalSize field.
func (r *storageStatsResolver) OriginalSize(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.OriginalSize), nil
	panic("not implemented originalSize")
}

// SavedBytes is the resolver for the savedBytes field.
func (r *storageStatsResolver) SavedBytes(ctx context.Context, obj *models.StorageStats) (int, error) {
	return int(obj.SavedBytes), nil
	panic("not implemented savedBytes")
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
	panic("not implemented shareURL")
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
