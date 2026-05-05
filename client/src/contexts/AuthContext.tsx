import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import api from '../services/api'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  tokenExpiring: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
  dismissExpiryWarning: () => void
  updateProfile: (data: { name?: string; email?: string; currentPassword: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType>(null!)

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tokenExpiring, setTokenExpiring] = useState(false)
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleExpiryCheck(token: string) {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    const exp = decodeExp(token)
    if (!exp) return
    const timeLeft = exp - Date.now()
    const WARN_BEFORE = 24 * 60 * 60 * 1000 // warn 24h before expiry
    if (timeLeft <= 0) {
      logout()
    } else if (timeLeft < WARN_BEFORE) {
      setTokenExpiring(true)
    } else {
      setTokenExpiring(false)
      expiryTimerRef.current = setTimeout(() => setTokenExpiring(true), timeLeft - WARN_BEFORE)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      scheduleExpiryCheck(token)
      api.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    return () => { if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current) }
  }, [])

  async function login(email: string, password: string) {
    const r = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', r.data.token)
    scheduleExpiryCheck(r.data.token)
    setUser(r.data.user)
  }

  async function register(name: string, email: string, password: string) {
    const r = await api.post('/auth/register', { name, email, password })
    localStorage.setItem('token', r.data.token)
    scheduleExpiryCheck(r.data.token)
    setUser(r.data.user)
  }

  function logout() {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    localStorage.removeItem('token')
    setUser(null)
    setTokenExpiring(false)
  }

  async function logoutAll() {
    await api.post('/auth/logout-all')
    logout()
  }

  async function refreshUser() {
    const r = await api.get('/auth/me')
    setUser(r.data)
  }

  function dismissExpiryWarning() {
    setTokenExpiring(false)
  }

  async function updateProfile(data: { name?: string; email?: string; currentPassword: string }) {
    const r = await api.patch('/auth/profile', data)
    if (r.data.token) {
      localStorage.setItem('token', r.data.token)
      scheduleExpiryCheck(r.data.token)
    }
    setUser(r.data.user)
  }

  return (
    <AuthContext.Provider value={{ user, loading, tokenExpiring, login, register, logout, logoutAll, refreshUser, dismissExpiryWarning, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
