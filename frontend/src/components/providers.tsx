'use client'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient } from '@/lib/apollo'
import { AuthProvider } from '@/contexts/AuthContext'

const apolloClient = createApolloClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ApolloProvider>
  )
}
