package main

import (
	"file-vault/internal/auth"
	"file-vault/internal/config"
	"file-vault/internal/database"
	"file-vault/internal/graph"
	"file-vault/internal/graph/generated"
	"file-vault/internal/handlers"
	"file-vault/internal/rate_limiter"
	"file-vault/internal/services"
	"fmt"
	"os"
	"os/signal"

	"log"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/google/uuid"

	"github.com/gorilla/websocket"
)

func main() {
	cfg := config.Load()

	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed::Initialize Database: ", err)
	}
	defer db.Close()
	cleanupService := services.NewCleanUpService(db) // to clean up expired downloads
	go cleanupService.CleanupExpiredDownloads()

	if err := database.RunMigrations(db); err != nil {
		log.Fatal("Failed::Run Migrations", err)
	}

	redis := services.NewRedisClient(cfg.RedisURL)
	defer redis.Close()
	rlConfig := services.RlConfig{
		GlobalRateLimit:   cfg.GlobalRateLimit,
		GlobalBurstLimit:  cfg.GlobalBurstLimit,
		UserRateLimit:     cfg.UserRateLimit,
		UserBurstLimit:    cfg.UserBurstLimit,
		UserBlockLimit:    cfg.UserBlockLimit,
		UserBlockDuration: cfg.UserBlockDuration,
	}
	dedupService := services.NewDeduplicationService(db)
	fileService := services.NewFileService(dedupService, cfg.StoragePath)
	rateLimiter := services.NewRateLimiter(redis, rlConfig)
	storageService := services.NewStorageService(db)

	resolver := &graph.Resolver{
		DB:             db,
		FileService:    fileService,
		DedupService:   dedupService,
		RateLimiter:    rateLimiter,
		StorageService: storageService,
		Config:         cfg,
	}

	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: resolver,
	}))

	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // change this to allow only selected origins
			},
		},
	})
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.MultipartForm{
		MaxMemory:     10 * 1024 * 1024, // 10 MB
		MaxUploadSize: 50 * 1024 * 1024, // 50 MB
	})

	//srv.SetQueryCache(lru.New(1000))
	//srv.Use(extension.Introspection{})
	//srv.Use(extension.AutomaticPersistedQuery{
	//	Cache: lru.New(100),
	//})

	mux := http.NewServeMux()

	corsHandler := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	}

	graphqlHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(srv, cfg.JWTSecret), rateLimiter))
	mux.Handle("/graphql", graphqlHandler)

	if os.Getenv("GO_ENV") != "production" {
		playgroundHandler := corsHandler(playground.Handler("GraphQL Playground", "/graphql"))
		mux.Handle("/playground", playgroundHandler)
	}

	fileDownloadHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Println("file download handler request")
		downloadID := r.PathValue("downloadID")
		userID := r.PathValue("userID")

		var fileContentID uuid.UUID
		var fileName string
		var userFileID uuid.UUID
		var ownerID uuid.UUID
		query := `SELECT user_file_id, file_name, file_content_id, owner_id FROM file_downloads WHERE id = $1 AND user_id = $2`
		err := db.QueryRow(query, downloadID, userID).Scan(&userFileID, &fileName, &fileContentID, &ownerID)
		if err != nil {
			fmt.Printf("DownloadHandler: Failed to get download record: %v\n", err)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}

		var mimeType string
		var filePath string
		query = `SELECT mime_type, file_path FROM file_contents WHERE id = $1`
		err = db.QueryRow(query, fileContentID).Scan(&mimeType, &filePath)
		if err != nil {
			fmt.Printf("DownloadHandler: Failed to get file content: %v\n", err)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}

		fmt.Printf("DownloadHandler: File path from DB: %s, File name: %s, MIME type: %s\n", filePath, fileName, mimeType)

		if err := fileService.DownloadFile(&w, filePath, fileName, mimeType); err != nil {
			fmt.Printf("DownloadHandler: Failed to download file: %v\n", err)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		} else if ownerID.String() != userID {
			// download count is incremented when someone else downloads your file
			query = `UPDATE user_files SET download_count = download_count + 1 WHERE id = $1`
			_, err = db.Exec(query, userFileID)
			if err != nil {
				fmt.Printf("Failed to update download count")
				return
			}
		}
	})

	fileHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(fileDownloadHandler, cfg.JWTSecret), rateLimiter))

	filePreviewHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.FilePreviewHandler(w, r, db, fileService)
	})

	previewHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(filePreviewHandler, cfg.JWTSecret), rateLimiter))

	mux.Handle("/api/files/{downloadID}/download/{userID}", fileHandler)
	mux.Handle("/api/files/{downloadID}/preview/{userID}", previewHandler)

	// Test endpoint to verify server is working
	mux.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status": "ok", "message": "Server is running"}`)
	})

	searchHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.SearchUsers(w, r, db)
	})
	userSearchHanlder := corsHandler(rate_limiter.Middleware(auth.Middleware(searchHandler, cfg.JWTSecret), rateLimiter))
	mux.Handle("/api/users/search", userSearchHanlder)

	// Shared files routes
	mySharedHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.GetMySharedFiles(w, r, db)
	}), cfg.JWTSecret), rateLimiter))
	mux.Handle("/api/shares/my-shared", mySharedHandler)

	sharedWithMeHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.GetFilesSharedWithMe(w, r, db)
	}), cfg.JWTSecret), rateLimiter))
	mux.Handle("/api/shares/shared-with-me", sharedWithMeHandler)

	// Unshare file route
	unshareHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.UnshareFile(w, r, db)
	}), cfg.JWTSecret), rateLimiter))
	mux.Handle("/api/shares/unshare/", unshareHandler)

	// Download shared file route
	downloadSharedHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.DownloadSharedFile(w, r, db, fileService)
	}), cfg.JWTSecret), rateLimiter))
	mux.Handle("/api/shares/download/", downloadSharedHandler)

	server := &http.Server{
		Addr:           cfg.Host + ":" + cfg.Port,
		Handler:        mux,
		ReadTimeout:    20 * time.Second,
		WriteTimeout:   20 * time.Second,
		IdleTimeout:    60 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Port)
		log.Printf("GraphQL endpoint: http://localhost:%s/graphql", cfg.Port)
		if os.Getenv("GO_ENV") != "production" {
			log.Printf("GraphQL playground: http://localhost:%s/playground", cfg.Port)
		}

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server:", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

}
