# Docker Setup for File Vault

This document explains how to run the File Vault application using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Quick Start

### Development Environment

1. **Clone and navigate to the project:**
   ```bash
   cd BalkanProject
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend GraphQL: http://localhost:8080/graphql
   - GraphQL Playground: http://localhost:8080/playground
   - PostgreSQL: localhost:5433
   - Redis: localhost:6380

### Production Environment

1. **Set up environment variables:**
   ```bash
   cp env.production .env
   # Edit .env with your production values
   ```

2. **Start with production configuration:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

## Services

### Backend (Go + GraphQL)
- **Port:** 8080
- **Health Check:** Available at `/graphql`
- **Features:** GraphQL API, file storage, rate limiting, authentication

### Frontend (Next.js)
- **Port:** 3000
- **Features:** React UI, Apollo Client, Tailwind CSS

### PostgreSQL Database
- **Port:** 5433 (external), 5432 (internal)
- **Database:** file_vault
- **User:** postgres
- **Password:** up32dp0799 (change in production)

### Redis Cache
- **Port:** 6380 (external), 6379 (internal)
- **Features:** Rate limiting, session storage

## Environment Variables

### Backend Configuration
- `DB_HOST`: Database host (default: postgres)
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: file_vault)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password (default: up32dp0799)
- `REDIS_URL`: Redis connection URL
- `JWT_SECRET`: JWT signing secret
- `STORAGE_PATH`: File storage path
- `DEFAULT_STORAGE_QUOTA`: Storage quota in GB (default: 10)
- `USER_BLOCK_LIMIT`: User block limit (default: 100)
- `USER_BLOCK_DURATION`: User block duration in seconds (default: 3600)
- `GO_ENV`: Environment (development/production)

### Frontend Configuration
- `NEXT_PUBLIC_GRAPHQL_URL`: GraphQL endpoint URL
- `NODE_ENV`: Node environment

## Docker Commands

### Development
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production
```bash
# Start production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View production logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Stop production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

### Individual Services
```bash
# Start only database services
docker-compose up postgres redis

# Start only backend
docker-compose up backend

# Start only frontend
docker-compose up frontend
```

## Data Persistence

The following data is persisted using Docker volumes:
- `postgres_data`: PostgreSQL database files
- `redis_data`: Redis data files
- `backend_storage`: File storage directory

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Check if ports are in use
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :8080
   ```

2. **Permission issues:**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **Database connection issues:**
   ```bash
   # Check database logs
   docker-compose logs postgres
   ```

4. **Build failures:**
   ```bash
   # Clean build cache
   docker-compose build --no-cache
   ```

### Reset Everything
```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up --build
```

## Security Notes

⚠️ **Important for Production:**

1. Change default passwords in `env.production`
2. Use strong JWT secrets
3. Enable SSL/TLS for database connections
4. Configure proper CORS origins
5. Use secrets management for sensitive data
6. Regularly update base images

## Monitoring

### Health Checks
All services include health checks:
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- Backend: GraphQL endpoint availability

### Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
docker-compose logs redis
```

## Scaling

For production scaling, consider:
- Using external managed databases (AWS RDS, Google Cloud SQL)
- Using managed Redis (AWS ElastiCache, Google Cloud Memorystore)
- Load balancing with nginx
- Container orchestration with Kubernetes
