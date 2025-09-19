package services

import (
	"database/sql"
	"file-vault/internal/models"
)

type DeduplicationService struct {
	db *sql.DB
}

func NewDeduplicationService(db *sql.DB) *DeduplicationService {
	return &DeduplicationService{db: db}
}

func (ds *DeduplicationService) GetDeduplicationStats() (*models.StorageStats, error) {
	query := `
		SELECT 
			COALESCE(SUM(fc.size), 0) as deduplicated_size,
			COALESCE(SUM(fc.size * fc.reference_count), 0) as original_size,
			COUNT(DISTINCT fc.id) as unique_files,
			COUNT(uf.id) as total_file_references
		FROM file_contents fc
		LEFT JOIN user_files uf ON fc.id = uf.file_content_id
	`

	var deduplicatedSize, originalSize int64
	var uniqueFiles, totalReferences int

	err := ds.db.QueryRow(query).Scan(&deduplicatedSize, &originalSize, &uniqueFiles, &totalReferences)
	if err != nil {
		return nil, err
	}

	savedBytes := originalSize - deduplicatedSize
	savedPercentage := float64(0)
	if originalSize > 0 {
		savedPercentage = (float64(savedBytes) / float64(originalSize)) * 100
	}

	return &models.StorageStats{
		TotalUsed:       deduplicatedSize,
		OriginalSize:    originalSize,
		SavedBytes:      savedBytes,
		SavedPercentage: savedPercentage,
		FileCount:       uniqueFiles,
		UserCount:       totalReferences,
	}, nil
}

func (ds *DeduplicationService) GetDuplicateFiles(limit, offset int) ([]*models.FileContent, error) {
	query := `
		SELECT id, sha256_hash, file_path, size, mime_type, reference_count, created_at
		FROM file_contents 
		WHERE reference_count > 1
		ORDER BY reference_count DESC, size DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := ds.db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []*models.FileContent
	for rows.Next() {
		var file models.FileContent
		err := rows.Scan(
			&file.ID, &file.SHA256Hash, &file.FilePath,
			&file.Size, &file.MimeType, &file.ReferenceCount,
			&file.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		files = append(files, &file)
	}

	return files, nil
}