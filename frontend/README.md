# File Vault Frontend

A modern, responsive frontend for the File Vault application built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Authentication**: Login and registration with JWT tokens
- 📁 **File Management**: Upload, download, organize, and manage files
- 📂 **Folder Organization**: Create and manage folders to organize files
- 🔗 **File Sharing**: Share files publicly with shareable links
- 📊 **Dashboard**: Overview of storage usage and recent activity
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- ⚡ **Real-time**: GraphQL subscriptions for real-time updates
- 🔍 **Search**: Search through files and folders
- 📱 **Mobile Responsive**: Works seamlessly on all devices

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Apollo Client with GraphQL
- **UI Components**: Custom components with Headless UI
- **Icons**: Heroicons
- **File Upload**: React Dropzone
- **Notifications**: React Hot Toast
- **Forms**: React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend server running on `http://localhost:8080`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Update the GraphQL endpoint in `.env.local`:
```
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8080/graphql
```

4. Generate GraphQL types:
```bash
npm run codegen
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   ├── register/
│   └── layout.tsx        # Root layout
├── components/           # Reusable components
│   ├── ui/              # Base UI components
│   ├── layout/          # Layout components
│   └── providers.tsx    # Context providers
├── contexts/            # React contexts
├── hooks/              # Custom hooks
├── lib/                # Utility functions
├── types/              # TypeScript type definitions
└── generated/          # Generated GraphQL types
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run codegen` - Generate GraphQL types

## Features Overview

### Authentication
- Secure login and registration
- JWT token management
- Protected routes
- Automatic token refresh

### File Management
- Drag and drop file upload
- Multiple file selection
- File preview and metadata
- Download files
- Delete files
- File tagging system

### Folder Organization
- Create nested folders
- Move files between folders
- Folder-based file organization
- Folder sharing

### File Sharing
- Public file sharing
- Shareable links
- Download tracking
- Share management

### Dashboard
- Storage usage overview
- Recent files
- Quick actions
- Statistics and analytics

## Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8080/graphql
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Other Platforms

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm run start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
