package rate_limiter

import (
	"file-vault/internal/services"
	"fmt"
	"net/http"
	"time"
)

func Middleware(next http.Handler, limiter *services.RateLimiter) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		remoteAddr := getClientIP(r)
		ctx := r.Context()
		// check for excessive request from user to block the user
		fmt.Printf("Rate limiter entry\n ")
		if blocked, err := limiter.Blocked(remoteAddr); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		} else if blocked {
			http.Error(w, "You have been blocked due to excessive requests. Try again later", http.StatusTooManyRequests)
			return
		}
		fmt.Printf("Not blocked\n")

		// checking if global rate limit is exceeded
		if allowed, ra, err := limiter.Allow(ctx, "global", limiter.Config.GlobalRateLimit, limiter.Config.GlobalBurstLimit, time.Second); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		} else if !allowed {
			http.Error(w, fmt.Sprintf("Too Many Requests. Try again in %v seconds", ra.Seconds()), http.StatusTooManyRequests)
			return
		}
		fmt.Printf("Global request limit allowd\n")
		// checking if user rate limit is exceeded
		if allowed, _, err := limiter.Allow(ctx, "block:counter:"+remoteAddr, limiter.Config.UserBlockLimit, 0, time.Second); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			fmt.Printf("Block counter err: %v %v %v\n", err, limiter.Config.UserBlockLimit, limiter.Config.UserBlockLimit)
			return
		} else if !allowed {
			limiter.Block(remoteAddr)
			http.Error(w, "You have been blocked due to excessive requests. Try again later", http.StatusTooManyRequests)
			return
		}
		fmt.Println("Block counter okn\n")
		// normal limit check
		if allowed, ra, err := limiter.Allow(ctx, remoteAddr, limiter.Config.UserRateLimit, limiter.Config.UserBurstLimit, time.Second); err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		} else if !allowed {
			http.Error(w, fmt.Sprintf("Too Many Requests. Try again in %v seconds", ra.Seconds()), http.StatusTooManyRequests)
			return
		}
		fmt.Printf("Requet ready to go forward\n")
		next.ServeHTTP(w, r)
	})
}
