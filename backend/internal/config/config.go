package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port								string
	DatabaseURL 				string
	JWTSecret						string
	StoragePath					string
	APIRateLimit 				int
	UserRateLimit 			int
	DefautlStorageQuota uint64
}

func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	return &Config{
    Port:           		getEnv("PORT", "8080"),
    DatabaseURL:        buildDatabaseURL(),
    JWTSecret:          getEnv("JWT_SECRET", "your-super-secret-jwt-key"),
    StoragePath:        getEnv("STORAGE_PATH", "./storage"),
    APIRateLimit:       getEnvAsInt("API_RATE_LIMIT", 2),
		UserRateLimit:      getEnvAsInt("USER_RATE_LIMIT", 5),
		DefautlStorageQuota: getEnvAsUint64("DEFAULT_STORAGE_QUOTA", 1 * 1024 * 1024),
	}
}

func getEnv(key, defaultValue string) string {
  if value := os.Getenv(key); value != "" {
    return value
  }
  return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
  if value := os.Getenv(key); value != "" {
    if intValue, err := strconv.Atoi(value); err == nil {
    	return intValue
    	}
  }
  return defaultValue
}

func getEnvAsUint64(key string, defaultValue uint64) uint64 {
  if value := os.Getenv(key); value != "" {
   	if uintValue, err := strconv.ParseUint(value, 10, 64); err == nil {
      return uintValue * 1024 * 1024
    }
  }
  return defaultValue
}

func buildDatabaseURL() string {
  host := getEnv("DB_HOST", "localhost")
  port := getEnv("DB_PORT", "5432")
  name := getEnv("DB_NAME", "file_vault")
  user := getEnv("DB_USER", "postgres")
  password := getEnv("DB_PASSWORD", "1234")
  sslmode := getEnv("DB_SSL_MODE", "disable")

  return "postgres://" + user + ":" + password + "@" + host + ":" + port + "/" + name + "?sslmode=" + sslmode
}