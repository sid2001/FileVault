package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	UserRoleKey contextKey = "user_role"
)

type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func Middleware(next http.Handler, JWTSecret string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := ExtractUserFromRequest(r, JWTSecret)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ExtractUserFromRequest(r *http.Request, JWTSecret string) context.Context {
	ctx := r.Context()

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		fmt.Printf(" ExtractUserFromRequest: No Authorization header\n")
		return ctx
	}
	fmt.Printf(" ExtractUserFromRequest: %v\n", authHeader)

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader {
		fmt.Printf(" ExtractUserFromRequest: No Bearer prefix found\n")
		return ctx
	}

	fmt.Printf(" ExtractUserFromRequest: Token string: %v\n", tokenString)

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(JWTSecret), nil
	})

	if err != nil {
		fmt.Printf(" ExtractUserFromRequest: Token parse error: %v\n", err)
		return ctx
	}

	if !token.Valid {
		fmt.Printf(" ExtractUserFromRequest: Token is not valid\n")
		return ctx
	}

	if claims, ok := token.Claims.(*Claims); ok {
		fmt.Printf(" ExtractUserFromRequest: UserID: %v, Role: %v\n", claims.UserID, claims.Role)
		ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
	} else {
		fmt.Printf(" ExtractUserFromRequest: Failed to extract claims\n")
	}
	return ctx
}

func GetUserIDFromContext(ctx context.Context) string {
	fmt.Printf(" GetUserIDFromContext: %v ", ctx.Value(UserIDKey))
	if userID, ok := ctx.Value(UserIDKey).(string); ok {
		return userID
	}
	return ""
}

func GetUserRoleFromContext(ctx context.Context) string {
	if role, ok := ctx.Value(UserRoleKey).(string); ok {
		return role
	}
	return ""
}

func RequireAuth(ctx context.Context) (string, error) {
	userID := GetUserIDFromContext(ctx)
	if userID == "" {
		return "", jwt.ErrTokenInvalidSubject
	}
	return userID, nil
}

func RequireAdmin(ctx context.Context) (string, error) {
	userID, err := RequireAuth(ctx)
	if err != nil {
		return "", err
	}

	role := GetUserRoleFromContext(ctx)
	if role != "ADMIN" {
		return "", jwt.ErrTokenInvalidClaims
	}

	return userID, nil
}
