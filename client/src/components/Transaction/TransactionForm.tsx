import { useState, useEffect, FormEvent } from 'react'
import api from '../../services/api'
import { Category, WalletType, Transaction, WalletPocket } from '../../types'
import { format } from 'date-fns'
import { parseAmount, fmtVND } from '../../utils/amountParser'

interface Props {
  walletType: WalletType
  pockets?: WalletPocket[]
  onSuccess: () => void
  onCancel: () => void
  editing?: Transaction | null
  subFundId?: string  // nếu là giao dịch quỹ phụ
}

export default function TransactionForm({ walletType, pockets = [], onSuccess, onCancel, editing, subFundId }: Props) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(editing?.type || 'EXPENSE')
  const [amountRaw, setAmountRaw] = useState(editing ? editing.amount.toLocaleString('vi-VN') : '')
  const [date, setDate] = useState(editing ? format(new Date(editing.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState(editing?.note || '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId || '')
  const [pocketId, setPocketId] = useState<string>(editing?.pocketId || '')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data))
  }, [])

  const filtered = categories.filter(c => c.type === type || c.type === 'BOTH')
  const parsedAmount = parseAmount(amountRaw)
  const amountIsValid = parsedAmount !== null && parsedAmount > 0

  const selectedPocket = pockets.find(p => p.id === pocketId)
  const pocketShortfall = selectedPocket && parsedAmount && type === 'EXPENSE'
    ? parsedAmount - selectedPocket.balance
    : 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!categoryId) { setError('Chọn danh mục'); return }
    if (!amountIsValid) { setError('Nhập số tiền hợp lệ (vd: 45k, 1tr5, 500.000)'); return }
    setError(''); setLoading(true)
    try {
      const pocket = walletType === 'PERSONAL' ? pocketId || null : null
      const amount = String(parsedAmount)
      if (editing) {
        await api.put(`/transactions/${editing.id}`, { amount, type, date, note, categoryId, pocketId: pocket })
      } else {
        const wt = subFundId ? 'SUBFUND' : walletType
        await api.post('/transactions', { amount, type, date, note, categoryId, walletType: wt, pocketId: pocket, subFundId: subFundId ?? null })
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi lưu giao dịch')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col">
        <div className="p-6 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800">{editing ? 'Sửa giao dịch' : 'Thêm giao dịch'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {error && <div className="mx-6 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-2">{error}</div>}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền</label>
            <input
              value={amountRaw}
              onChange={e => setAmountRaw(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="vd: 45k, 1tr5, 500.000"
              inputMode="decimal"
              required
            />
            {amountRaw.trim() && (
              <p className={`text-xs mt-1 px-1 ${amountIsValid ? 'text-emerald-600' : 'text-gray-400'}`}>
                {amountIsValid ? `= ${fmtVND(parsedAmount!)}` : 'Không nhận dạng — thử: 45k, 1tr, 1.5tr, 500000'}
              </p>
            )}
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

          {walletType === 'PERSONAL' && pockets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ví tiền <span className="text-gray-400 font-normal text-xs">(tuỳ chọn — chọn nếu muốn trừ từ ví cụ thể)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPocketId('')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition ${!pocketId ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                >
                  Không chọn
                </button>
                {pockets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPocketId(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition ${pocketId === p.id ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <span>{p.icon}</span>
                    <span>{p.name}</span>
                    <span className="text-gray-400">{p.balance.toLocaleString('vi-VN')}₫</span>
                  </button>
                ))}
              </div>
              {pocketShortfall > 0 && (
                <p className="text-xs text-amber-600 mt-1.5 px-1">
                  ⚠ Ví này thiếu {fmtVND(pocketShortfall)} — số dư ví sẽ xuống âm
                </p>
              )}
            </div>
          )}

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
            <button type="submit" disabled={loading || !amountIsValid}
              className="flex-1 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition disabled:opacity-50">
              {loading ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
