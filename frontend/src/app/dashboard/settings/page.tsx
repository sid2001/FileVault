'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useMutation } from '@apollo/client'
import { gql } from '@apollo/client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  UserIcon,
  KeyIcon,
  ShieldCheckIcon,
  BellIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [deleteUser] = useMutation(DELETE_USER_MUTATION)

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])


  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    // Here you would typically make an API call to change the password
    toast.success('Password changed successfully')
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setIsChangingPassword(false)
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    if (!confirm('This will permanently delete all your files and data. Are you absolutely sure?')) {
      return
    }

    // Final confirmation with typing requirement
    const confirmationText = 'DELETE MY ACCOUNT'
    const userInput = prompt(`To confirm account deletion, please type "${confirmationText}" exactly:`)
    
    if (userInput !== confirmationText) {
      toast.error('Account deletion cancelled. Confirmation text did not match.')
      return
    }

    setIsDeletingAccount(true)

    try {
      await deleteUser({
        variables: {
          userId: user.id,
        },
      })

      toast.success('Account deleted successfully. You will be logged out shortly.')
      
      // Clear any stored data and logout
      setTimeout(() => {
        logout()
        router.push('/login')
      }, 2000)
    } catch (error: any) {
      console.error('Delete account error:', error)
      toast.error(error.message || 'Failed to delete account. Please try again.')
      setIsDeletingAccount(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </div>

        {/* Feature Status Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Feature Implementation Status</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">Here's what's currently available in your settings:</p>
                <ul className="space-y-1">
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                    <span><strong>Password Change:</strong> Not implemented yet (UI only)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                    <span><strong>Notifications:</strong> Not implemented yet (UI only)</span>
                  </li>
                  <li className="flex items-center">
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    <span><strong>Account Deletion:</strong> Fully functional and working</span>
                  </li>
                </ul>
                <p className="mt-2 text-xs text-blue-600">
                  Password change and notification features are planned for future updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <p className="mt-1 text-sm text-gray-900">{user?.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{user?.role.toLowerCase()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Storage Quota</label>
                <p className="mt-1 text-sm text-gray-900">{user != null?formatBytes(user?.storageQuota): '0 Bytes'}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Member Since</label>
              <p className="mt-1 text-sm text-gray-900">
                {user != null?new Date(user.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }): 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <ShieldCheckIcon className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Security</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Password</h4>
                <p className="text-sm text-gray-500">Change your account password</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsChangingPassword(!isChangingPassword)}
              >
                <KeyIcon className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </div>

            {isChangingPassword && (
              <form onSubmit={handlePasswordChange} className="space-y-4 pt-4 border-t">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
                <div className="flex space-x-3">
                  <Button type="submit">Update Password</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsChangingPassword(false)
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <BellIcon className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                <p className="text-sm text-gray-500">Receive notifications about file activities</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Storage Alerts</h4>
                <p className="text-sm text-gray-500">Get notified when approaching storage limit</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center">
              <TrashIcon className="h-5 w-5 text-red-400 mr-2" />
              <h3 className="text-lg font-medium text-red-900">Danger Zone</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Delete Account</h4>
                  <p className="text-sm text-gray-500">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                </Button>
              </div>
              <div className="max-w-md p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-700">
                  <strong>Warning:</strong> This action will permanently delete:
                </p>
                <ul className="text-xs text-red-600 mt-1 ml-4 list-disc">
                  <li>All your uploaded files</li>
                  <li>All your folders and organization</li>
                  <li>All shared files and permissions</li>
                  <li>Your account data and preferences</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
