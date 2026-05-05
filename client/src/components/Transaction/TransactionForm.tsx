import { useState, useEffect, FormEvent } from 'react'
import api from '../../services/api'
import { Category, WalletType, Transaction } from '../../types'
import { format } from 'date-fns'

interface Props {
  walletType: WalletType
  onSuccess: () => void
  onCancel: () => void
  editing?: Transaction | null
}

export default function TransactionForm({ walletType, onSuccess, onCancel, editing }: Props) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(editing?.type || 'EXPENSE')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [date, setDate] = useState(editing ? format(new Date(editing.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState(editing?.note || '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data))
  }, [])

  const filtered = categories.filter(c => c.type === type || c.type === 'BOTH')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Chọn danh mục'); return }
    setError(''); setLoading(true)
    try {
      if (editing) {
        await api.put(`/transactions/${editing.id}`, { amount, type, date, note, categoryId })
      } else {
        await api.post('/transactions', { amount, type, date, note, categoryId, walletType })
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi lưu giao dịch')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">{editing ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button type="button" onClick={() => { setType('EXPENSE'); setCategoryId('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${type === 'EXPENSE' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Chi tiêu
            </button>
            <button type="button" onClick={() => { setType('INCOME'); setCategoryId('') }}
              className={`flex-1 py-2.5 text-sm font-semibold transition ${type === 'INCOME' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Thu nhập
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền (VNĐ)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="0" min="0" required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
            <div className="grid grid-cols-4 gap-2">
              {filtered.map(c => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition text-xs ${categoryId === c.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 hover:border-gray-300'}`}>
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-gray-600 text-center leading-tight">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <input
              value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Không bắt buộc"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
              Hủy
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition disabled:opacity-50">
              {loading ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
