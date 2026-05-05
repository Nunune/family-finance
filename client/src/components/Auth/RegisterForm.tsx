import { useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import RecoveryCodeModal from './RecoveryCodeModal'
import api from '../../services/api'

interface Props {
  onSwitch: () => void
}

export default function RegisterForm({ onSwitch }: Props) {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/register', { name, email, password })
      // Chưa set token ngay — đợi user lưu recovery code trước
      setPendingToken(r.data.token)
      setRecoveryCode(r.data.recoveryCode)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  function handleRecoveryConfirmed() {
    if (pendingToken) {
      localStorage.setItem('token', pendingToken)
      // Trigger auth refresh bằng cách reload
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💰</div>
          <h1 className="text-2xl font-bold text-gray-800">Tạo tài khoản</h1>
          <p className="text-gray-500 text-sm mt-1">Quản lý thu chi gia đình</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex gap-3">
          <span className="text-lg shrink-0">🔑</span>
          <p className="text-xs text-amber-800 leading-relaxed">
            Sau khi đăng ký, bạn sẽ nhận <strong>mã khôi phục</strong> — hãy chụp màn hình hoặc ghi lại.
            Mã này dùng để lấy lại tài khoản khi quên mật khẩu.
          </p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Nguyễn Văn A" required
            />
          </div>
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
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Tối thiểu 6 ký tự" minLength={6} required
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
            {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Đã có tài khoản?{' '}
          <button onClick={onSwitch} className="text-emerald-600 font-medium hover:underline">Đăng nhập</button>
        </p>
      </div>

      {recoveryCode && (
        <RecoveryCodeModal code={recoveryCode} onDone={handleRecoveryConfirmed} />
      )}
    </div>
  )
}
