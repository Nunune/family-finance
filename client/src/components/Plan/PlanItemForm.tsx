import { useState, useEffect } from 'react'
import api from '../../services/api'
import { parseAmount } from '../../utils/amountParser'
import type { PlanItem, Category, PlanFrequency } from '../../types'

interface Props {
  item?: PlanItem | null
  onSaved: (item: PlanItem) => void
  onClose: () => void
}

const FREQ_OPTIONS: { value: PlanFrequency; label: string; desc: string }[] = [
  { value: 'MONTHLY', label: '📅 Hàng tháng', desc: 'Lặp lại mỗi tháng vào cùng ngày' },
  { value: 'WEEKLY', label: '🗓️ Hàng tuần', desc: 'Lặp lại mỗi tuần vào cùng thứ' },
  { value: 'ONCE', label: '1️⃣ Một lần', desc: 'Chỉ xuất hiện vào ngày cụ thể' },
]

const DAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

export default function PlanItemForm({ item, onSaved, onClose }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [amountStr, setAmountStr] = useState(item ? item.amount.toLocaleString('vi-VN') : '')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(item?.type ?? 'EXPENSE')
  const [frequency, setFrequency] = useState<PlanFrequency>(item?.frequency ?? 'MONTHLY')
  const [dueDay, setDueDay] = useState<string>(item?.dueDay != null ? String(item.dueDay) : '1')
  const [dueDate, setDueDate] = useState(item?.dueDate ? item.dueDate.slice(0, 10) : '')
  const [remindDays, setRemindDays] = useState(item?.remindDays ?? 3)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => {
      setCategories(r.data.filter((c: Category) => c.type === type || c.type === 'BOTH'))
    }).catch(() => {})
  }, [type])

  const parsedAmount = parseAmount(amountStr)

  async function submit() {
    if (!title.trim()) return setError('Nhập tên khoản')
    if (!parsedAmount || parsedAmount <= 0) return setError('Nhập số tiền hợp lệ')
    if (frequency === 'ONCE' && !dueDate) return setError('Chọn ngày cho khoản một lần')

    setSaving(true)
    setError('')
    try {
      const payload = {
        title: title.trim(),
        amount: parsedAmount,
        type,
        frequency,
        dueDay: frequency !== 'ONCE' ? parseInt(dueDay) : null,
        dueDate: frequency === 'ONCE' ? dueDate : null,
        remindDays,
        categoryId: categoryId || null,
        note: note.trim() || null,
      }
      const res = item
        ? await api.put(`/plan-items/${item.id}`, payload)
        : await api.post('/plan-items', payload)
      onSaved(res.data)
    } catch {
      setError('Lưu thất bại, thử lại nhé')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-800">
            {item ? 'Sửa khoản dự kiến' : 'Thêm dự thu / dự chi'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Thu / Chi toggle */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['EXPENSE', 'INCOME'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setType(t); setCategoryId('') }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  type === t
                    ? t === 'EXPENSE' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {t === 'EXPENSE' ? '💸 Dự chi' : '💰 Dự thu'}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tên khoản *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="vd: Tiền lương, Tiền nhà, Học phí..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Số tiền dự kiến *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
              placeholder="vd: 15tr, 500k, 1.500.000"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
            />
            {parsedAmount && parsedAmount > 0 && (
              <p className="text-xs text-emerald-600 mt-1">= {fmtFull(parsedAmount)}</p>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Chu kỳ lặp lại</label>
            <div className="space-y-2">
              {FREQ_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                  frequency === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="freq" value={opt.value} checked={frequency === opt.value}
                    onChange={() => setFrequency(opt.value)} className="accent-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Due day / date */}
          {frequency === 'MONTHLY' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vào ngày mấy trong tháng?</label>
              <select
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Ngày {d}</option>
                ))}
              </select>
            </div>
          )}

          {frequency === 'WEEKLY' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vào thứ mấy?</label>
              <select
                value={dueDay}
                onChange={e => setDueDay(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {frequency === 'ONCE' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ngày cụ thể</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {/* Remind days */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Nhắc nhở trước {remindDays} ngày
            </label>
            <input
              type="range" min={0} max={14} step={1} value={remindDays}
              onChange={e => setRemindDays(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>Không nhắc</span>
              <span className="font-medium text-indigo-600">{remindDays === 0 ? 'Tắt' : `${remindDays} ngày`}</span>
              <span>14 ngày</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Danh mục (tuỳ chọn)</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">— Không chọn —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ghi chú thêm..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-500 hover:bg-gray-50">
            Huỷ
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : item ? 'Lưu thay đổi' : 'Thêm khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
