package services

import (
	"database/sql"
	"file-vault/internal/models"
)

type StorageService struct {
	db *sql.DB
}

func NewStorageService(db *sql.DB) *StorageService {
	return &StorageService{db: db}
}

func (ss *StorageService) GetGlobalStats() (*models.StorageStats, error) {
	query := `
		WITH storage_data AS (
			SELECT 
				COALESCE(SUM(fc.size), 0) as total_deduplicated,
				COALESCE(SUM(fc.size * fc.reference_count), 0) as total_original,
				COUNT(DISTINCT uf.user_id) as user_count,
				COUNT(fc.id) as file_count
			FROM file_contents fc
			LEFT JOIN user_files uf ON fc.id = uf.file_content_id
		)
		SELECT 
			total_deduplicated,
			total_original,
			total_original - total_deduplicated as saved_bytes,
			CASE 
				WHEN total_original > 0 THEN 
					((total_original - total_deduplicated)::float / total_original::float) * 100
				ELSE 0
			END as saved_percentage,
			user_count,
			file_count
		FROM storage_data
	`

	var stats models.StorageStats
	err := ss.db.QueryRow(query).Scan(
		&stats.TotalUsed,
		&stats.OriginalSize,
		&stats.SavedBytes,
		&stats.SavedPercentage,
		&stats.UserCount,
		&stats.FileCount,
	)

	return &stats, err
}

func (ss *StorageService) GetUserStats(userID string) (*models.StorageStats, error) {
	query := `
		WITH user_storage_data AS (
			SELECT 
				COALESCE(SUM(fc.size / fc.reference_count), 0) as total_deduplicated,
				COALESCE(SUM(fc.size), 0) as total_original, -- For single user, this is the same
				1 as user_count,
				COUNT(fc.id) as file_count
			FROM user_files uf
			JOIN file_contents fc ON uf.file_content_id = fc.id
			WHERE uf.user_id = $1
		)
		SELECT 
			total_deduplicated,
			total_original,
			0 as saved_bytes, -- Individual users don't see dedup savings
			0 as saved_percentage,
			user_count,
			file_count
		FROM user_storage_data
	`

	var stats models.StorageStats
	err := ss.db.QueryRow(query, userID).Scan(
		&stats.TotalUsed,
		&stats.OriginalSize,
		&stats.SavedBytes,
		&stats.SavedPercentage,
		&stats.UserCount,
		&stats.FileCount,
	)

	return &stats, err
}
