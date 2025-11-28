import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft, Download } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

interface TOTPSetupResponse {
  secret: string
  otpauth_url: string
  qr: string
}

export function TOTPSetupPage() {
  const [setupData, setSetupData] = useState<TOTPSetupResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { token, setToken, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>()

  useEffect(() => {
    const setupTOTP = async () => {
      try {
        const temp = localStorage.getItem('tempToken')
        const authHeader = token ? `Bearer ${token}` : (temp ? `Bearer ${temp}` : '')
        if (!authHeader) {
          navigate('/login')
          return
        }

        const response = await fetch('/api/auth/totp/setup', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'TOTP setup failed')
        }

        const data = await response.json()
        setSetupData(data)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'TOTP setup failed')
        navigate('/profile')
      } finally {
        setIsLoading(false)
      }
    }

    setupTOTP()
  }, [token, navigate])

  const onVerify = async (data: { code: string }) => {
    // Use current auth token if available (setup from profile), otherwise fallback to tempToken (login flow)
    const temp = localStorage.getItem('tempToken')
    const authToken = token || temp
    if (!authToken) {
      navigate('/login')
      return
    }

    try {
      const response = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: data.code }),
      })
      const result = await response.json()
      // log for debugging
      // eslint-disable-next-line no-console
      console.log('TOTP verify response', response.status, result)

      if (!response.ok) {
        toast.error(result.message || 'TOTP verification failed')
        return
      }

      if (!result || !result.token) {
        // Unexpected response shape
        toast.error('Unexpected verification response from server')
        return
      }

      if (result.refreshToken) {
        const { setTokens } = useAuthStore.getState()
        setTokens(result.token, result.refreshToken)
      } else {
        setToken(result.token)
      }
      setUser(result.user)
      localStorage.removeItem('tempToken')
      toast.success('TOTP verified and enabled!')
      // Give the UI a moment to update then navigate
      setTimeout(() => navigate('/dashboard'), 250)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'TOTP verification failed')
    }
  }

  const handleDownloadQR = () => {
    if (!setupData?.qr) return
    
    const link = document.createElement('a')
    link.href = setupData.qr
    link.download = 'totp-qr-code.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
            <Shield className="h-6 w-6 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Setup Two-Factor Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Scan the QR code with your authenticator app
          </p>
        </div>
        
        {setupData && (
          <div className="card">
            <div className="card-content">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <img
                    src={setupData.qr}
                    alt="TOTP QR Code"
                    className="w-48 h-48 border border-gray-200 rounded-lg"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Or enter this secret key manually:
                  </p>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-sm break-all">
                    {setupData.secret}
                  </div>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit(onVerify)}>
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700">Enter 6‑digit code</label>
                    <input
                      {...register('code', { required: 'Code is required', pattern: { value: /^\d{6}$/, message: 'Must be 6 digits' } })}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="input mt-1 text-center tracking-widest"
                      placeholder="000000"
                    />
                    {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-md w-full"
                  >
                    Verify and Continue
                  </button>
                </form>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadQR}
                    className="btn btn-outline btn-md w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </button>
                  <button
                    onClick={() => navigate('/profile')}
                    className="btn btn-primary btn-md w-full"
                  >
                    Continue to Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="text-center">
          <button
            onClick={() => navigate('/profile')}
            className="btn btn-outline btn-md"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </button>
        </div>
      </div>
    </div>
  )
}