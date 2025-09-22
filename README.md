# File Vault - Secure Cloud Storage Application

[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/2xw7QaEj)

A modern, secure cloud storage application built with Next.js and Go, featuring advanced file management, sharing capabilities, and deduplication.


## Host Link
```
http://51.21.161.85:3000/register
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/BalkanID-University/vit-2026-capstone-internship-hiring-task-sid2001.git
cd vit-2026-capstone-internship-hiring-task-sid2001.git

# Start with Docker Compose
cp ./backend/env.example ./backend/.env
cp ./frontend/env.example ./frontend/.env
docker-compose up --build

# Or run locally
cd backend && cp env.example .env && go run cmd/server/main.go
cd frontend && cp env.example .env && npm run dev
```

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[High-Level Design (HLD)](./docs/HLD.md)** - System architecture and design
- **[Entity Relationship Diagram](./docs/ER_Diagram.md)** - Database schema and relationships
- **[UAT Checklist](./docs/UAT_CHECKLIST.md)** - UAT Testing checklist, not implemented yet.
- **[API ENDPOINTS](./docs/UAT_CHECKLIST.md)** - Detailed endpoint list


## ✨ Features

- **🔐 Secure Authentication** - JWT-based authentication with role-based access
- **📁 File Management** - Upload, download, organize, and search files
- **📂 Folder Organization** - Hierarchical folder structure
- **🔗 File Sharing** - Public, private, and user-specific sharing
- **💾 Storage Optimization** - File deduplication and compression
- **👥 User Management** - Admin dashboard and user controls
- **📊 Analytics** - Storage usage and file statistics
- **🔍 Advanced Search** - Filter and search files by various criteria
- **📱 Responsive Design** - Modern UI with Tailwind CSS

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Apollo Client** - GraphQL client
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Go** - High-performance backend language
- **GraphQL** - Type-safe API layer
- **PostgreSQL** - Primary database
- **Redis** - Caching and rate limiting

### Infrastructure
- **Docker** - Containerization
- **Nginx** - Reverse proxy
- **AWS EC2** - Production deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (Go + GraphQL)│◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ - React UI      │    │ - GraphQL API   │    │ - User Data     │
│ - Apollo Client │    │ - HTTP Routes   │    │ - File Metadata │
│ - Tailwind CSS  │    │ - File Service  │    │ - File Contents │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Go 1.21+
- PostgreSQL 13+
- Redis 6+
- Docker (optional)

### Installation

1. **Clone and setup**
```bash
git clone https://github.com/BalkanID-University/vit-2026-capstone-internship-hiring-task-sid2001.git
cd file-vault
```

2. **Backend setup**
```bash
cd backend
go mod download
cp env.example .env
# Edit .env with your database credentials
go run cmd/server/main.go
```

3. **Frontend setup**
```bash
cd frontend
npm install
cp env.example .env.local
# Edit .env.local with your API URL
npm run dev
```

### Docker Setup
```bash
# Start all services
# from from project folder root
docker-compose up --build

```

**Built with ❤️ using Next.js, Go, and modern web technologies.**