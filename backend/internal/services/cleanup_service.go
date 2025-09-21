package services

import (
	"database/sql"
	"fmt"
	"time"
)

type CleanUpService struct {
	db *sql.DB
}

func NewCleanUpService(db *sql.DB) *CleanUpService {
	return &CleanUpService{db: db}
}

func (cs *CleanUpService) CleanupExpiredDownloads() error {

	ticker := time.NewTicker(time.Minute * 30)
	query := `DELETE FROM file_downloads WHERE expires_at < NOW()`
	for range ticker.C {
		_, err := cs.db.Exec(query)
		if err != nil {
			fmt.Printf("Failed::Cleanup Expired Downloads: %v\n", err)
		}
	}
	return nil
}
