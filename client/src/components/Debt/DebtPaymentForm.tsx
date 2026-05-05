import { useState } from 'react'
import { DebtPayment } from '../../types'
import api from '../../services/api'
import { parseAmount as parseShorthand } from '../../utils/amountParser'

interface Props {
  debtId: string
  remainingAmount: number
  onSave: (payment: DebtPayment) => void
  onClose: () => void
}

function fmtPreview(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫'
}

function fmtBtn(n: number): string {
  if (n >= 1_000_000 && n % 1_000_000 === 0) return n / 1_000_000 + 'tr'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr'
  if (n >= 1_000 && n % 1_000 === 0) return n / 1_000 + 'k'
  return n.toLocaleString('vi-VN')
}

function getQuickAmounts(remaining: number): number[] {
  const unit = remaining >= 10_000_000 ? 1_000_000
    : remaining >= 1_000_000 ? 100_000
    : remaining >= 100_000 ? 10_000
    : 1_000
  return [1, 2, 5, 10].map(m => unit * m).filter(v => v < remaining).slice(0, 4)
}

export default function DebtPaymentForm({ debtId, remainingAmount, onSave, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = parseShorthand(amount)
  const quickAmounts = getQuickAmounts(remainingAmount)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedAmt = parsed
    if (!parsedAmt || parsedAmt <= 0) { setError('Nhập số tiền hợp lệ'); return }
    if (parsedAmt > remainingAmount) {
      setError(`Vượt quá số còn lại (${fmtPreview(remainingAmount)})`)
      return
    }
    if (date > new Date().toISOString().slice(0, 10)) {
      setError('Ngày trả không được ở tương lai'); return
    }

    setSaving(true)
    try {
      const { data } = await api.post(`/debts/${debtId}/payments`, {
        amount: parsedAmt, date, note: note || undefined,
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
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-800">Ghi nhận thanh toán</h2>
        <p className="text-sm text-gray-500">
          Còn lại: <span className="font-semibold text-gray-700">{fmtPreview(remainingAmount)}</span>
        </p>

        <form onSubmit={submit} className="space-y-3">
          {/* Amount input */}
          <div>
            <div className="relative">
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 pr-20"
                placeholder="VD: 500k, 1tr, 1tr5, 2.5tr"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
              />
              <button type="button"
                onClick={() => setAmount(fmtBtn(remainingAmount))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium hover:text-emerald-700 px-1">
                Trả hết
              </button>
            </div>

            {/* Live preview */}
            {amount.trim() && (
              <p className={`text-xs mt-1 px-1 ${parsed ? 'text-emerald-600' : 'text-gray-400'}`}>
                {parsed ? `= ${fmtPreview(parsed)}` : 'Không nhận dạng được — thử: 500k, 1tr, 1.5tr'}
              </p>
            )}
          </div>

          {/* Quick amount buttons */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Nhập nhanh</p>
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(fmtBtn(v))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                    parsed === v
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  {fmtBtn(v)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(fmtBtn(remainingAmount))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  parsed === remainingAmount
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                {fmtBtn(remainingAmount)} (hết)
              </button>
            </div>
          </div>

          <input type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            value={date} max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDate(e.target.value)} required
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="Ghi chú (tuỳ chọn)"
            value={note} onChange={e => setNote(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
              Huỷ
            </button>
            <button type="submit" disabled={saving || !parsed}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
