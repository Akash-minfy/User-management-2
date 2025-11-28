import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

interface Form {
  newPassword: string
  confirmPassword: string
}

export function ChangePasswordPage() {
  const { register, handleSubmit } = useForm<Form>()
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async (data: Form) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setIsLoading(true)
    try {
      const tempToken = localStorage.getItem('tempToken')
      const payload: any = { newPassword: data.newPassword }
      if (tempToken) payload.tempToken = tempToken

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to change password')
      }

      toast.success('Password changed. Please log in with your new password.')
      localStorage.removeItem('tempToken')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-xl font-semibold mb-4">Change temporary password</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">New password</label>
              <input {...register('newPassword', { required: true, minLength: 6 })} type="password" className="input mt-1 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm password</label>
              <input {...register('confirmPassword', { required: true })} type="password" className="input mt-1 w-full" />
            </div>
            <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordPage
