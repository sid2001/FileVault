export const env = {
  NEXT_PUBLIC_GRAPHQL_URL: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8080/graphql',
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const
