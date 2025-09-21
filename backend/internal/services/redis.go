package services

import (
	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedisClient(redisURL string) *RedisClient {
	if opt, err := redis.ParseURL(redisURL); err != nil {
		panic("Failed to parse redis URL: " + err.Error())
	} else {
		return &RedisClient{client: redis.NewClient(opt)}
	}
}

func (rc *RedisClient) Close() error {
	return rc.client.Close()
}




