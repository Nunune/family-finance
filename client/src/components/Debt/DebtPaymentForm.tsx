import { useState } from 'react'
import { DebtPayment } from '../../types'
import api from '../../services/api'

interface Props {
  debtId: string
  remainingAmount: number
  onSave: (payment: DebtPayment) => void
  onClose: () => void
}

export default function DebtPaymentForm({ debtId, remainingAmount, onSave, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsedAmt = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    if (!parsedAmt || parsedAmt <= 0) { setError('Nhập số tiền hợp lệ'); return }
    if (parsedAmt > remainingAmount) {
      setError(`Số tiền vượt quá số dư còn lại (${remainingAmount.toLocaleString('vi-VN')} ₫)`)
      return
    }

    setSaving(true)
    try {
      const { data } = await api.post(`/debts/${debtId}/payments`, {
        amount: parsedAmt,
        date,
        note: note || undefined,
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
        <p className="text-sm text-gray-500">Còn lại: <span className="font-semibold text-gray-700">{remainingAmount.toLocaleString('vi-VN')} ₫</span></p>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 pr-20"
              placeholder="Số tiền đã trả"
              value={amount} onChange={e => setAmount(e.target.value)} required
            />
            <button type="button"
              onClick={() => setAmount(remainingAmount.toString())}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium hover:text-emerald-700 px-1">
              Trả hết
            </button>
          </div>
          <input type="date"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={date} onChange={e => setDate(e.target.value)} required
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Ghi chú (tuỳ chọn)"
            value={note} onChange={e => setNote(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
              Huỷ
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
