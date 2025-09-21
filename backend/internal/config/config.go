package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                string
	Host                string
	DatabaseURL         string
	JWTSecret           string
	StoragePath         string
	DefaultStorageQuota int64
	RedisURL            string
	GlobalRateLimit     int
	GlobalBurstLimit    int
	UserRateLimit       int
	UserBurstLimit      int
	UserBlockLimit      int
	UserBlockDuration   int
}

func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	ret := &Config{
		Port:                getEnv("PORT", "8080"),
		Host:                getEnv("HOST", "localhost"),
		DatabaseURL:         buildDatabaseURL(),
		JWTSecret:           getEnv("JWT_SECRET", "your-super-secret-jwt-key"),
		StoragePath:         getEnv("STORAGE_PATH", "./storage/"),
		GlobalRateLimit:     getEnvAsInt("API_RATE_LIMIT", 1000),
		GlobalBurstLimit:    getEnvAsInt("API_BURST_LIMIT", 2000),
		UserRateLimit:       getEnvAsInt("USER_RATE_LIMIT", 10),
		UserBurstLimit:      getEnvAsInt("USER_BURST_LIMIT", 20),
		UserBlockLimit:      getEnvAsInt("USER_BLOCK_LIMIT", 100),
		UserBlockDuration:   getEnvAsInt("USER_BLOCK_DURATION", 3600),
		DefaultStorageQuota: getEnvAsInt64GB("DEFAULT_STORAGE_QUOTA", 1),
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379"),
	}
	fmt.Printf("userblocklimi: %v\n", ret.UserBlockLimit)
	return ret
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
			fmt.Printf("env key: %v  value %v \n", key, intValue)
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue * 1024 * 1024
		}
	}
	return defaultValue
}

func getEnvAsInt64GB(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue * 1024 * 1024 * 1024 // Convert GB to bytes
		}
	}
	return defaultValue * 1024 * 1024 * 1024 // Convert default GB to bytes
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
