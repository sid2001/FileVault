package handlers

import (
	"database/sql"
	"file-vault/internal/services"
	"fmt"
	"net/http"

	"github.com/google/uuid"
)

func FilePreviewHandler(w http.ResponseWriter, r *http.Request, db *sql.DB, fileService *services.FileService) {
	fmt.Println("file preview handler request")
	downloadID := r.PathValue("downloadID")
	userID := r.PathValue("userID")

	var fileContentID uuid.UUID
	var fileName string
	var userFileID uuid.UUID
	var ownerID uuid.UUID
	query := `SELECT user_file_id, file_name, file_content_id, owner_id FROM file_downloads WHERE id = $1 AND user_id = $2`
	err := db.QueryRow(query, downloadID, userID).Scan(&userFileID, &fileName, &fileContentID, &ownerID)
	if err != nil {
		fmt.Printf("PreviewHandler: Failed to get download record: %v\n", err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	var mimeType string
	var filePath string
	query = `SELECT mime_type, file_path FROM file_contents WHERE id = $1`
	err = db.QueryRow(query, fileContentID).Scan(&mimeType, &filePath)
	if err != nil {
		fmt.Printf("PreviewHandler: Failed to get file content: %v\n", err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	fmt.Printf("PreviewHandler: File path from DB: %s, File name: %s, MIME type: %s\n", filePath, fileName, mimeType)

	if err := fileService.PreviewFile(&w, filePath, fileName, mimeType); err != nil {
		fmt.Printf("PreviewHandler: Failed to preview file: %v\n", err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
}
