package graph

import (
	"context"
	"database/sql"
	backend "file-vault"
	"file-vault/internal/auth"
	"file-vault/internal/models"
	"fmt"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Helper function to create audit log entries
func (r *mutationResolver) createAuditLog(ctx context.Context, userID string, action models.AuditAction, fileID *string, ipAddress, userAgent string) error {
	auditLogID := uuid.New()

	query := `
		INSERT INTO audit_logs (id, user_id, action, file_id, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`

	var fileUUID *uuid.UUID
	if fileID != nil {
		parsedFileID, err := uuid.Parse(*fileID)
		if err == nil {
			fileUUID = &parsedFileID
		}
	}

	fmt.Printf("createAuditLog: Inserting audit log - ID: %s, UserID: %s, Action: %s, FileID: %v, IP: %s, UserAgent: %s\n",
		auditLogID, userID, action, fileUUID, ipAddress, userAgent)

	_, err := r.DB.Exec(query, auditLogID, userID, action, fileUUID, ipAddress, userAgent)
	if err != nil {
		fmt.Printf("createAuditLog: Database error: %v\n", err)
	}
	return err
}

// Helper function to get client IP and User Agent from context
func (r *mutationResolver) getClientInfo(ctx context.Context) (string, string) {
	// Default values
	ipAddress := "127.0.0.1"
	userAgent := "FileVault-Client"

	// Try to extract from HTTP headers if available
	if req := graphql.GetOperationContext(ctx); req != nil {
		if headers := req.Headers; headers != nil {
			// Extract User-Agent header
			if ua := headers.Get("User-Agent"); ua != "" {
				userAgent = ua
				fmt.Printf("getClientInfo: Extracted User-Agent: %s\n", userAgent)
			} else {
				fmt.Printf("getClientInfo: No User-Agent header found\n")
			}

			// Extract IP address from various headers
			if xff := headers.Get("X-Forwarded-For"); xff != "" {
				// X-Forwarded-For can contain multiple IPs, take the first one
				if ips := strings.Split(xff, ","); len(ips) > 0 {
					ipAddress = strings.TrimSpace(ips[0])
					fmt.Printf("getClientInfo: Extracted IP from X-Forwarded-For: %s\n", ipAddress)
				}
			} else if xri := headers.Get("X-Real-IP"); xri != "" {
				ipAddress = xri
				fmt.Printf("getClientInfo: Extracted IP from X-Real-IP: %s\n", ipAddress)
			} else if xri := headers.Get("X-Forwarded"); xri != "" {
				ipAddress = xri
				fmt.Printf("getClientInfo: Extracted IP from X-Forwarded: %s\n", ipAddress)
			} else {
				fmt.Printf("getClientInfo: No IP headers found, using default: %s\n", ipAddress)
			}
		} else {
			fmt.Printf("getClientInfo: No headers available in context\n")
		}
	} else {
		fmt.Printf("getClientInfo: No operation context available\n")
	}

	return ipAddress, userAgent
}

// Register is the resolver for the register field.
func (r *mutationResolver) Register(ctx context.Context, input backend.RegisterInput) (*backend.AuthPayload, error) {
	var count int
	err := r.DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = $1 or username = $2", input.Email, input.Username).Scan(&count)
	if err != nil {
		return nil, fmt.Errorf("Failed::Database Error: %w", err)
	}
	if count > 0 {
		return nil, fmt.Errorf("Failed::User already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("Failed::Password hashing error: %w", err)
	}

	user := &models.User{
		ID:           uuid.New(),
		Username:     input.Username,
		Email:        input.Email,
		PasswordHash: string(hashedPassword),
		Role:         models.UserRoleUser,
		StorageQuota: r.Config.DefaultStorageQuota,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	query := `
		INSERT INTO users (id, username, email, password_hash, role, storage_quota, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = r.DB.Exec(query, user.ID, user.Username, user.Email, user.PasswordHash, user.Role,
		user.StorageQuota, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("Failed::Database Error: %w", err)
	}

	token, err := auth.GenerateToken(user.ID.String(), string(user.Role), r.Config.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("Failed::Token cannot be generated: %w", err)
	}

	fmt.Printf(" Register: Generated token for user %v: %v\n", user.ID.String(), token)

	// Log audit event for user registration
	ipAddress, userAgent := r.getClientInfo(ctx)
	fmt.Printf("Register: Creating audit log for user registration %s\n", user.ID.String())
	err = r.createAuditLog(ctx, user.ID.String(), models.AuditActionRegister, nil, ipAddress, userAgent)
	if err != nil {
		fmt.Printf("Warning: Failed to create audit log for registration: %v\n", err)
	} else {
		fmt.Printf("Register: Successfully created audit log for user registration %s\n", user.ID.String())
	}

	return &backend.AuthPayload{
		Token: token,
		User:  userToGraphQL(user),
	}, nil
}

// Login is the resolver for the login field.
func (r *mutationResolver) Login(ctx context.Context, input *backend.LoginInput) (*backend.AuthPayload, error) {
	var user models.User
	fmt.Printf(" Login: %v ", input.Email)
	query := `SELECT id, username, email, password_hash, role, storage_quota, created_at, updated_at FROM users WHERE email = $1`
	err := r.DB.QueryRow(query, input.Email).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.Role,
		&user.StorageQuota, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("Failed::Invalid email or password: %w", err)
	}
	if err != nil {
		return nil, fmt.Errorf("Failed::Database Error: %w", err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
	if err != nil {
		return nil, fmt.Errorf("Failed::Invalid email or password: %w", err)
	}

	token, err := auth.GenerateToken(user.ID.String(), string(user.Role), r.Config.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("Failed::Token cannot be generated: %w", err)
	}

	fmt.Printf(" Login: Generated token for user %v: %v\n", user.ID.String(), token)

	return &backend.AuthPayload{
		Token: token,
		User:  userToGraphQL(&user),
	}, nil
}
