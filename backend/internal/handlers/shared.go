package handlers

import (
	"database/sql"
	"encoding/json"
	"file-vault/internal/auth"
	"file-vault/internal/services"
	"fmt"
	"net/http"
)

// UnshareFile handles unsharing a file
func UnshareFile(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	// Get user ID from context (set by auth middleware)
	userID, err := auth.RequireAuth(r.Context())
	if err != nil {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Get file ID from URL path
	fileID := r.URL.Path[len("/api/shares/unshare/"):]

	// Validate file ID
	if fileID == "" {
		http.Error(w, "File ID is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Check if the file exists and belongs to the user
	var fileExists bool
	err = tx.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM user_files uf 
			WHERE uf.id = $1 AND uf.user_id = $2
		)
	`, fileID, userID).Scan(&fileExists)

	if err != nil {
		http.Error(w, "Database query failed", http.StatusInternalServerError)
		return
	}

	if !fileExists {
		http.Error(w, "File not found or you don't have permission to unshare it", http.StatusNotFound)
		return
	}

	// Delete all shares for this file
	_, err = tx.Exec(`
		DELETE FROM file_shares 
		WHERE file_id = $1
	`, fileID)

	if err != nil {
		http.Error(w, "Failed to unshare file", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Return success response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "File unshared successfully",
	})
}

// DownloadSharedFile handles downloading a shared file
func DownloadSharedFile(w http.ResponseWriter, r *http.Request, db *sql.DB, fs *services.FileService) {
	// Get user ID from context (set by auth middleware)
	userID, err1 := auth.RequireAuth(r.Context())
	if err1 != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Authentication required",
		})
		return
	}

	// Get file ID from URL path
	fileID := r.URL.Path[len("/api/shares/download/"):]

	// Validate file ID
	if fileID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "File ID is required",
		})
		return
	}

	// Check if the file is shared with this user or is public
	var filePath, filename, mimeType string
	var fileSize int64
	var isOwner bool

	query := `
		SELECT 
			fc.file_path, uf.filename, fc.mime_type, fc.size,
			CASE WHEN uf.user_id = $2 THEN true ELSE false END as is_owner
		FROM user_files uf
		JOIN file_contents fc ON uf.file_content_id = fc.id
		WHERE uf.id = $1 
		AND (
			uf.user_id = $2 OR  -- User owns the file
			uf.is_public = true OR  -- File is publicly shared
			EXISTS (
				SELECT 1 FROM file_shares fs 
				WHERE fs.file_id = uf.id 
				AND fs.share_type = 'USER_SPECIFIC' 
				AND fs.shared_with_user_id = $2
			)  -- File is specifically shared with user
		)
		LIMIT 1
	`

	err := db.QueryRow(query, fileID, userID).Scan(&filePath, &filename, &mimeType, &fileSize, &isOwner)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if err == sql.ErrNoRows {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "File not found or you don't have permission to download it",
			})
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": "Database query failed",
			})
		}
		return
	}

	err = fs.DownloadFile(&w, filePath, filename, mimeType)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": "Failed to download file",
		})
		return
	}

	// Update download count asynchronously (only if not the owner)
	if !isOwner {
		go func() {
			_, err := db.Exec(`
				UPDATE user_files 
				SET download_count = download_count + 1 
				WHERE id = $1
			`, fileID)
			if err != nil {
				fmt.Printf("Failed to update download count: %v\n", err)
			}
		}()
	}
}
