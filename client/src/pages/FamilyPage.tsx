import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Family } from '../types'
import FamilySetup from '../components/Family/FamilySetup'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface Invite {
  inviteCode: string
  hint: string
  expiresAt: string
  createdAt: string
}

export default function FamilyPage() {
  const { user } = useAuth()
  const [family, setFamily] = useState<Family | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [showCreateInvite, setShowCreateInvite] = useState(false)
  const [personalCode, setPersonalCode] = useState('')
  const [hint, setHint] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [newInvite, setNewInvite] = useState<Invite | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.familyId) return
    api.get('/auth/family').then(r => setFamily(r.data)).catch(() => {})
    if (user.role === 'ADMIN') {
      api.get('/auth/family/invites').then(r => setInvites(r.data)).catch(() => {})
    }
  }, [user])

  if (!user?.familyId) return <FamilySetup />

  async function handleCreateInvite() {
    if (!personalCode.trim() || !hint.trim()) return
    setInviteError(''); setInviteLoading(true)
    try {
      const r = await api.post('/auth/family/invite', { personalCode, hint })
      setNewInvite(r.data)
      setInvites(prev => [...prev, r.data])
      setShowCreateInvite(false)
      setPersonalCode(''); setHint('')
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Lỗi tạo mã mời')
    } finally { setInviteLoading(false) }
  }

  async function handleRevokeInvite(code: string) {
    if (!confirm('Thu hồi mã mời này?')) return
    await api.delete(`/auth/family/invite/${code}`)
    setInvites(prev => prev.filter(i => i.inviteCode !== code))
    if (newInvite?.inviteCode === code) setNewInvite(null)
  }

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const roleLabel = (role: string) => role === 'ADMIN' ? '👑 Admin' : '👤 Thành viên'

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800">👨‍👩‍👧‍👦 Gia đình</h1>

      {family && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-1">{family.name}</h2>
          <p className="text-sm text-gray-500 mb-4">{family.members.length}/5 thành viên</p>
          <div className="space-y-3">
            {family.members.map(m => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    {m.id === user.id && <span className="text-xs text-gray-400">(bạn)</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{roleLabel(m.role)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {user.role === 'ADMIN' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Mời thành viên</h3>
            {!showCreateInvite && (
              <button onClick={() => setShowCreateInvite(true)}
                className="text-sm bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition">
                + Tạo mã mời
              </button>
            )}
          </div>

          {showCreateInvite && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Mã cá nhân — chỉ người được mời mới biết
                </label>
                <input value={personalCode} onChange={e => setPersonalCode(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="VD: 0901234567 hoặc 01/01/1990" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Gợi ý hiển thị cho người được mời
                </label>
                <input value={hint} onChange={e => setHint(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="VD: Số điện thoại của bạn" />
              </div>
              {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowCreateInvite(false); setInviteError('') }}
                  className="flex-1 py-2 rounded-lg border text-gray-600 text-sm">Hủy</button>
                <button onClick={handleCreateInvite} disabled={inviteLoading || !personalCode.trim() || !hint.trim()}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
                  {inviteLoading ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </div>
          )}

          {newInvite && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-3">
              <p className="text-xs font-semibold text-emerald-700 mb-3">✓ Mã mời vừa tạo — chia sẻ cho thành viên</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs text-gray-400">Mã mời</p>
                    <p className="font-mono font-bold text-gray-800 tracking-widest text-lg">{newInvite.inviteCode}</p>
                  </div>
                  <button onClick={() => copy(newInvite.inviteCode, 'code')}
                    className="text-xs bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg">
                    {copiedField === 'code' ? '✓ Đã sao chép' : 'Sao chép'}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs text-gray-400">Gợi ý mã cá nhân</p>
                    <p className="text-sm text-gray-700 font-medium">{newInvite.hint}</p>
                  </div>
                  <button onClick={() => copy(newInvite.hint, 'hint')}
                    className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg">
                    {copiedField === 'hint' ? '✓' : 'Sao chép'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Hết hạn: {format(new Date(newInvite.expiresAt), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
                </p>
              </div>
            </div>
          )}

          {invites.filter(i => i.inviteCode !== newInvite?.inviteCode).length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-gray-400 font-medium">Mã đang hoạt động</p>
              {invites
                .filter(i => i.inviteCode !== newInvite?.inviteCode)
                .map(inv => (
                  <div key={inv.inviteCode} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-mono text-sm font-medium text-gray-700">{inv.inviteCode}</span>
                      <span className="text-xs text-gray-400 ml-2">· {inv.hint}</span>
                    </div>
                    <button onClick={() => handleRevokeInvite(inv.inviteCode)}
                      className="text-xs text-red-400 hover:text-red-600">Thu hồi</button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex gap-2">
        <span className="text-amber-500 flex-shrink-0">🔒</span>
        <div className="text-xs text-amber-700 space-y-1">
          <p>Ví cá nhân của mỗi thành viên hoàn toàn riêng tư — kể cả Admin không xem được.</p>
          <p>Tham gia gia đình cần cả mã mời lẫn mã cá nhân do Admin thiết lập riêng cho bạn.</p>
        </div>
      </div>
    </div>
  )
}
