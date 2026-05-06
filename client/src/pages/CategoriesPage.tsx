import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { Category } from '../types'

const EMOJI_LIST = [
  // Ăn uống
  '🍜','🍱','🍔','🍕','🍣','🍛','🥗','🍺','☕','🧃','🍰','🥩',
  // Di chuyển
  '🚗','🛵','🚌','✈️','🚂','⛽','🅿️','🚕','🛺','🚲',
  // Nhà cửa
  '🏠','💡','🔧','🛒','🧹','🛁','📦','🪴','🛋️','🔑',
  // Mua sắm
  '👗','👟','👜','🛍️','💄','⌚','📱','💻','🎮','📷',
  // Sức khoẻ
  '💊','🏥','🧘','🏋️','💉','🦷','👓','🩺','🧬','🫀',
  // Giáo dục
  '📚','✏️','🎓','📐','🖊️','📖','🏫','🧑‍💻','🔬','🎨',
  // Giải trí
  '🎬','🎵','🎤','🎭','🎯','🎲','⚽','🏊','🎪','🎡',
  // Tài chính
  '💰','💳','🏦','📈','💵','🪙','💸','🧾','📊','🤑',
  // Gia đình
  '👶','🧒','👨‍👩‍👧','🎁','🎂','💝','🐶','🐱','🌿','🌸',
  // Khác
  '✨','⭐','🔖','📌','🗂️','📋','🧺','🪣','🔔','❤️',
]

const COLORS = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7',
  '#3B82F6', '#06B6D4', '#10B981', '#84CC16',
  '#F59E0B', '#6B7280',
]

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Category
  onSave: (data: { name: string; icon: string; color: string; type: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '📌')
  const [color, setColor] = useState(initial?.color ?? '#6B7280')
  const [type, setType] = useState(initial?.type ?? 'EXPENSE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSave({ name: name.trim(), icon: icon.trim(), color, type })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3">
        <div className="flex-shrink-0 relative" ref={pickerRef}>
          <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
          <button
            type="button"
            onClick={() => setShowPicker(v => !v)}
            className="w-14 h-10 text-center text-2xl border border-gray-200 rounded-lg hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
          >
            {icon}
          </button>
          {showPicker && (
            <div className="absolute left-0 top-12 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 w-64 max-h-56 overflow-y-auto">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_LIST.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setIcon(e); setShowPicker(false) }}
                    className={`text-xl p-1 rounded-lg hover:bg-emerald-50 transition ${icon === e ? 'bg-emerald-100' : ''}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-2 pt-2">
                <input
                  type="text"
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  placeholder="Hoặc dán emoji..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  maxLength={2}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tên danh mục</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="VD: Thú cưng"
            required
          />
        </div>
      </div>

      {!initial && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Loại</label>
          <div className="flex gap-2">
            {(['EXPENSE', 'INCOME'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  type === t
                    ? t === 'EXPENSE' ? 'bg-red-50 border-red-300 text-red-600' : 'bg-emerald-50 border-emerald-300 text-emerald-600'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {t === 'EXPENSE' ? '⬇ Chi tiêu' : '⬆ Thu nhập'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Màu sắc</label>
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

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">
          Hủy
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {loading ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Thêm'}
        </button>
      </div>
    </form>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tab, setTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})

  async function load() {
    const r = await api.get('/transactions/categories/all')
    setCategories(r.data)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(data: { name: string; icon: string; color: string; type: string }) {
    await api.post('/transactions/categories', data)
    setShowAdd(false)
    load()
  }

  async function handleUpdate(data: { name: string; icon: string; color: string; type: string }) {
    await api.put(`/transactions/categories/${editing!.id}`, data)
    setEditing(null)
    load()
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Xóa danh mục "${cat.name}"?`)) return
    try {
      await api.delete(`/transactions/categories/${cat.id}`)
      setDeleteError(prev => { const n = { ...prev }; delete n[cat.id]; return n })
      load()
    } catch (err: any) {
      setDeleteError(prev => ({ ...prev, [cat.id]: err.response?.data?.error || 'Không thể xóa' }))
    }
  }

  const defaults = categories.filter(c => c.isDefault && c.type === tab)
  const custom = categories.filter(c => !c.isDefault && c.type === tab)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Danh mục</h1>
        <button
          onClick={() => { setShowAdd(true); setEditing(null) }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          + Thêm mới
        </button>
      </div>

      {/* Tab */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['EXPENSE', 'INCOME'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            {t === 'EXPENSE' ? '⬇ Chi tiêu' : '⬆ Thu nhập'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Thêm danh mục mới</h3>
          <CategoryForm
            initial={undefined}
            onSave={handleAdd}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Custom categories */}
      {custom.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Của tôi</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {custom.map((cat, i) => (
              <div key={cat.id}>
                {editing?.id === cat.id ? (
                  <div className="px-4 py-4 border-t border-gray-50">
                    <CategoryForm
                      initial={cat}
                      onSave={handleUpdate}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <div className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: cat.color + '20' }}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{cat.name}</p>
                      {deleteError[cat.id] && (
                        <p className="text-xs text-red-500 mt-0.5">{deleteError[cat.id]}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(cat); setShowAdd(false) }}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded">
                        Sửa
                      </button>
                      <button onClick={() => handleDelete(cat)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">
                        Xóa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {custom.length === 0 && !showAdd && (
        <div className="bg-gray-50 rounded-2xl p-5 text-center text-sm text-gray-400">
          Chưa có danh mục tùy chỉnh.{' '}
          <button onClick={() => setShowAdd(true)} className="text-emerald-600 font-medium">Thêm ngay</button>
        </div>
      )}

      {/* Default categories */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mặc định</p>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {defaults.map((cat, i) => (
            <div key={cat.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: cat.color + '20' }}>
                {cat.icon}
              </div>
              <p className="text-sm text-gray-700 flex-1">{cat.name}</p>
              <span className="text-xs text-gray-300">Mặc định</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
