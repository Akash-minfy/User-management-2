import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  User, 
  LogOut, 
  Menu, 
  X,
  Shield,
  Bell
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { ROLE_HIERARCHY } from '../types/auth'
import { appConfig } from '../config/app'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/users', icon: Users, roles: ['super_admin', 'site_admin'] },
    { name: 'Profile', href: '/profile', icon: User },
  ]

  const canAccess = (roles?: string[]) => {
    if (!roles) return true
    if (!user?.roles) return false
    return user.roles.some(role => roles.includes(role))
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{appConfig.name}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${appConfig.environment === 'Production' ? 'bg-green-100 text-green-800' : appConfig.environment === 'Staging' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                {appConfig.environment}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              if (!canAccess(item.roles)) return null
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{appConfig.name}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${appConfig.environment === 'Production' ? 'bg-green-100 text-green-800' : appConfig.environment === 'Staging' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                {appConfig.environment}
              </span>
            </div>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              if (!canAccess(item.roles)) return null
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User info */}
              <div className="flex items-center gap-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
                  <div className="flex gap-1">
                    {user?.roles?.map((role) => (
                      <span
                        key={role}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(role)}`}
                      >
                        {role.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-600" />
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                className="flex items-center gap-x-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <footer className="px-8 pb-6 text-xs text-gray-500">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <span>© 2025 Minfy. All rights reserved.</span>
            <span>v{appConfig.version}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}