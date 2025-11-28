import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export function EmailSetupPage() {
  const [isLoading, setIsLoading] = useState(true)
  const { token, setUser } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>()

  // --- FIX: prevent multiple OTP sends ---
  const sendOtpRef = useRef<() => void>(() => {})

  sendOtpRef.current = async () => {
    try {
      const authHeader = token ? `Bearer ${token}` : ''

      const response = await fetch('/api/auth/email/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Failed to start email OTP setup')
      }

      toast.success('Verification code sent to your email')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setIsLoading(false)
    }
  }

  // Run ONLY once on mount
  useEffect(() => {
    sendOtpRef.current();
  }, [])     // <-- FIXED: No token dependency, runs only ONCE



  // ---------------------------------
  // VERIFY OTP
  // ---------------------------------

  const onVerify = async (data: { code: string }) => {
    try {
      const authHeader = token ? `Bearer ${token}` : ''

      const response = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ token: data.code })
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.message || 'Email OTP verification failed')
        return
      }

      if (result.refreshToken) {
        const { setTokens } = useAuthStore.getState()
        setTokens(result.token, result.refreshToken)
      } else {
        const { setToken } = useAuthStore.getState()
        setToken(result.token)
      }

      setUser(result.user)
      toast.success('Email OTP verified and enabled!')
      setTimeout(() => navigate('/dashboard'), 250)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email OTP verification failed')
    }
  }



  // ---------------------------------
  // RESEND LOGIC
  // ---------------------------------

  const [resendDisabled, setResendDisabled] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  const handleResend = async () => {
    try {
      setResendDisabled(true)

      const response = await fetch('/api/auth/email/resend', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Failed to resend OTP')
      }

      toast.success('OTP resent to your email')

      const cooldown = Number((import.meta as any).env?.VITE_EMAIL_OTP_RESEND_SECONDS || 60)
      setResendSeconds(cooldown)

      const interval = setInterval(() => {
        setResendSeconds((s) => {
          if (s <= 1) {
            clearInterval(interval)
            setResendDisabled(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend OTP')
      setResendDisabled(false)
    }
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
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Enable Email OTP</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We sent a one-time code to your email. Enter it below to enable Email OTP.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onVerify)}>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">Verification Code</label>
            <div className="mt-1">
              <input
                {...register('code', {
                  required: 'Code required',
                  pattern: { value: /^\d{6}$/, message: '6 digits required' }
                })}
                type="text"
                maxLength={6}
                className="input text-center text-2xl tracking-widest"
                placeholder="000000"
                autoComplete="off"
              />
            </div>
            {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>}
          </div>

          <div className="space-y-3">
            <button type="submit" className="btn btn-primary btn-lg w-full">Verify Code</button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={resendDisabled}
                onClick={handleResend}
                className="btn btn-outline btn-md w-full"
              >
                {resendDisabled ? `Resend (${resendSeconds})` : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="btn btn-outline btn-md w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
