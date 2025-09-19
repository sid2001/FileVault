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

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (username: string, email: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const client = useApolloClient()

  const { data: meData, loading: meLoading, refetch, error: meError } = useQuery(ME_QUERY, {
    skip: typeof window === 'undefined' || !localStorage.getItem('token'),
  })

  useEffect(() => {
    if (meData?.me) {
      setUser(meData.me)
    }
  }, [meData])

  useEffect(() => {
    if (meError) {
      console.error('Auth error:', meError)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
      }
      setUser(null)
    }
  }, [meError])

  const [loginMutation] = useMutation(LOGIN_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
  })
  const [registerMutation] = useMutation(REGISTER_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
  })

  useEffect(() => {
    if (!meLoading) {
      setLoading(false)
    }
  }, [meLoading])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data } = await loginMutation({
        variables: {
          input: { email, password }
        }
      })

      if (data?.login?.token) {
        localStorage.setItem('token', data.login.token)
        // No need to setUser manually, the refetched ME_QUERY will do it.
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

      if (data?.register?.token) {
        localStorage.setItem('token', data.register.token)
        // No need to setUser manually, the refetched ME_QUERY will do it.
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
    localStorage.removeItem('token')
    setUser(null)
    await client.resetStore() // Clear the Apollo Client cache
    router.push('/login')
    toast.success('Logged out successfully')
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
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
