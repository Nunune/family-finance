import { useState, FormEvent } from 'react'
import { SavingsGoal } from '../../types'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

const ICONS = ['🎯', '✈️', '🏖️', '🏠', '🚗', '💍', '📱', '💻', '🎓', '👶', '🏋️', '🎮', '💰', '🌏', '🎁']

interface Props {
  editing?: SavingsGoal
  onSave: (goal: SavingsGoal) => void
  onClose: () => void
}

export default function SavingsGoalForm({ editing, onSave, onClose }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '🎯')
  const [targetAmount, setTargetAmount] = useState(editing ? String(editing.targetAmount) : '')
  const [targetDate, setTargetDate] = useState(
    editing ? editing.targetDate.slice(0, 10) : ''
  )
  const [isShared, setIsShared] = useState(editing?.isShared ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsedAmount = Number(targetAmount.replace(/\./g, '').replace(',', '.')) || 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nhập tên quỹ'); return }
    if (parsedAmount <= 0) { setError('Nhập số tiền mục tiêu'); return }
    if (!targetDate) { setError('Chọn ngày mục tiêu'); return }
    if (new Date(targetDate) <= new Date()) { setError('Ngày mục tiêu phải ở tương lai'); return }

    setError('')
    setLoading(true)
    try {
      const body = { name: name.trim(), icon, targetAmount: parsedAmount, targetDate, isShared }
      const res = editing
        ? await api.put(`/savings/${editing.id}`, body)
        : await api.post('/savings', body)
      onSave(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi lưu quỹ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-bold text-gray-800 text-lg">{editing ? 'Sửa quỹ' : 'Tạo quỹ tiết kiệm'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon picker */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Biểu tượng</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`text-xl p-1.5 rounded-lg transition ${icon === ic ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'hover:bg-gray-100'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên quỹ</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="VD: Du lịch Đà Lạt, Mua xe..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền mục tiêu</label>
              <input
                value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                placeholder="VD: 50.000.000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày mục tiêu</label>
              <input
                type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>

          {user?.familyId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)}
                className="rounded" />
              <span className="text-sm text-gray-700">Quỹ chung gia đình (mọi thành viên có thể đóng góp)</span>
            </label>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
              Huỷ
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
              {loading ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Tạo quỹ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
