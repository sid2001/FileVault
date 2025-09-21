package main

import (
	"file-vault/internal/auth"
	"file-vault/internal/config"
	"file-vault/internal/database"
	"file-vault/internal/graph"
	"file-vault/internal/graph/generated"
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

	"github.com/gorilla/websocket"
)

func chainHandlers(mux http.Handler, handlers ...func(http.Handler) http.Handler) http.Handler {
	for _, handler := range handlers {
		mux = handler(mux)
	}
	return mux
}

func main() {
	cfg := config.Load()

	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed::Initialize Database: ", err)
	}
	defer db.Close()

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
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			fmt.Println("requrest incoming")
			next.ServeHTTP(w, r)
		})
	}

	graphqlHandler := corsHandler(rate_limiter.Middleware(auth.Middleware(srv, cfg.JWTSecret), rateLimiter))
	mux.Handle("/graphql", graphqlHandler)

	if os.Getenv("GO_ENV") != "production" {
		playgroundHandler := corsHandler(playground.Handler("GraphQL Playground", "/graphql"))
		mux.Handle("/playground", playgroundHandler)
	}

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
