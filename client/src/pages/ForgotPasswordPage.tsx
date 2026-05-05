import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import RecoveryCodeModal from '../components/Auth/RecoveryCodeModal'

type Step = 'verify' | 'reset' | 'done'

export default function ForgotPasswordPage({ onBack: onBackProp }: { onBack?: () => void } = {}) {
  const navigate = useNavigate()
  const onBack = onBackProp ?? (() => navigate('/'))
  const [step, setStep] = useState<Step>('verify')
  const [email, setEmail] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [newRecoveryCode, setNewRecoveryCode] = useState('')
  const [showNewCode, setShowNewCode] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/forgot-password/verify', {
        email,
        recoveryCode: recoveryCode.trim().toUpperCase(),
      })
      setResetToken(r.data.resetToken)
      setStep('reset')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Xác thực thất bại')
    } finally { setLoading(false) }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) { setError('Mật khẩu xác nhận không khớp'); return }
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/forgot-password/reset', { resetToken, newPassword })
      setNewRecoveryCode(r.data.newRecoveryCode)
      setStep('done')
      setShowNewCode(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Đặt lại mật khẩu thất bại')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">

        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
          ← Quay lại đăng nhập
        </button>

        {step === 'verify' && (
          <>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔐</div>
              <h1 className="text-xl font-bold text-gray-800">Quên mật khẩu</h1>
              <p className="text-sm text-gray-500 mt-1">Nhập email và mã khôi phục của bạn</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="email@example.com" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã khôi phục</label>
                <input
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="XXXX-XXXX-XXXX" required
                />
                <p className="text-xs text-gray-400 mt-1">Mã được cấp khi đăng ký tài khoản</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                {loading ? 'Đang xác thực...' : 'Xác thực'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🔒</div>
              <h1 className="text-xl font-bold text-gray-800">Đặt mật khẩu mới</h1>
              <p className="text-xs text-amber-600 mt-1">Phiên này hết hạn sau 15 phút</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Tối thiểu 6 ký tự" minLength={6} required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${confirm && confirm !== newPassword ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="Nhập lại mật khẩu" required
                />
                {confirm && confirm !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
                )}
              </div>
              <button type="submit" disabled={loading || newPassword !== confirm}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && !showNewCode && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Thành công!</h2>
            <p className="text-sm text-gray-500 mb-6">Mật khẩu đã được đặt lại</p>
            <button onClick={onBack} className="w-full bg-emerald-500 text-white font-semibold py-3 rounded-lg">
              Đăng nhập ngay
            </button>
          </div>
        )}
      </div>

      {/* Modal recovery code mới sau khi reset */}
      {showNewCode && newRecoveryCode && (
        <RecoveryCodeModal
          code={newRecoveryCode}
          onDone={() => { setShowNewCode(false); onBack() }}
        />
      )}
    </div>
  )
}
