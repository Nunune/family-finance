import { useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

export default function FamilySetup() {
  const { refreshUser } = useAuth()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [personalCode, setPersonalCode] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!familyName.trim()) return
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/family/create', { name: familyName })
      localStorage.setItem('token', r.data.token)
      await refreshUser()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi tạo gia đình')
    } finally { setLoading(false) }
  }

  async function handleJoin() {
    if (!inviteCode.trim() || !personalCode.trim()) return
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/family/join', {
        inviteCode: inviteCode.toUpperCase(),
        personalCode,
      })
      localStorage.setItem('token', r.data.token)
      await refreshUser()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Không thể tham gia')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold text-gray-800">Thiết lập gia đình</h1>
          <p className="text-gray-500 text-sm mt-1">Tạo hoặc tham gia nhóm gia đình</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        {mode === 'choose' && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')}
              className="w-full border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl p-4 text-left transition">
              <div className="font-semibold text-gray-800">Tạo gia đình mới</div>
              <div className="text-sm text-gray-500 mt-1">Bạn sẽ là quản trị viên</div>
            </button>
            <button onClick={() => setMode('join')}
              className="w-full border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl p-4 text-left transition">
              <div className="font-semibold text-gray-800">Tham gia gia đình</div>
              <div className="text-sm text-gray-500 mt-1">Nhập mã mời và mã cá nhân từ Admin</div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <button onClick={() => setMode('choose')} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên gia đình</label>
              <input value={familyName} onChange={e => setFamilyName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Gia đình Nguyễn" />
            </div>
            <button onClick={handleCreate} disabled={loading || !familyName.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
              {loading ? 'Đang tạo...' : 'Tạo gia đình'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <button onClick={() => setMode('choose')} className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</button>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã mời (8 ký tự)</label>
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="XXXXXXXX" maxLength={8} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã cá nhân</label>
              <input value={personalCode} onChange={e => setPersonalCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Do Admin cung cấp kèm gợi ý" />
              <p className="text-xs text-gray-400 mt-1">VD: 4 số cuối SĐT, ngày sinh... Admin sẽ cho bạn biết gợi ý</p>
            </div>

            <button onClick={handleJoin} disabled={loading || inviteCode.length < 8 || !personalCode.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
              {loading ? 'Đang tham gia...' : 'Tham gia'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
