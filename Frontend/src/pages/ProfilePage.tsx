import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { 
  User, 
  Mail, 
  Shield, 
  Settings, 
  Key,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface ProfileForm {
  name: string
  email: string
}

export function ProfilePage() {
  const { user, token, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [show2faOptions, setShow2faOptions] = useState(false)
  

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
  })

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        email: user.email || '',
      })
    }
  }, [user, reset])

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        // Do not allow email updates from UI
        body: JSON.stringify({ name: data.name }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update profile')
      }

      const result = await response.json()
      setUser(result.user)
      toast.success('Profile updated successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTOTPSetup = async () => {
    try {
      // Start TOTP setup immediately for the current user and navigate to the setup flow
      const response = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to start TOTP setup')
      }

      // proceed to the TOTP setup UI where the user can scan QR and verify immediately
      navigate('/totp-setup')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start 2FA setup')
    }
  }

  const handleEmailSetup = async () => {
    try {
      const response = await fetch('/api/auth/email/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to start email OTP setup')
      }

      navigate('/email-setup')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start 2FA setup')
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account settings and security preferences
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
            </div>
            <div className="card-content">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('name', {
                        required: 'Name is required',
                        minLength: {
                          value: 2,
                          message: 'Name must be at least 2 characters',
                        },
                      })}
                      type="text"
                      className="input pl-10"
                      placeholder="Enter your full name"
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...register('email')}
                      type="email"
                      className="input pl-10 bg-gray-100 cursor-not-allowed"
                      readOnly
                      disabled
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary btn-md"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Update Profile'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="space-y-6">
          {/* Account Status */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Account Status</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Account Status</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Two-Factor Auth</span>
                  {user?.isTOTPEnabled || user?.isEmailOTPEnabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      <Shield className="h-3 w-3 mr-1" />
                      {user?.isTOTPEnabled ? 'Enabled (Authenticator App)' : 'Enabled (Email OTP)'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disabled
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Member Since</span>
                  <span className="text-sm text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Roles</h3>
            </div>
            <div className="card-content">
              <div className="space-y-2">
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
          </div>

          {/* Security Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Security</h3>
            </div>
            <div className="card-content">
              <div className="space-y-3">
                {!user?.isTOTPEnabled && !user?.isEmailOTPEnabled ? (
                  <>
                    <button onClick={() => setShow2faOptions(true)} className="btn btn-primary btn-md w-full">
                      <Shield className="h-4 w-4 mr-2" /> Enable 2FA
                    </button>
                    {show2faOptions && (
                      <div className="mt-2 p-3 bg-white border rounded">
                        <p className="text-sm text-gray-600 mb-2">Choose your preferred two-factor method:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setShow2faOptions(false); handleTOTPSetup(); }} className="btn btn-outline">Authenticator App</button>
                          <button onClick={() => { setShow2faOptions(false); handleEmailSetup(); }} className="btn btn-primary">Email OTP</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                      <button
                        onClick={() => navigate(user?.isTOTPEnabled ? '/totp-setup' : '/email-setup')}
                        className="btn btn-outline btn-md w-full"
                      >
                        <Settings className="h-4 w-4 mr-2" /> Reconfigure 2FA
                      </button>
                    <button
                      onClick={async () => {
                        try {
                          const endpoint = user?.isTOTPEnabled ? '/api/auth/totp/disable' : '/api/auth/email/disable'
                          const resp = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                          })
                          if (!resp.ok) throw new Error('Failed to disable 2FA')
                          const meResp = await fetch('/api/users/me', {
                            headers: { 'Authorization': `Bearer ${token}` },
                          })
                          if (meResp.ok) {
                            const me = await meResp.json()
                            setUser(me.user)
                          }
                        } catch (e) {
                          alert('Failed to disable 2FA')
                        }
                      }}
                      className="btn btn-secondary btn-md w-full"
                    >
                      Disable 2FA
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}