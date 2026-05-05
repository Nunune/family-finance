import { useState } from 'react'
import api from '../../services/api'
import type { SubFund, FamilyMember } from '../../types'

const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

const ICONS = ['🏦','💼','✈️','🏖️','🎓','🏠','🚗','🎮','💊','🎁','🍜','💰']

interface Props {
  funds: SubFund[]
  familyMembers: FamilyMember[]
  isAdmin: boolean
  currentUserId: string
  onChange: (funds: SubFund[]) => void
}

interface FormState { name: string; icon: string; description: string }

export default function SubFundManager({ funds, familyMembers, isAdmin, currentUserId, onChange }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editFund, setEditFund] = useState<SubFund | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', icon: '🏦', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openCreate() {
    setForm({ name: '', icon: '🏦', description: '' })
    setEditFund(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(fund: SubFund) {
    setForm({ name: fund.name, icon: fund.icon, description: fund.description ?? '' })
    setEditFund(fund)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) return setError('Nhập tên quỹ')
    setSaving(true); setError('')
    try {
      if (editFund) {
        const res = await api.put(`/sub-funds/${editFund.id}`, form)
        onChange(funds.map(f => f.id === editFund.id ? { ...f, ...res.data } : f))
      } else {
        const res = await api.post('/sub-funds', form)
        onChange([...funds, res.data])
      }
      setShowForm(false)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  async function remove(fund: SubFund) {
    if (!confirm(`Xoá quỹ "${fund.name}"? Toàn bộ giao dịch trong quỹ sẽ bị xoá.`)) return
    await api.delete(`/sub-funds/${fund.id}`)
    onChange(funds.filter(f => f.id !== fund.id))
  }

  async function addMember(fundId: string, userId: string) {
    try {
      const res = await api.post(`/sub-funds/${fundId}/members`, { targetUserId: userId })
      onChange(funds.map(f => f.id === fundId
        ? { ...f, members: [...f.members, res.data] }
        : f
      ))
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Lỗi khi thêm thành viên')
    }
  }

  async function removeMember(fundId: string, memberId: string) {
    await api.delete(`/sub-funds/${fundId}/members/${memberId}`)
    onChange(funds.map(f => f.id === fundId
      ? { ...f, members: f.members.filter(m => m.userId !== memberId) }
      : f
    ))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">🏦 Quỹ phụ</h3>
        {isAdmin && (
          <button onClick={openCreate}
            className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600">
            + Tạo quỹ
          </button>
        )}
      </div>

      {funds.length === 0 && (
        <div className="text-center py-8 text-gray-300">
          <p className="text-3xl mb-2">🏦</p>
          <p className="text-sm">Chưa có quỹ phụ nào</p>
          {isAdmin && <p className="text-xs mt-1">Tạo quỹ phụ để quản lý nhiều nguồn tiền riêng biệt</p>}
        </div>
      )}

      {funds.map(fund => {
        const expanded = expandedId === fund.id
        const isMember = fund.members.some(m => m.userId === currentUserId)
        const isLocalAdmin = fund.members.find(m => m.userId === currentUserId)?.role === 'ADMIN'
        const nonMembers = familyMembers.filter(fm => !fund.members.some(m => m.userId === fm.id))

        return (
          <div key={fund.id} className="border border-gray-100 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expanded ? null : fund.id)}
            >
              <span className="text-2xl">{fund.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{fund.name}</p>
                {fund.description && <p className="text-xs text-gray-400 truncate">{fund.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {fund.members.length} thành viên · {isMember ? 'Bạn đang tham gia' : 'Chưa tham gia'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${fund.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtFull(fund.balance)}
                </p>
                <p className="text-[10px] text-gray-400">Số dư</p>
              </div>
              <span className="text-gray-300 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                {/* Members */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Thành viên</p>
                  <div className="space-y-1.5">
                    {fund.members.map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                          {m.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-700">{m.user.name}</p>
                          <p className="text-[10px] text-gray-400">{m.role === 'ADMIN' ? 'Quản lý' : 'Thành viên'}</p>
                        </div>
                        {isLocalAdmin && m.userId !== currentUserId && (
                          <button onClick={() => removeMember(fund.id, m.userId)}
                            className="text-[10px] text-red-400 hover:text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-50">
                            Xoá
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add member */}
                  {isLocalAdmin && nonMembers.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400 mb-1">Thêm thành viên:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {nonMembers.map(fm => (
                          <button key={fm.id} onClick={() => addMember(fund.id, fm.id)}
                            className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-indigo-50 hover:border-indigo-300">
                            + {fm.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(isLocalAdmin || isAdmin) && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEdit(fund)}
                      className="flex-1 text-xs border border-gray-200 rounded-xl py-2 text-gray-600 hover:bg-white">
                      ✏️ Sửa
                    </button>
                    {isAdmin && (
                      <button onClick={() => remove(fund)}
                        className="flex-1 text-xs border border-red-100 rounded-xl py-2 text-red-500 hover:bg-red-50">
                        🗑️ Xoá quỹ
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{editFund ? 'Sửa quỹ' : 'Tạo quỹ phụ'}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Biểu tượng</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`w-9 h-9 text-xl rounded-xl flex items-center justify-center transition-colors ${
                      form.icon === ic ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'bg-gray-100 hover:bg-gray-200'
                    }`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tên quỹ *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                placeholder="vd: Quỹ du lịch, Quỹ mua xe..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Mô tả (tuỳ chọn)</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                placeholder="Mục đích của quỹ..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">
                Huỷ
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 bg-indigo-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
                {saving ? 'Đang lưu...' : editFund ? 'Lưu' : 'Tạo quỹ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
