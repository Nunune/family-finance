import { useState } from 'react'
import LoginForm from '../components/Auth/LoginForm'
import RegisterForm from '../components/Auth/RegisterForm'
import ForgotPasswordPage from './ForgotPasswordPage'

type Mode = 'login' | 'register' | 'forgot'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')

  if (mode === 'forgot') return <ForgotPasswordPage onBack={() => setMode('login')} />
  if (mode === 'register') return <RegisterForm onSwitch={() => setMode('login')} />
  return <LoginForm onSwitch={() => setMode('register')} onForgot={() => setMode('forgot')} />
}
