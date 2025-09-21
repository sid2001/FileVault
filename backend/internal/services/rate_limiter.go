package services

import (
	"context"
	"time"

	redis_rate "github.com/go-redis/redis_rate/v10"
	"github.com/redis/go-redis/v9"
)

type RlConfig struct {
	GlobalRateLimit int
	GlobalBurstLimit int
	UserRateLimit int
	UserBurstLimit int
	UserBlockLimit int
	UserBlockDuration int
}

type RateLimiter struct{
	limiter 		*redis_rate.Limiter
	redisStore 	*RedisClient
	Config			RlConfig
}

func NewRateLimiter(redisClient *RedisClient, config RlConfig) *RateLimiter{
	return &RateLimiter{
		limiter: redis_rate.NewLimiter(redisClient.client), 
		redisStore: redisClient,
		Config : config,
	}
}


func (rl *RateLimiter) Allow(ctx context.Context, key string, rate int, burst int, per time.Duration) (bool,time.Duration, error) {
	if burst == 0 {
		burst = rate
	}
	res, err := rl.limiter.Allow(ctx, key, redis_rate.Limit {
		Period: per,
		Rate: rate,
		Burst: burst,
	})
	if err != nil {
		return false, 0, err
	}
	return res.Allowed > 0, res.RetryAfter, nil
}

func (rl *RateLimiter) Blocked(key string) (bool, error) {
	bkey := "block:" + key
	ctx := context.Background()
	err := rl.redisStore.client.Get(ctx, bkey).Err()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, err
	} else {
		return true, nil
	}
}

func (rl *RateLimiter) Block(key string) error {
	bkey := "block:" + key
	ctx := context.Background()
	return rl.redisStore.client.Set(ctx, bkey, 1, time.Duration(rl.Config.UserBlockDuration) * time.Second ).Err()
}