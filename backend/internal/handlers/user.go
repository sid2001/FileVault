package handlers

import (
	"database/sql"
	"encoding/json"
	"file-vault/internal/auth"
	"file-vault/internal/models"
	"net/http"
	"strconv"
	"time"
)

func SearchUsers(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	userID, err := auth.RequireAuth(r.Context())
	if err != nil {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}
	username := r.URL.Query().Get("username")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Set default values
	limit := 20
	offset := 0

	// Parse limit and offset
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil {
			offset = parsedOffset
		}
	}

	// Query the database
	query := `
		SELECT id, username, email
		FROM users 
		WHERE username ILIKE $1 
		ORDER BY username 
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, "%"+username+"%", limit, offset)
	if err != nil {
		http.Error(w, "Database query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Create slice to store users
	users := []models.User{}

	// Iterate through rows and scan into users slice
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
		)
		if err != nil {
			http.Error(w, "Failed to scan user data", http.StatusInternalServerError)
			return
		}
		if user.ID.String() != userID {
			users = append(users, user)
		}
	}

	// Check for errors during iteration
	if err = rows.Err(); err != nil {
		http.Error(w, "Error iterating rows", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Return JSON response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users":  users,
		"count":  len(users),
		"limit":  limit,
		"offset": offset,
	})
}

func GetMySharedFiles(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Set default values
	limit := 50
	offset := 0

	// Parse limit and offset
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil {
			offset = parsedOffset
		}
	}

	// Get user ID from context (set by auth middleware)
	userID, err := auth.RequireAuth(r.Context())
	if err != nil {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Query the database for files shared by this user
	query := `
		SELECT 
			fs.id, fs.share_type, fs.share_period, fs.created_at,
			uf.id, uf.filename, uf.is_public, uf.download_count, uf.created_at, uf.updated_at,
			fc.id, fc.size, fc.mime_type,
			u.id, u.username, u.email,
			shared_user.id, shared_user.username, shared_user.email
		FROM file_shares fs
		JOIN user_files uf ON fs.file_id = uf.id
		JOIN file_contents fc ON uf.file_content_id = fc.id
		JOIN users u ON uf.user_id = u.id
		LEFT JOIN users shared_user ON fs.shared_with_user_id = shared_user.id
		WHERE uf.user_id = $1
		ORDER BY fs.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, userID, limit, offset)
	if err != nil {
		http.Error(w, "Database query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Create slice to store shares
	shares := []map[string]interface{}{}

	// Iterate through rows and scan into shares slice
	for rows.Next() {
		var shareID, fileID, fileContentID, userID, username, email string
		var shareType, sharePeriod string
		var createdAt, fileCreatedAt, fileUpdatedAt time.Time
		var filename, mimeType string
		var isPublic bool
		var downloadCount, fileSize int64
		var sharedUserID, sharedUsername, sharedEmail sql.NullString

		err := rows.Scan(
			&shareID, &shareType, &sharePeriod, &createdAt,
			&fileID, &filename, &isPublic, &downloadCount, &fileCreatedAt, &fileUpdatedAt,
			&fileContentID, &fileSize, &mimeType,
			&userID, &username, &email,
			&sharedUserID, &sharedUsername, &sharedEmail,
		)
		if err != nil {
			http.Error(w, "Failed to scan share data", http.StatusInternalServerError)
			return
		}

		share := map[string]interface{}{
			"id":          shareID,
			"shareType":   shareType,
			"sharePeriod": sharePeriod,
			"createdAt":   createdAt.Format(time.RFC3339),
			"file": map[string]interface{}{
				"id":            fileID,
				"filename":      filename,
				"isPublic":      isPublic,
				"downloadCount": downloadCount,
				"createdAt":     fileCreatedAt.Format(time.RFC3339),
				"updatedAt":     fileUpdatedAt.Format(time.RFC3339),
				"fileContent": map[string]interface{}{
					"id":       fileContentID,
					"size":     fileSize,
					"mimeType": mimeType,
				},
				"user": map[string]interface{}{
					"id":       userID,
					"username": username,
					"email":    email,
				},
			},
		}

		// Add shared user info if available
		if sharedUserID.Valid {
			share["sharedWithUser"] = map[string]interface{}{
				"id":       sharedUserID.String,
				"username": sharedUsername.String,
				"email":    sharedEmail.String,
			}
		}

		shares = append(shares, share)
	}

	// Check for errors during iteration
	if err = rows.Err(); err != nil {
		http.Error(w, "Error iterating rows", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Return JSON response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"shares": shares,
		"count":  len(shares),
		"limit":  limit,
		"offset": offset,
	})
}

func GetFilesSharedWithMe(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Set default values
	limit := 50
	offset := 0

	// Parse limit and offset
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil {
			offset = parsedOffset
		}
	}

	// Get user ID from context (set by auth middleware)
	userID, err := auth.RequireAuth(r.Context())
	if err != nil {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	// Query the database for files shared with this user
	query := `
		SELECT 
			fs.id, fs.share_type, fs.share_period, fs.created_at,
			uf.id, uf.filename, uf.is_public, uf.download_count, uf.created_at, uf.updated_at,
			fc.id, fc.size, fc.mime_type,
			u.id, u.username, u.email,
			shared_user.id, shared_user.username, shared_user.email
		FROM file_shares fs
		JOIN user_files uf ON fs.file_id = uf.id
		JOIN file_contents fc ON uf.file_content_id = fc.id
		JOIN users u ON uf.user_id = u.id
		LEFT JOIN users shared_user ON fs.shared_with_user_id = shared_user.id
		WHERE (fs.shared_with_user_id = $1 OR (fs.share_type = 'PUBLIC' AND uf.user_id != $1))
		ORDER BY fs.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, userID, limit, offset)
	if err != nil {
		http.Error(w, "Database query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Create slice to store shares
	shares := []map[string]interface{}{}

	// Iterate through rows and scan into shares slice
	for rows.Next() {
		var shareID, fileID, fileContentID, userID, username, email string
		var shareType, sharePeriod string
		var createdAt, fileCreatedAt, fileUpdatedAt time.Time
		var filename, mimeType string
		var isPublic bool
		var downloadCount, fileSize int64
		var sharedUserID, sharedUsername, sharedEmail sql.NullString

		err := rows.Scan(
			&shareID, &shareType, &sharePeriod, &createdAt,
			&fileID, &filename, &isPublic, &downloadCount, &fileCreatedAt, &fileUpdatedAt,
			&fileContentID, &fileSize, &mimeType,
			&userID, &username, &email,
			&sharedUserID, &sharedUsername, &sharedEmail,
		)
		if err != nil {
			http.Error(w, "Failed to scan share data", http.StatusInternalServerError)
			return
		}

		share := map[string]interface{}{
			"id":          shareID,
			"shareType":   shareType,
			"sharePeriod": sharePeriod,
			"createdAt":   createdAt.Format(time.RFC3339),
			"file": map[string]interface{}{
				"id":            fileID,
				"filename":      filename,
				"isPublic":      isPublic,
				"downloadCount": downloadCount,
				"createdAt":     fileCreatedAt.Format(time.RFC3339),
				"updatedAt":     fileUpdatedAt.Format(time.RFC3339),
				"fileContent": map[string]interface{}{
					"id":       fileContentID,
					"size":     fileSize,
					"mimeType": mimeType,
				},
				"user": map[string]interface{}{
					"id":       userID,
					"username": username,
					"email":    email,
				},
			},
		}

		// Add shared user info if available
		if sharedUserID.Valid {
			share["sharedWithUser"] = map[string]interface{}{
				"id":       sharedUserID.String,
				"username": sharedUsername.String,
				"email":    sharedEmail.String,
			}
		}

		shares = append(shares, share)
	}

	// Check for errors during iteration
	if err = rows.Err(); err != nil {
		http.Error(w, "Error iterating rows", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Return JSON response
	json.NewEncoder(w).Encode(map[string]interface{}{
		"shares": shares,
		"count":  len(shares),
		"limit":  limit,
		"offset": offset,
	})
}
