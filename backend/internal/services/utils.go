package services

import "strings"

// getFileExtensionFromMimeType converts MIME type to file extension
func getFileExtensionFromMimeType(mimeType string) string {
	// Common MIME type to extension mapping
	mimeToExt := map[string]string{
		"image/jpeg":                   "jpg",
		"image/jpg":                    "jpg",
		"image/png":                    "png",
		"image/gif":                    "gif",
		"image/webp":                   "webp",
		"application/pdf":              "pdf",
		"text/plain":                   "txt",
		"text/html":                    "html",
		"text/css":                     "css",
		"text/javascript":              "js",
		"application/json":             "json",
		"application/xml":              "xml",
		"application/zip":              "zip",
		"application/x-zip-compressed": "zip",
		"application/msword":           "doc",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
		"application/vnd.ms-excel": "xls",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         "xlsx",
		"application/vnd.ms-powerpoint":                                             "ppt",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
		"video/mp4":       "mp4",
		"video/avi":       "avi",
		"video/quicktime": "mov",
		"audio/mpeg":      "mp3",
		"audio/wav":       "wav",
		"audio/ogg":       "ogg",
	}

	// Check if we have a direct mapping
	if ext, exists := mimeToExt[mimeType]; exists {
		return ext
	}

	// Try to extract extension from MIME type (e.g., "image/jpeg" -> "jpeg")
	parts := strings.Split(mimeType, "/")
	if len(parts) == 2 {
		// Remove any parameters (e.g., "image/jpeg; charset=utf-8" -> "jpeg")
		subtype := strings.Split(parts[1], ";")[0]
		return subtype
	}

	// Fallback to "bin" for unknown types
	return "bin"
}