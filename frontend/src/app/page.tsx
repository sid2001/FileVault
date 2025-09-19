import { redirect } from 'next/navigation'
// import { getServerSession } from 'next-auth'

export default async function HomePage() {
  // This will be handled by middleware or auth check
  redirect('/dashboard')
}
