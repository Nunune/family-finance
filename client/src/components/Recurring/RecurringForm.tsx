import { useState, useEffect } from 'react'
import { Category, RecurringTransaction } from '../../types'
import api from '../../services/api'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'

interface Props {
  onSave: (r: RecurringTransaction) => void
  onClose: () => void
  hasFamilyWallet: boolean
}

const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export default function RecurringForm({ onSave, onClose, hasFamilyWallet }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE')
  const [categoryId, setCategoryId] = useState('')
  const [walletType, setWalletType] = useState<'PERSONAL' | 'SHARED'>('PERSONAL')
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [remindDays, setRemindDays] = useState('3')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data))
  }, [])

  const filteredCats = categories.filter(c => c.type === type || c.type === 'BOTH')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const parsed = parseAmount(amount)
      if (!parsed || parsed <= 0) { setError('Nhập số tiền hợp lệ (vd: 500k, 1tr5)'); setSaving(false); return }
      const { data } = await api.post('/recurring', {
        title,
        amount: String(parsed),
        type,
        categoryId,
        walletType,
        frequency,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : undefined,
        dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : undefined,
        remindDays,
      })
      onSave(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Thêm giao dịch định kỳ</h2>

        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            {(['EXPENSE', 'INCOME'] as const).map(t => (
              <button key={t} type="button" onClick={() => { setType(t); setCategoryId('') }}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
                  type === t
                    ? t === 'EXPENSE' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-green-50 border-green-400 text-green-700'
                    : 'border-gray-200 text-gray-500'
                }`}>
                {t === 'EXPENSE' ? '- Chi' : '+ Thu'}
              </button>
            ))}
          </div>

          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="Tên (vd: Tiền thuê nhà, Lương)"
            value={title} onChange={e => setTitle(e.target.value)} required
          />

          <AmountInput value={amount} onChange={setAmount} />

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Danh mục</label>
            <div className="flex flex-wrap gap-1.5">
              {filteredCats.map(c => (
                <button key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    categoryId === c.id ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
                  }`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {(['MONTHLY', 'WEEKLY'] as const).map(f => (
              <button key={f} type="button" onClick={() => setFrequency(f)}
                className={`flex-1 py-2 rounded-xl text-sm border transition ${
                  frequency === f ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-500'
                }`}>
                {f === 'MONTHLY' ? 'Hàng tháng' : 'Hàng tuần'}
              </button>
            ))}
          </div>

          {frequency === 'MONTHLY' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ngày trong tháng</label>
              <input type="number" min="1" max="31"
                className="w-32 border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} />
            </div>
          )}

          {frequency === 'WEEKLY' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ngày trong tuần</label>
              <div className="flex gap-1">
                {DOW_LABELS.map((d, i) => (
                  <button key={i} type="button" onClick={() => setDayOfWeek(String(i))}
                    className={`flex-1 py-1.5 rounded-lg text-xs border transition ${
                      dayOfWeek === String(i) ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Nhắc trước (ngày)</label>
              <input type="number" min="0" max="30"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={remindDays} onChange={e => setRemindDays(e.target.value)} />
            </div>
            {hasFamilyWallet && (
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Ví</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={walletType} onChange={e => setWalletType(e.target.value as any)}>
                  <option value="PERSONAL">Cá nhân</option>
                  <option value="SHARED">Quỹ chung</option>
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
              Huỷ
            </button>
            <button type="submit" disabled={saving || !categoryId}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
