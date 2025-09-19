package graph

import (
	"context"
	"database/sql"
	backend "file-vault"
	"file-vault/internal/auth"
	"file-vault/internal/models"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

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
