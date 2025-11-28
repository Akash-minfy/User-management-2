import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

interface EmailForm { token: string }

export function EmailVerifyPage() {
  const [tempToken, setTempToken] = useState<string | null>(null)
  const { setTokens, setUser, isLoading, setLoading } = useAuthStore()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<EmailForm>()

  useEffect(() => {
    const token = localStorage.getItem('tempToken')
    if (!token) {
      navigate('/login')
      return
    }
    setTempToken(token)
    setLoading(false)
  }, [navigate, setLoading])

  const onSubmit = async (data: EmailForm) => {
    if (!tempToken) return
    try {
      const response = await fetch('/api/auth/login/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token, tempToken }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Email OTP verification failed')
      }
      const result = await response.json()
      if (result.refreshToken) {
        setTokens(result.token, result.refreshToken)
      } else {
        const { setToken } = useAuthStore.getState()
        setToken(result.token)
      }
      setUser(result.user)
      localStorage.removeItem('tempToken')
      toast.success('Email OTP verified successfully!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email OTP verification failed')
    }
  }

  // Resend button for login flow using tempToken
  const [resendDisabled, setResendDisabled] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const handleResend = async () => {
    if (!tempToken) {
      toast.error('Missing login token');
      return;
    }
    try {
      setResendDisabled(true)
      const response = await fetch('/api/auth/login/email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken })
      })
      if (!response.ok) {
        const e = await response.json()
        throw new Error(e.message || 'Failed to resend OTP')
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
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">Two-Factor Authentication</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Enter the 6-digit code sent to your email</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">Authentication Code</label>
            <div className="mt-1">
              <input {...register('token', { required: 'Authentication code is required', pattern: { value: /^\d{6}$/, message: 'Code must be 6 digits' } })} type="text" maxLength={6} className="input text-center text-2xl tracking-widest" placeholder="000000" autoComplete="off" />
            </div>
            {errors.token && <p className="mt-1 text-sm text-red-600">{errors.token.message}</p>}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" className="btn btn-primary btn-lg w-full">Verify Code</button>
              <button type="button" disabled={resendDisabled} onClick={handleResend} className="btn btn-outline btn-md">{resendDisabled ? `Resend (${resendSeconds})` : 'Resend'}</button>
            </div>
            <button type="button" onClick={() => navigate('/login')} className="btn btn-outline btn-md w-full mt-2"><ArrowLeft className="h-4 w-4 mr-2" />Back to Login</button>
          </div>
        </form>
      </div>
    </div>
  )
}
