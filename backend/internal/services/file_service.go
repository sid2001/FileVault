package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
)

type FileService struct {
	dedupService *DeduplicationService
	storagePath  string
}

type UploadFile struct {
	Name     string
	Hash     string
	Size     int64
	MimeType string
	Content  []byte
}

func NewFileService(dedupService *DeduplicationService, storagePath string) *FileService {
	return &FileService{
		dedupService: dedupService,
		storagePath:  storagePath,
	}
}

func (fs *FileService) DeleteFile(filePath string) error {
	// check refere
	fmt.Printf("Deleting file path: %s\n", filePath)
	err := os.Remove(filePath)
	if err != nil {
		return err
	}
	return nil
}

func (fs *FileService) UploadFiles(files []*UploadFile) ([]string, error) {
	// change this process to handle reverting failed uploads
	var filePaths []string
	for _, file := range files {
		// write file to location	on disk
		path, err := fs.dedupService.CheckDuplicateFile(file.Hash)
		if err != nil {
			return nil, err
		}
		if path != "" {
			filePaths = append(filePaths, path)
			continue
		} else {
			// write file to storage
			fmt.Printf("Saving file\n")
			extension := getFileExtensionFromMimeType(file.MimeType)
			path := fs.storagePath + file.Hash + "." + extension
			f, err := os.Create(path)
			if err != nil {
				fmt.Printf("Failed::Creating File: %v\n", err)
				return nil, fmt.Errorf("Failed::Saving File")
			}
			fmt.Printf("Saving File: %s\n", path)
			n, err := f.Write(file.Content)
			if err != nil {
				return nil, err
			}
			if n != len(file.Content) {
				return nil, fmt.Errorf("Failed::Saving File")
			}
			fmt.Printf("Saved File: %s\n", path)
			f.Close()
			filePaths = append(filePaths, path)
		}
	}
	return filePaths, nil
}

func (fs *FileService) DownloadFile(w *http.ResponseWriter, filePath string, fileName string, mimeType string) error {
	// check if file exists - filePath already includes the full path from database
	fmt.Printf("Downloading file: %s\n", filePath)
	if stat, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("file not found")
	} else if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	} else {
		(*w).Header().Set("Content-Type", mimeType)
		(*w).Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
		(*w).Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))

		// could add cache header for public files
		// not sure if its right cause public files can be changed to private
		file, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()
		_, err = io.Copy(*w, file)
		if err != nil {
			return fmt.Errorf("failed to copy file: %w", err)
		}

		return nil
	}

}

// PreviewFile serves a file for inline preview (not download)
func (fs *FileService) PreviewFile(w *http.ResponseWriter, filePath string, fileName string, mimeType string) error {
	// check if file exists - filePath already includes the full path from database
	fmt.Printf("Previewing file: %s\n", filePath)
	if stat, err := os.Stat(filePath); os.IsNotExist(err) {
		return fmt.Errorf("file not found at %s", filePath)
	} else if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	} else {
		(*w).Header().Set("Content-Type", mimeType)
		(*w).Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
		(*w).Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		(*w).Header().Set("Cache-Control", "public, max-age=3600") // Cache for 1 hour

		file, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()
		_, err = io.Copy(*w, file)
		if err != nil {
			return fmt.Errorf("failed to copy file: %w", err)
		}

		return nil
	}
}
