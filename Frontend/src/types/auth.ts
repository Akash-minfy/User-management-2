export interface User {
  _id: string
  email: string
  name?: string
  roles: string[]
  isTOTPEnabled: boolean
  isEmailOTPEnabled?: boolean
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

export interface LoginResponse {
  token?: string
  refreshToken?: string
  tempToken?: string
  user: User
  message?: string
  twofaMethod?: 'EMAIL' | 'TOTP'
}

export interface SignupResponse {
  user: User
}

export interface TOTPSetupResponse {
  secret: string
  otpauth_url: string
  qr: string
}

export interface InviteRequest {
  email: string
  role: string
  tempPassword?: string
  name?: string
}

export interface RoleAssignment {
  userId: string
  role: string
}

export const ROLE_HIERARCHY = [
  'super_admin',
  'site_admin', 
  'operator',
  'client_admin',
  'client_user'
] as const

export type Role = typeof ROLE_HIERARCHY[number]