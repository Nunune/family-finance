import { useState } from 'react'
import { Debt, FamilyMember } from '../../types'
import api from '../../services/api'
import { parseAmount, fmtVND } from '../../utils/amountParser'

interface Props {
  onSave: (debt: Debt) => void
  onClose: () => void
  familyMembers?: FamilyMember[]
  userId: string
}

const SCOPE_INFO = {
  PERSONAL: 'Chỉ bạn thấy và quản lý. Cập nhật ví cá nhân.',
  SHARED: 'Cả nhà cùng thấy. Cập nhật quỹ chung gia đình.',
  INTERNAL: 'Vay mượn giữa các thành viên trong gia đình.',
}

export default function DebtForm({ onSave, onClose, familyMembers = [], userId }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'BORROWED' | 'LENT'>('BORROWED')
  const [scope, setScope] = useState<'PERSONAL' | 'SHARED' | 'INTERNAL'>('PERSONAL')
  const [amountRaw, setAmountRaw] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [lenderUserId, setLenderUserId] = useState('')
  const [borrowerUserId, setBorrowerUserId] = useState('')
  const [linkToWallet, setLinkToWallet] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const otherMembers = familyMembers.filter(m => m.id !== userId)
  const parsedAmount = parseAmount(amountRaw)
  const amountValid = parsedAmount !== null && parsedAmount > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amountValid) { setError('Nhập số tiền hợp lệ (vd: 5tr, 1.500.000)'); return }
    setError('')
    setSaving(true)
    try {
      const { data } = await api.post('/debts', {
        title, type, scope,
        originalAmount: String(parsedAmount),
        counterparty,
        note: note || undefined,
        dueDate: dueDate || undefined,
        lenderUserId: scope === 'INTERNAL' ? lenderUserId : undefined,
        borrowerUserId: scope === 'INTERNAL' ? borrowerUserId : undefined,
        linkToWallet: scope !== 'INTERNAL' ? linkToWallet : false,
      })
      onSave(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col">
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-800">Thêm khoản nợ / vay</h2>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          <div className="flex gap-2">
            {(['BORROWED', 'LENT'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
                  type === t
                    ? t === 'BORROWED' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-green-50 border-green-400 text-green-700'
                    : 'border-gray-200 text-gray-500'
                }`}>
                {t === 'BORROWED' ? '🏦 Tôi đang vay' : '💵 Tôi đã cho vay'}
              </button>
            ))}
          </div>

          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="Tiêu đề (vd: Vay mua xe, Cho Minh vay)"
            value={title} onChange={e => setTitle(e.target.value)} required
          />

          <div>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Số tiền (vd: 5tr, 1tr5, 5.000.000)"
              value={amountRaw} onChange={e => setAmountRaw(e.target.value)} required
            />
            {amountRaw.trim() && (
              <p className={`text-xs mt-1 px-1 ${amountValid ? 'text-emerald-600' : 'text-gray-400'}`}>
                {amountValid ? `= ${fmtVND(parsedAmount!)}` : 'Không nhận dạng — thử: 5tr, 500k, 1.500.000'}
              </p>
            )}
          </div>

          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="Người / tổ chức (vd: Ngân hàng ACB, Minh)"
            value={counterparty} onChange={e => setCounterparty(e.target.value)} required
          />

          {familyMembers.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phạm vi</label>
              <div className="flex gap-2">
                {(['PERSONAL', 'SHARED', 'INTERNAL'] as const).map(s => (
                  <button key={s} type="button"
                    onClick={() => setScope(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                      scope === s ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-gray-200 text-gray-500'
                    }`}>
                    {s === 'PERSONAL' ? 'Cá nhân' : s === 'SHARED' ? 'Quỹ chung' : 'Nội bộ GĐ'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1 px-1">{SCOPE_INFO[scope]}</p>
            </div>
          )}

          {scope === 'INTERNAL' && otherMembers.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Người cho vay</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={lenderUserId} onChange={e => setLenderUserId(e.target.value)} required>
                  <option value="">Chọn...</option>
                  {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Người vay</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={borrowerUserId} onChange={e => setBorrowerUserId(e.target.value)} required>
                  <option value="">Chọn...</option>
                  {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hạn trả (tuỳ chọn)</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                placeholder="Tuỳ chọn" value={note} onChange={e => setNote(e.target.value)} />
            </div>
          </div>

          {scope !== 'INTERNAL' && (
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
              linkToWallet ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <input
                type="checkbox"
                checked={linkToWallet}
                onChange={e => setLinkToWallet(e.target.checked)}
                className="mt-0.5 rounded text-emerald-500 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Cập nhật số dư ví</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {type === 'BORROWED'
                    ? 'Cộng tiền vào ví ngay bây giờ (vừa nhận tiền vay). Bỏ tick nếu tiền đã có sẵn trong ví.'
                    : 'Trừ tiền khỏi ví ngay bây giờ (vừa đưa tiền đi). Bỏ tick nếu tiền chưa thực sự chuyển đi.'}
                </p>
              </div>
            </label>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
              Huỷ
            </button>
            <button type="submit" disabled={saving || !amountValid}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
