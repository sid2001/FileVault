'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useApolloClient, ApolloError } from '@apollo/client'
import { gql } from '@apollo/client'
import toast from 'react-hot-toast'

// GraphQL queries and mutations
const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      email
      role
      storageQuota
      createdAt
    }
  }
`

const USER_STORAGE_STATS_QUERY = gql`
  query UserStorageStats($userId: ID!) {
    userStorageStats(userId: $userId) {
      totalUsed
      originalSize
      savedBytes
      savedPercentage
      userCount
      fileCount
    }
  }
`

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput) {
    login(input: $input) {
      token
      user {
        id
        username
        email
        role
        storageQuota
      }
    }
  }
`

const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        email
        role
        storageQuota
      }
    }
  }
`

interface User {
  id: string
  username: string
  email: string
  role: string
  storageQuota: number
  createdAt: string
}

interface StorageStats {
  totalUsed: number
  originalSize: number
  savedBytes: number
  savedPercentage: number
  userCount: number
  fileCount: number
}

interface AuthContextType {
  user: User | null
  storageStats: StorageStats | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const client = useApolloClient()

  // Safe localStorage access
  const getToken = () => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('token')
  }

  const { data: meData, loading: meLoading, refetch, error: meError } = useQuery(ME_QUERY, {
    skip: !getToken(),
    fetchPolicy: 'cache-and-network',
  })

  const { data: storageData, loading: storageLoading, refetch: refetchStorage } = useQuery(USER_STORAGE_STATS_QUERY, {
    variables: { userId: user?.id },
    skip: !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (meData?.me) {
      setUser(meData.me)
    }
  }, [meData])

  useEffect(() => {
    if (storageData?.userStorageStats) {
      setStorageStats(storageData.userStorageStats)
    }
  }, [storageData])

  useEffect(() => {
    if (meError) {
      console.error('Auth error:', meError)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
      }
      setUser(null)
    }
  }, [meError])

  const [loginMutation] = useMutation(LOGIN_MUTATION)
  const [registerMutation] = useMutation(REGISTER_MUTATION)

  useEffect(() => {
    if (!meLoading && !storageLoading) {
      setLoading(false)
    }
  }, [meLoading, storageLoading])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data } = await loginMutation({
        variables: {
          input: { email, password }
        }
      })

      if (data?.login?.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.login.token)
        }
        // Set user data directly from login response
        setUser(data.login.user)
        toast.success('Login successful!')
        router.push('/dashboard')
        return true
      }
      return false
    } catch (error: unknown) {
      console.error('Login error:', error)
      if (error instanceof ApolloError) {
        toast.error(error.message)
      } else {
        toast.error('An unexpected error occurred during login.')
      }
      return false
    }
  }

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      const { data } = await registerMutation({
        variables: {
          input: { username, email, password }
        }
      })
      console.log('Registration data:', data)

      if (data?.register?.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', data.register.token)
        }
        // Set user data directly from register response
        setUser(data.register.user)
        toast.success('Registration successful!')
        router.push('/dashboard')
        return true
      }
      return false
    } catch (error: unknown) {
      console.error('Registration error:', error)
      if (error instanceof ApolloError) {
        toast.error(error.message)
      } else {
        toast.error('An unexpected error occurred during registration.')
      }
      return false
    }
  }

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
    }
    setUser(null)
    await client.resetStore() // Clear the Apollo Client cache
    router.push('/login')
    toast.success('Logged out successfully')
  }

  const refreshUser = async () => {
    if (getToken()) {
      try {
        await refetch()
      } catch (error) {
        console.error('Failed to refresh user data:', error)
      }
    }
  }

  const value: AuthContextType = {
    user,
    storageStats,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
