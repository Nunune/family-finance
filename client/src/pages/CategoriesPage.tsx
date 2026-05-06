import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import api from '../services/api'
import { Category, RecipientLabel, Transaction } from '../types'

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
  onSave: (data: { name: string; icon: string; color: string; type: string; keywords: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '📌')
  const [color, setColor] = useState(initial?.color ?? '#6B7280')
  const [type, setType] = useState(initial?.type ?? 'EXPENSE')
  const [keywords, setKeywords] = useState(initial?.keywords ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSave({ name: name.trim(), icon: icon.trim(), color, type, keywords: keywords.trim() })
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

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Từ khoá nhận diện <span className="text-gray-400 font-normal">(cách nhau bằng dấu phẩy)</span>
        </label>
        <input
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          placeholder="vd: sữa, ensure, similac, vitamin"
        />
        {keywords.trim() && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {keywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
              <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full border border-indigo-200">
                {kw}
              </span>
            ))}
          </div>
        )}
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

const RECIPIENT_ICONS = ['👤','👩','👨','👶','🧒','👧','👦','👴','👵','🧑','👩‍👧','👨‍👩‍👧‍👦','🏠','💼','🎓','❤️']
const RECIPIENT_COLORS = ['#F97316','#EF4444','#EC4899','#A855F7','#3B82F6','#06B6D4','#10B981','#84CC16','#F59E0B','#6B7280']

function RecipientForm({ initial, onSave, onCancel }: {
  initial?: RecipientLabel
  onSave: (data: { name: string; icon: string; color: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? '👤')
  const [color, setColor] = useState(initial?.color ?? '#6B7280')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await onSave({ name: name.trim(), icon, color }) }
    catch (err: any) { setError(err.response?.data?.error || 'Có lỗi xảy ra') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <input value={name} onChange={e => setName(e.target.value)} required
        placeholder="Tên nhãn (Mẹ, Con, Cháu…)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      <div className="flex gap-2 items-start">
        <div>
          <p className="text-xs text-gray-500 mb-1">Icon</p>
          <div className="flex flex-wrap gap-1 max-w-[180px]">
            {RECIPIENT_ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setIcon(ic)}
                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center ${icon === ic ? 'ring-2 ring-emerald-400 bg-emerald-50' : 'hover:bg-gray-100'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Màu</p>
          <div className="flex flex-wrap gap-1.5">
            {RECIPIENT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="mt-2 w-8 h-8 rounded-xl flex items-center justify-center text-white text-xl" style={{ backgroundColor: color }}>
            {icon}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600">Hủy</button>
        <button type="submit" disabled={loading} className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {loading ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Thêm'}
        </button>
      </div>
    </form>
  )
}

function formatVND(n: number) {
  return n.toLocaleString('vi-VN') + ' ₫'
}

function TxMiniList({ transactions, loading, isExpense }: {
  transactions: Transaction[]
  loading: boolean
  isExpense: boolean
}) {
  if (loading) {
    return (
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs text-gray-400 text-center">Đang tải...</p>
      </div>
    )
  }
  if (transactions.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-gray-50">
        <p className="text-xs text-gray-400 text-center">Không có giao dịch trong tháng này</p>
      </div>
    )
  }
  return (
    <div className="border-t border-gray-100 bg-gray-50/60">
      {transactions.map((t, i) => (
        <div key={t.id} className={`flex items-center gap-2.5 px-4 py-2 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
          <div className="text-center min-w-[32px]">
            <p className="text-[10px] text-gray-400 leading-tight">{format(new Date(t.date), 'dd/MM', { locale: vi })}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 truncate">{t.note || t.category.name}</p>
            {t.recipientLabel && (
              <span className="text-[10px] px-1 py-0.5 rounded-full text-white"
                style={{ backgroundColor: t.recipientLabel.color }}>
                {t.recipientLabel.icon} {t.recipientLabel.name}
              </span>
            )}
          </div>
          <span className={`text-xs font-semibold ${isExpense ? 'text-red-500' : 'text-emerald-600'}`}>
            {isExpense ? '-' : '+'}{formatVND(t.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  const now = new Date()
  const [categories, setCategories] = useState<Category[]>([])
  const [recipients, setRecipients] = useState<RecipientLabel[]>([])
  const [tab, setTab] = useState<'EXPENSE' | 'INCOME' | 'RECIPIENT'>('EXPENSE')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [editingRecipient, setEditingRecipient] = useState<RecipientLabel | null>(null)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [catStats, setCatStats] = useState<Record<string, number>>({})
  const [recipientStats, setRecipientStats] = useState<Record<string, number>>({})

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTxns, setExpandedTxns] = useState<Record<string, Transaction[]>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function load() {
    const r = await api.get('/transactions/categories/all')
    setCategories(r.data)
  }

  async function loadRecipients() {
    const r = await api.get('/recipients')
    setRecipients(r.data)
  }

  useEffect(() => { load(); loadRecipients() }, [])

  useEffect(() => {
    setExpandedId(null)
    setExpandedTxns({})

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    api.get('/transactions/summary/stats', { params: { walletType: 'PERSONAL', month, year } })
      .then(r => {
        // category stats
        const catSrc: { id?: string; total: number }[] = tab === 'INCOME'
          ? (r.data.byIncome ?? [])
          : r.data.byCategory
        const catMap: Record<string, number> = {}
        catSrc.forEach(c => { if (c.id) catMap[c.id] = c.total })
        setCatStats(catMap)

        // recipient stats
        const recSrc: { id?: string; total: number }[] = r.data.byRecipient ?? []
        const recMap: Record<string, number> = {}
        recSrc.forEach(c => { if (c.id) recMap[c.id] = c.total })
        setRecipientStats(recMap)
      })
      .catch(() => {})

    void startDate; void endDate
  }, [month, year, tab])

  async function toggleExpand(id: string, filterKey: 'categoryId' | 'recipientLabelId') {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (expandedTxns[id]) return

    setLoadingId(id)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    try {
      const r = await api.get('/transactions', {
        params: { walletType: 'PERSONAL', startDate, endDate, [filterKey]: id, limit: 50 },
      })
      setExpandedTxns(prev => ({ ...prev, [id]: r.data.transactions ?? [] }))
    } finally {
      setLoadingId(null)
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  async function handleAdd(data: { name: string; icon: string; color: string; type: string; keywords: string }) {
    await api.post('/transactions/categories', data)
    setShowAdd(false)
    load()
  }

  async function handleUpdate(data: { name: string; icon: string; color: string; type: string; keywords: string }) {
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

  async function handleAddRecipient(data: { name: string; icon: string; color: string }) {
    await api.post('/recipients', data)
    setShowAdd(false); loadRecipients()
  }

  async function handleUpdateRecipient(data: { name: string; icon: string; color: string }) {
    await api.patch(`/recipients/${editingRecipient!.id}`, data)
    setEditingRecipient(null); loadRecipients()
  }

  async function handleDeleteRecipient(r: RecipientLabel) {
    if (!confirm(`Xóa nhãn "${r.name}"?`)) return
    await api.delete(`/recipients/${r.id}`)
    loadRecipients()
  }

  const defaults = categories.filter(c => c.isDefault && c.type === (tab as string))
  const custom = categories.filter(c => !c.isDefault && c.type === (tab as string))
  const totalStats = tab === 'RECIPIENT'
    ? Object.values(recipientStats).reduce((s, v) => s + v, 0)
    : Object.values(catStats).reduce((s, v) => s + v, 0)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Danh mục</h1>
        <button
          onClick={() => { setShowAdd(true); setEditing(null); setEditingRecipient(null) }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          + Thêm mới
        </button>
      </div>

      {/* Tab */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['EXPENSE', 'INCOME', 'RECIPIENT'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setShowAdd(false); setEditing(null); setEditingRecipient(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
          >
            {t === 'EXPENSE' ? '⬇ Chi' : t === 'INCOME' ? '⬆ Thu' : '👤 Nhận'}
          </button>
        ))}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 px-4 py-2.5">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition text-lg font-light"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">Tháng {month}/{year}</p>
          {totalStats > 0 && (
            <p className="text-xs text-gray-400">
              Tổng {tab === 'INCOME' ? 'thu' : 'chi'}:{' '}
              <span className={tab === 'INCOME' ? 'text-emerald-600' : 'text-red-500'}>
                {formatVND(totalStats)}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition text-lg font-light"
        >
          ›
        </button>
      </div>

      {/* Add form */}
      {showAdd && tab !== 'RECIPIENT' && (
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
      {tab !== 'RECIPIENT' && custom.length > 0 && (
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
                  <>
                    <div
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                      onClick={() => toggleExpand(cat.id, 'categoryId')}
                    >
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
                      {catStats[cat.id] ? (
                        <span className={`text-sm font-semibold ${tab === 'EXPENSE' ? 'text-red-500' : 'text-emerald-600'}`}>
                          {formatVND(catStats[cat.id])}
                        </span>
                      ) : null}
                      <span className="text-gray-300 text-sm">{expandedId === cat.id ? '▲' : '▾'}</span>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
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
                    {expandedId === cat.id && (
                      <TxMiniList
                        transactions={expandedTxns[cat.id] ?? []}
                        loading={loadingId === cat.id}
                        isExpense={tab === 'EXPENSE'}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab !== 'RECIPIENT' && custom.length === 0 && !showAdd && (
        <div className="bg-gray-50 rounded-2xl p-5 text-center text-sm text-gray-400">
          Chưa có danh mục tùy chỉnh.{' '}
          <button onClick={() => setShowAdd(true)} className="text-emerald-600 font-medium">Thêm ngay</button>
        </div>
      )}

      {/* Default categories */}
      {tab !== 'RECIPIENT' && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mặc định</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {defaults.map((cat, i) => (
              <div key={cat.id}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                  onClick={() => toggleExpand(cat.id, 'categoryId')}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: cat.color + '20' }}>
                    {cat.icon}
                  </div>
                  <p className="text-sm text-gray-700 flex-1">{cat.name}</p>
                  {catStats[cat.id] ? (
                    <span className={`text-sm font-semibold ${tab === 'EXPENSE' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {formatVND(catStats[cat.id])}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">Mặc định</span>
                  )}
                  <span className="text-gray-300 text-sm">{expandedId === cat.id ? '▲' : '▾'}</span>
                </div>
                {expandedId === cat.id && (
                  <TxMiniList
                    transactions={expandedTxns[cat.id] ?? []}
                    loading={loadingId === cat.id}
                    isExpense={tab === 'EXPENSE'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipient labels */}
      {tab === 'RECIPIENT' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            Nhãn dùng để gắn vào giao dịch chi tiêu — ghi rõ tiền chi cho ai. Bấm vào nhãn để xem giao dịch trong tháng.
          </div>

          {showAdd && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Thêm nhãn mới</h3>
              <RecipientForm onSave={handleAddRecipient} onCancel={() => setShowAdd(false)} />
            </div>
          )}

          {recipients.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {recipients.map((r, i) => (
                <div key={r.id}>
                  {editingRecipient?.id === r.id ? (
                    <div className="px-4 py-4 border-t border-gray-50">
                      <RecipientForm initial={r} onSave={handleUpdateRecipient} onCancel={() => setEditingRecipient(null)} />
                    </div>
                  ) : (
                    <>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                        onClick={() => toggleExpand(r.id, 'recipientLabelId')}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: r.color }}>
                          <span>{r.icon}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 flex-1">{r.name}</p>
                        {recipientStats[r.id] ? (
                          <span className="text-sm font-semibold text-red-500">
                            {formatVND(recipientStats[r.id])}
                          </span>
                        ) : null}
                        <span className="text-gray-300 text-sm">{expandedId === r.id ? '▲' : '▾'}</span>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingRecipient(r); setShowAdd(false) }}
                            className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded">Sửa</button>
                          <button onClick={() => handleDeleteRecipient(r)}
                            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">Xóa</button>
                        </div>
                      </div>
                      {expandedId === r.id && (
                        <TxMiniList
                          transactions={expandedTxns[r.id] ?? []}
                          loading={loadingId === r.id}
                          isExpense={true}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : !showAdd && (
            <div className="bg-gray-50 rounded-2xl p-5 text-center text-sm text-gray-400">
              Chưa có nhãn nào.{' '}
              <button onClick={() => setShowAdd(true)} className="text-emerald-600 font-medium">Thêm ngay</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
