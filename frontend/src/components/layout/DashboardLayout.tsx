'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  HomeIcon,
  FolderIcon,
  DocumentIcon,
  ShareIcon,
  UserIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const getNavigation = (isAdmin: boolean) => [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Files', href: '/dashboard/files', icon: DocumentIcon },
  { name: 'Folders', href: '/dashboard/folders', icon: FolderIcon },
  { name: 'Shared', href: '/dashboard/shared', icon: ShareIcon },
  ...(isAdmin ? [{ name: 'Admin', href: '/dashboard/admin', icon: ShieldCheckIcon }] : []),
  { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, storageStats, logout, isAdmin } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  
  const navigation = getNavigation(isAdmin)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Calculate storage usage percentage
  const getStorageUsage = () => {
    if (!user || !storageStats) return { used: 0, total: 0, percentage: 0 }
    
    // storageStats.totalUsed = actual storage used by user
    // user.storageQuota = total storage allocated to user
    const used = storageStats.totalUsed
    const total = user.storageQuota
    const percentage = total > 0 ? (used / total) * 100 : 0
    
    return {
      used,
      total,
      percentage: Math.min(percentage, 100)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const storageUsage = getStorageUsage()

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-semibold text-gray-900">File Vault</span>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                      isActive
                        ? 'bg-primary-100 text-primary-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className={`mr-4 h-6 w-6 ${isActive ? 'text-primary-500' : ''}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-gray-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">{user?.username}</p>
                <p className="text-sm font-medium text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="ml-2 text-xl font-semibold text-gray-900">File Vault</span>
              </div>
              <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-primary-500' : ''}`} />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full min-w-0">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user?.username}</p>
                  <p className="text-xs font-medium text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-gradient-to-r from-white via-gray-50 to-primary-50 shadow-lg border-b border-gray-200 overflow-hidden">
          {/* Background texture pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>
          
          {/* Subtle animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-100/20 to-transparent animate-pulse"></div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-200/10 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary-300/10 to-transparent rounded-full translate-y-12 -translate-x-12"></div>
          
          <button
            type="button"
            className="relative px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            {/* Left side - Brand/Title area */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                {/* Logo/Icon */}
                <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                  <svg className="relative w-6 h-6 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">FileVault</h1>
                  <p className="text-xs text-gray-600 font-medium">Secure File Management</p>
                </div>
              </div>
            </div>
            
            {/* Right side - User menu */}
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Storage quota indicator */}
              <div className="hidden lg:flex items-center space-x-3 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-700">Storage</span>
                </div>
                {storageStats ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatBytes(storageUsage.used)}
                      </span>
                      <span className="text-sm text-gray-500">/</span>
                      <span className="text-sm text-gray-600">
                        {formatBytes(storageUsage.total)}
                      </span>
                    </div>
                    <div className="w-20 bg-gray-200 rounded-full h-2 shadow-inner">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          storageUsage.percentage > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' : 
                          storageUsage.percentage > 75 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' : 
                          'bg-gradient-to-r from-primary-500 to-primary-600'
                        }`}
                        style={{ width: `${storageUsage.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 min-w-[3rem]">
                      {storageUsage.percentage.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gray-300 rounded animate-pulse"></div>
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
