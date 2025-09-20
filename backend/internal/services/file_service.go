package services

import (
	"fmt"
	"os"
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
