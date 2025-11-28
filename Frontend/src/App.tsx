import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { ProfilePage } from './pages/ProfilePage'
import { TOTPSetupPage } from './pages/TOTPSetupPage'
import { TOTPVerifyPage } from './pages/TOTPVerifyPage'
import { EmailSetupPage } from './pages/EmailSetupPage'
import { EmailVerifyPage } from './pages/EmailVerifyPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'

function App() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/totp-setup" element={<TOTPSetupPage />} />
        <Route path="/totp-verify" element={<TOTPVerifyPage />} />
        <Route path="/email-verify" element={<EmailVerifyPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/totp-setup" element={<TOTPSetupPage />} />
        <Route path="/totp-verify" element={<TOTPVerifyPage />} />
        <Route path="/email-setup" element={<EmailSetupPage />} />
        <Route path="/email-verify" element={<EmailVerifyPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App