import { useState } from 'react'
import { WalletPocket } from '../../types'
import api from '../../services/api'

const COLORS = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7',
  '#3B82F6', '#06B6D4', '#10B981', '#84CC16',
  '#F59E0B', '#6B7280',
]

const PRESETS = [
  { name: 'Tiết kiệm', icon: '🏦' },
  { name: 'Dự phòng', icon: '🛡️' },
  { name: 'Đám tiệc', icon: '🎉' },
  { name: 'Đi lại', icon: '🚗' },
  { name: 'Mua sắm', icon: '🛍️' },
  { name: 'Y tế', icon: '🏥' },
  { name: 'Học tập', icon: '📚' },
  { name: 'Du lịch', icon: '✈️' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

interface PocketFormState {
  name: string
  icon: string
  color: string
  balance: string
  isHidden: boolean
}

function PocketForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: PocketFormState
  onSave: (data: PocketFormState) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '💰')
  const [color, setColor] = useState(initial?.color ?? '#10B981')
  const [balance, setBalance] = useState(initial?.balance ?? '0')
  const [isHidden, setIsHidden] = useState(initial?.isHidden ?? false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await onSave({ name, icon, color, balance, isHidden })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-1">
      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {!initial && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Chọn nhanh</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => { setName(p.name); setIcon(p.icon) }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition ${
                  name === p.name ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Icon</label>
          <input
            value={icon}
            onChange={e => setIcon(e.target.value)}
            className="w-14 h-10 text-center text-2xl border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            maxLength={2}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Tên ví</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="VD: Tiết kiệm, Dự phòng..."
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Màu</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Số dư hiện tại (₫)
          <span className="text-gray-400 font-normal ml-1">— số tiền đang có trong ví này</span>
        </label>
        <input
          type="number"
          value={balance}
          onChange={e => setBalance(e.target.value)}
          min="0"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isHidden}
          onChange={e => setIsHidden(e.target.checked)}
          className="rounded text-emerald-500"
        />
        <span className="text-sm text-gray-700">Ẩn khỏi số dư khả dụng</span>
        <span className="text-xs text-gray-400">(tiết kiệm / dự phòng)</span>
      </label>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">
          Hủy
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {saving ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Thêm ví'}
        </button>
      </div>
    </form>
  )
}

interface Props {
  pockets: WalletPocket[]
  onUpdate: (pocket: WalletPocket) => void
  onCreate: (pocket: WalletPocket) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function PocketManager({ pockets, onUpdate, onCreate, onDelete, onClose }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<WalletPocket | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate(data: PocketFormState) {
    setSaving(true)
    try {
      const res = await api.post('/pockets', {
        ...data,
        balance: parseFloat(data.balance) || 0,
      })
      onCreate(res.data)
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(data: PocketFormState) {
    if (!editing) return
    setSaving(true)
    try {
      const res = await api.put(`/pockets/${editing.id}`, {
        ...data,
        balance: parseFloat(data.balance) || 0,
      })
      onUpdate(res.data)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pocket: WalletPocket) {
    if (!confirm(`Xóa ví "${pocket.name}"? Các giao dịch liên kết sẽ không bị xóa.`)) return
    await api.delete(`/pockets/${pocket.id}`)
    onDelete(pocket.id)
  }

  async function toggleHidden(pocket: WalletPocket) {
    const res = await api.put(`/pockets/${pocket.id}`, { isHidden: !pocket.isHidden })
    onUpdate(res.data)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Quản lý ví tiền</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          {pockets.length === 0 && !showAdd && (
            <p className="text-sm text-gray-400 text-center py-4">Chưa có ví nào. Thêm ví để phân loại tiền.</p>
          )}

          {pockets.map(pocket => (
            <div key={pocket.id}>
              {editing?.id === pocket.id ? (
                <div className="border border-emerald-200 rounded-2xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Sửa ví: {pocket.name}</p>
                  <PocketForm
                    initial={{
                      name: pocket.name,
                      icon: pocket.icon,
                      color: pocket.color,
                      balance: String(pocket.balance),
                      isHidden: pocket.isHidden,
                    }}
                    onSave={handleUpdate}
                    onCancel={() => setEditing(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: pocket.color + '20' }}
                  >
                    {pocket.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800">{pocket.name}</span>
                      {pocket.isHidden && (
                        <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">ẩn</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold" style={{ color: pocket.color }}>
                      {fmt(pocket.balance)} ₫
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleHidden(pocket)}
                      title={pocket.isHidden ? 'Hiện trong tổng' : 'Ẩn khỏi tổng'}
                      className={`text-sm px-2 py-1 rounded-lg transition ${
                        pocket.isHidden ? 'text-gray-400 hover:text-gray-600' : 'text-emerald-500 hover:text-emerald-700'
                      }`}
                    >
                      {pocket.isHidden ? '🔒' : '👁'}
                    </button>
                    <button onClick={() => { setEditing(pocket); setShowAdd(false) }}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded">
                      Sửa
                    </button>
                    <button onClick={() => handleDelete(pocket)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">
                      Xóa
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showAdd ? (
            <div className="border border-emerald-200 rounded-2xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Thêm ví mới</p>
              <PocketForm
                onSave={handleCreate}
                onCancel={() => setShowAdd(false)}
                saving={saving}
              />
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setEditing(null) }}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition"
            >
              + Thêm ví mới
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
