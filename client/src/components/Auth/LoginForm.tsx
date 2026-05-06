import { useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  onSwitch: () => void
  onForgot: () => void
}

export default function LoginForm({ onSwitch, onForgot }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const sessionExpired = sessionStorage.getItem('session_expired') === '1'
  if (sessionExpired) sessionStorage.removeItem('session_expired')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Thu Chi</h1>
          <p className="text-gray-500 text-sm mt-1">Gia đình</p>
        </div>

        {sessionExpired && (
          <div className="bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg mb-4">
            Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="email@example.com" required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="••••••••" required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <div className="text-right mt-1">
              <button type="button" onClick={onForgot} className="text-xs text-emerald-600 hover:underline">
                Quên mật khẩu?
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Chưa có tài khoản?{' '}
          <button onClick={onSwitch} className="text-emerald-600 font-medium hover:underline">Đăng ký</button>
        </p>
      </div>
    </div>
  )
}
