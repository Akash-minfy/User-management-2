import React from 'react'
import { Users, UserPlus, Shield, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export function DashboardPage() {
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = React.useState([
    { name: 'Total Users', value: '0', icon: Users, color: 'bg-blue-500' },
    { name: 'Active Sessions', value: '1', icon: Activity, color: 'bg-green-500' },
    { name: 'Pending Invites', value: '0', icon: UserPlus, color: 'bg-yellow-500' },
    { name: 'Accepted Invites', value: '0', icon: Shield, color: 'bg-purple-500' },
  ])

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/users/stats', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setStats((prev) => prev
            .map(s => s.name === 'Total Users' ? { ...s, value: String(data.totalUsers || 0) } : s)
            .map(s => s.name === 'Pending Invites' ? { ...s, value: String(data.pendingInvites || 0) } : s)
            .map(s => s.name === 'Accepted Invites' ? { ...s, value: String(data.acceptedInvites || 0) } : s)
          )
        }
      } catch {}
    }
    fetchStats()
  }, [token])

  const recentActivities = [
    {
      id: 1,
      type: 'login',
      description: 'You logged in successfully',
      timestamp: new Date().toISOString(),
      user: user?.email,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Development Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.name || user?.email}. This environment is for internal development and testing only.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="card-content">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-md ${stat.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="card-content">
            <div className="flow-root">
              <ul className="-mb-8">
                {recentActivities.map((activity, activityIdx) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {activityIdx !== recentActivities.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center ring-8 ring-white">
                            <Activity className="h-4 w-4 text-primary-600" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500">{activity.user}</p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              <button className="btn btn-primary btn-md w-full" onClick={() => navigate('/users?invite=1')}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite New User
              </button>
              <button className="btn btn-outline btn-md w-full" onClick={() => navigate('/profile')}>
                <Shield className="h-4 w-4 mr-2" />
                Manage 2FA
              </button>
              <button className="btn btn-outline btn-md w-full" onClick={() => navigate('/users')}>
                <Users className="h-4 w-4 mr-2" />
                Manage Users
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}