import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import toast from 'react-hot-toast'

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8080/graphql',
})

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
      
      // Show user-friendly error messages
      if (message.includes('Unauthorized') || message.includes('Forbidden')) {
        toast.error('You are not authorized to perform this action')
        // Redirect to login if unauthorized
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token')
          window.location.href = '/login'
        }
      } else {
        toast.error(message)
      }
    })
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`)
    toast.error('Network error. Please check your connection.')
  }
})

export function createApolloClient() {
  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            files: {
              keyArgs: ['filters'],
              merge(existing = [], incoming) {
                return [...existing, ...incoming]
              },
            },
            folders: {
              keyArgs: ['parentID'],
              merge(existing = [], incoming) {
                return [...existing, ...incoming]
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  })
}
