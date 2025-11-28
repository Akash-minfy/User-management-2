import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical,
  Mail,
  Shield
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { ROLE_HIERARCHY, Role } from '../types/auth'
import toast from 'react-hot-toast'

interface User {
  _id: string
  email: string
  name?: string
  roles: string[]
  isTOTPEnabled: boolean
  isEmailOTPEnabled?: boolean
  createdAt: string
  updatedAt: string
}

interface InviteForm {
  email: string
  role: Role
  name?: string
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { token, user: currentUser } = useAuthStore()
  const [pendingInvites, setPendingInvites] = useState<any[]>([])
  const [acceptedInvites, setAcceptedInvites] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteForm>()

  // Load users on component mount and handle invite modal via URL
  const [searchParams] = useSearchParams()
  React.useEffect(() => {
    if (!token) return
    loadUsers()
    if (searchParams.get('invite') === '1') {
      setShowInviteModal(true)
    }
    loadInvites()
  }, [token, searchParams])

  const loadInvites = async () => {
    try {
      const [p, a] = await Promise.all([
        fetch('/api/users/invites?status=pending', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/users/invites?status=accepted', { headers: { 'Authorization': `Bearer ${token}` } }),
      ])
      if (p.ok) {
        const d = await p.json(); setPendingInvites(d.invites || [])
      }
      if (a.ok) {
        const d = await a.json(); setAcceptedInvites(d.invites || [])
      }
    } catch {}
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvite = async (data: InviteForm) => {
    try {
      const response = await fetch('/api/invites/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteeEmail: data.email,
          role: data.role,
          name: data.name,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send invitation')
      }

      toast.success('Invitation sent successfully!')
      setShowInviteModal(false)
      reset()
      loadUsers()
      loadInvites()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
    }
  }

  // No direct role assignments from UI per requirements

  const canAssignRole = (_targetRole: Role) => false

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      super_admin: 'bg-red-100 text-red-800',
      site_admin: 'bg-orange-100 text-orange-800',
      operator: 'bg-blue-100 text-blue-800',
      client_admin: 'bg-green-100 text-green-800',
      client_user: 'bg-gray-100 text-gray-800',
    }
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage user accounts and role assignments
          </p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="btn btn-primary btn-md">
          <UserPlus className="h-4 w-4 mr-2" /> Invite User
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <button className="btn btn-outline btn-md">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </button>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Security
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'No name'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(role)}`}
                        >
                          {role.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {(user.isTOTPEnabled || user.isEmailOTPEnabled) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.isTOTPEnabled ? '2FA (Authenticator App)' : '2FA (Email OTP)'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          No 2FA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <span className="text-gray-400 text-xs">Invite to add roles</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invites */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium text-gray-900">Pending Invites</h3></div>
          <div className="card-content">
            {pendingInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No pending invites.</p>
            ) : (
              <ul className="space-y-2">
                {pendingInvites.map((u) => (
                  <li key={u._id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">{u.email}</p>
                      <p className="text-xs text-gray-500">Role: {u.metadata?.invitedRole || (u.roles && u.roles[0])}</p>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(u.metadata?.invitedAt || u.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium text-gray-900">Accepted Invites</h3></div>
          <div className="card-content">
            {acceptedInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No accepted invites.</p>
            ) : (
              <ul className="space-y-2">
                {acceptedInvites.map((u) => (
                  <li key={u._id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{u.email}</span>
                    <span className="text-xs text-gray-500">{new Date(u.metadata?.inviteAcceptedAt || u.updatedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInviteModal(false)} />
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit(handleInvite)}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                      <Mail className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Invite New User
                      </h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Email Address
                          </label>
                          <input
                            {...register('email', {
                              required: 'Email is required',
                              pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'Invalid email address',
                              },
                            })}
                            type="email"
                            className="input mt-1"
                            placeholder="user@example.com"
                          />
                          {errors.email && (
                            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Name (Optional)
                          </label>
                          <input
                            {...register('name')}
                            type="text"
                            className="input mt-1"
                            placeholder="Full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Role
                          </label>
                          <select
                            {...register('role', { required: 'Role is required' })}
                            className="input mt-1"
                          >
                            <option value="">Select a role</option>
                            {ROLE_HIERARCHY.map((role) => (
                              <option key={role} value={role}>
                                {role.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                          {errors.role && (
                            <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="btn btn-primary btn-md sm:ml-3"
                  >
                    Send Invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-outline btn-md mt-3 sm:mt-0"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}