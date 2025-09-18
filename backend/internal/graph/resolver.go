package graph

// THIS CODE WILL BE UPDATED WITH SCHEMA CHANGES. PREVIOUS IMPLEMENTATION FOR SCHEMA CHANGES WILL BE KEPT IN THE COMMENT SECTION. IMPLEMENTATION FOR UNCHANGED SCHEMA WILL BE KEPT.

import (
	"context"
	"database/sql"
	backend "file-vault"
	"file-vault/internal/config"
	"file-vault/internal/graph/generated"
	"file-vault/internal/models"
	"file-vault/internal/services"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
)

type Resolver struct{
	DB *sql.DB
	FileService *services.FileService
	DedupService *services.DeduplicationService
	RateLimiter *services.RateLimiter
	StorageService *services.StorageService
	Config *config.Config
}

// Size is the resolver for the size field.
func (r *fileContentResolver) Size(ctx context.Context, obj *models.FileContent) (int, error) {
	panic("not implemented")
}

// Register is the resolver for the register field.
func (r *mutationResolver) Register(ctx context.Context, input backend.RegisterInput) (*backend.AuthPayload, error) {
	panic("not implemented")
}

// Login is the resolver for the login field.
func (r *mutationResolver) Login(ctx context.Context, input *backend.LoginInput) (*backend.AuthPayload, error) {
	panic("not implemented")
}

// UploadFiles is the resolver for the uploadFiles field.
func (r *mutationResolver) UploadFiles(ctx context.Context, files []*graphql.Upload, folderID *uuid.UUID) ([]*models.UserFile, error) {
	panic("not implemented")
}

// DeleteFile is the resolver for the deleteFile field.
func (r *mutationResolver) DeleteFile(ctx context.Context, fileID uuid.UUID) (bool, error) {
	panic("not implemented")
}

// UpdateFile is the resolver for the updateFile field.
func (r *mutationResolver) UpdateFile(ctx context.Context, fileID uuid.UUID, input *backend.UpdateFileInput) (*models.UserFile, error) {
	panic("not implemented")
}

// CreateFolder is the resolver for the createFolder field.
func (r *mutationResolver) CreateFolder(ctx context.Context, input backend.CreateFolderInput) (*models.Folder, error) {
	panic("not implemented")
}

// DeleteFolder is the resolver for the deleteFolder field.
func (r *mutationResolver) DeleteFolder(ctx context.Context, folderID uuid.UUID) (bool, error) {
	panic("not implemented")
}

// UpdateFolder is the resolver for the updateFolder field.
func (r *mutationResolver) UpdateFolder(ctx context.Context, folderID uuid.UUID, name string) (*models.Folder, error) {
	panic("not implemented")
}

// ShareFile is the resolver for the shareFile field.
func (r *mutationResolver) ShareFile(ctx context.Context, fileID uuid.UUID, shareType models.ShareType, userID *uuid.UUID) (*models.FileShare, error) {
	panic("not implemented")
}

// UnshareFile is the resolver for the unshareFile field.
func (r *mutationResolver) UnshareFile(ctx context.Context, fileID uuid.UUID) (bool, error) {
	panic("not implemented")
}

// UpdateUserQuota is the resolver for the updateUserQuota field.
func (r *mutationResolver) UpdateUserQuota(ctx context.Context, userID uuid.UUID, quota int) (*models.User, error) {
	panic("not implemented")
}

// DeleteUser is the resolver for the deleteUser field.
func (r *mutationResolver) DeleteUser(ctx context.Context, userID uuid.UUID) (bool, error) {
	panic("not implemented")
}

// Me is the resolver for the me field.
func (r *queryResolver) Me(ctx context.Context) (*models.User, error) {
	panic("not implemented")
}

// Users is the resolver for the users field.
func (r *queryResolver) Users(ctx context.Context, limit *int, offset *int) ([]*models.User, error) {
	panic("not implemented")
}

// Files is the resolver for the files field.
func (r *queryResolver) Files(ctx context.Context, filters *backend.FileFiltersInput, limit *int, offset *int) ([]*models.UserFile, error) {
	panic("not implemented")
}

// File is the resolver for the file field.
func (r *queryResolver) File(ctx context.Context, id uuid.UUID) (*models.UserFile, error) {
	panic("not implemented")
}

// PublicFile is the resolver for the publicFile field.
func (r *queryResolver) PublicFile(ctx context.Context, id uuid.UUID) (*models.UserFile, error) {
	panic("not implemented")
}

// DownloadFile is the resolver for the downloadFile field.
func (r *queryResolver) DownloadFile(ctx context.Context, id uuid.UUID) (string, error) {
	panic("not implemented")
}

// Folders is the resolver for the folders field.
func (r *queryResolver) Folders(ctx context.Context, parentID *uuid.UUID) ([]*models.Folder, error) {
	panic("not implemented")
}

// Folder is the resolver for the folder field.
func (r *queryResolver) Folder(ctx context.Context, id uuid.UUID) (*models.Folder, error) {
	panic("not implemented")
}

// StorageStats is the resolver for the storageStats field.
func (r *queryResolver) StorageStats(ctx context.Context) (*models.StorageStats, error) {
	panic("not implemented")
}

// UserStorageStats is the resolver for the userStorageStats field.
func (r *queryResolver) UserStorageStats(ctx context.Context, userID *uuid.UUID) (*models.StorageStats, error) {
	panic("not implemented")
}

// AuditLogs is the resolver for the auditLogs field.
func (r *queryResolver) AuditLogs(ctx context.Context, limit *int, offset *int) ([]*models.AuditLog, error) {
	panic("not implemented")
}

// AllFiles is the resolver for the allFiles field.
func (r *queryResolver) AllFiles(ctx context.Context, limit *int, offset *int) ([]*models.UserFile, error) {
	panic("not implemented")
}

// TotalUsed is the resolver for the totalUsed field.
func (r *storageStatsResolver) TotalUsed(ctx context.Context, obj *models.StorageStats) (int, error) {
	panic("not implemented")
}

// OriginalSize is the resolver for the originalSize field.
func (r *storageStatsResolver) OriginalSize(ctx context.Context, obj *models.StorageStats) (int, error) {
	panic("not implemented")
}

// SavedBytes is the resolver for the savedBytes field.
func (r *storageStatsResolver) SavedBytes(ctx context.Context, obj *models.StorageStats) (int, error) {
	panic("not implemented")
}

// FileUploaded is the resolver for the fileUploaded field.
func (r *subscriptionResolver) FileUploaded(ctx context.Context, userID uuid.UUID) (<-chan *models.UserFile, error) {
	panic("not implemented")
}

// DownloadCountUpdated is the resolver for the downloadCountUpdated field.
func (r *subscriptionResolver) DownloadCountUpdated(ctx context.Context, fileID uuid.UUID) (<-chan *models.UserFile, error) {
	panic("not implemented")
}

// StorageQuota is the resolver for the storageQuota field.
func (r *userResolver) StorageQuota(ctx context.Context, obj *models.User) (int, error) {
	panic("not implemented")
}

// Files is the resolver for the files field.
func (r *userResolver) Files(ctx context.Context, obj *models.User) ([]*models.UserFile, error) {
	panic("not implemented")
}

// Folders is the resolver for the folders field.
func (r *userResolver) Folders(ctx context.Context, obj *models.User) ([]*models.Folder, error) {
	panic("not implemented")
}

// ShareURL is the resolver for the shareURL field.
func (r *userFileResolver) ShareURL(ctx context.Context, obj *models.UserFile) (*string, error) {
	panic("not implemented")
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
