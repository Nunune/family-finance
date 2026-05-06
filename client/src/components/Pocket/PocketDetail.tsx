import { useState, useEffect } from 'react'
import api from '../../services/api'
import { WalletPocket } from '../../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { parseAmount } from '../../utils/amountParser'

interface Entry {
  id: string
  pocketId: string
  amount: number
  type: 'DEPOSIT' | 'WITHDRAWAL'
  note: string | null
  date: string
  balanceAfter: number
  createdAt: string
}

interface MonthGroup {
  month: string
  entries: Entry[]
  totalDeposit: number
  totalWithdrawal: number
}

interface Props {
  pocket: WalletPocket
  onClose: () => void
  onBalanceChanged: (pocket: WalletPocket) => void
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd/MM/yyyy', { locale: vi })
}

function fmtMonth(key: string) {
  const [y, m] = key.split('-')
  return `Tháng ${parseInt(m)}/${y}`
}

export default function PocketDetail({ pocket, onClose, onBalanceChanged }: Props) {
  const [months, setMonths] = useState<MonthGroup[]>([])
  const [currentPocket, setCurrentPocket] = useState(pocket)
  const [loading, setLoading] = useState(true)

  // Add entry form
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')
  const [amountRaw, setAmountRaw] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Transfer form
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferRaw, setTransferRaw] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferDate, setTransferDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [transferring, setTransferring] = useState(false)

  const parsedAmount = parseAmount(amountRaw)
  const parsedTransfer = parseAmount(transferRaw)

  async function load() {
    setLoading(true)
    try {
      const r = await api.get(`/pockets/${pocket.id}/entries`)
      setMonths(r.data.months)
      setCurrentPocket(r.data.pocket)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [pocket.id])

  async function handleAddEntry() {
    if (!parsedAmount || parsedAmount <= 0) { setFormError('Nhập số tiền hợp lệ'); return }
    setSaving(true); setFormError('')
    try {
      await api.post(`/pockets/${pocket.id}/entries`, { amount: parsedAmount, type, note, date })
      setAmountRaw(''); setNote('')
      await load()
      onBalanceChanged(currentPocket)
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Lỗi lưu')
    } finally { setSaving(false) }
  }

  async function handleDelete(entryId: string) {
    if (!confirm('Xóa dòng này?')) return
    await api.delete(`/pockets/${pocket.id}/entries/${entryId}`)
    await load()
    onBalanceChanged(currentPocket)
  }

  async function handleTransfer() {
    if (!parsedTransfer || parsedTransfer <= 0) return
    setTransferring(true)
    try {
      const r = await api.post(`/pockets/${pocket.id}/transfer`, { amount: parsedTransfer, note: transferNote, date: transferDate })
      setCurrentPocket(r.data.pocket)
      setShowTransfer(false); setTransferRaw(''); setTransferNote('')
      await load()
      onBalanceChanged(r.data.pocket)
    } catch (e: any) {
      alert(e.response?.data?.error || 'Lỗi chuyển tiền')
    } finally { setTransferring(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 shrink-0 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: currentPocket.color + '20' }}>
            {currentPocket.icon}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{currentPocket.name}</p>
            <p className="text-sm font-semibold" style={{ color: currentPocket.color }}>
              {fmtMoney(currentPocket.balance)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Add entry form */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <div className="flex gap-1.5">
              <button onClick={() => setType('DEPOSIT')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${type === 'DEPOSIT' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                + Bỏ vào
              </button>
              <button onClick={() => setType('WITHDRAWAL')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${type === 'WITHDRAWAL' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                − Lấy ra
              </button>
            </div>

            <div className="flex gap-2">
              <input
                value={amountRaw}
                onChange={e => { setAmountRaw(e.target.value); setFormError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
                placeholder="500k, 1tr, 2tr5..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            {/* Quick amount chips */}
            {(!parsedAmount || parsedAmount <= 0) && (
              <div className="flex gap-1.5 flex-wrap -mt-1">
                {['50k', '100k', '200k', '500k', '1tr', '2tr', '5tr'].map(chip => (
                  <button key={chip} type="button" onClick={() => { setAmountRaw(chip); setFormError('') }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-emerald-100 hover:text-emerald-700 transition">
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {parsedAmount && parsedAmount > 0 && (
              <p className="text-xs text-emerald-600 -mt-1 px-1">= {fmtMoney(parsedAmount)}</p>
            )}

            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ghi chú (tuỳ chọn)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <button onClick={handleAddEntry} disabled={saving || !parsedAmount}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 transition">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>

          {/* Transfer to main wallet */}
          <div className="px-5 py-3 border-b border-gray-100">
            {!showTransfer ? (
              <button onClick={() => setShowTransfer(true)}
                className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-500 text-sm font-medium hover:border-indigo-400 transition">
                ↩ Chuyển về ví chính
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">Chuyển về ví chính</p>
                <div className="flex gap-2">
                  <input
                    value={transferRaw}
                    onChange={e => setTransferRaw(e.target.value)}
                    placeholder={`Tối đa ${fmtMoney(currentPocket.balance)}`}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <input
                    type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                {parsedTransfer && parsedTransfer > 0 && (
                  <p className="text-xs text-indigo-600 px-1">= {fmtMoney(parsedTransfer)}</p>
                )}
                <input
                  value={transferNote}
                  onChange={e => setTransferNote(e.target.value)}
                  placeholder="Ghi chú"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowTransfer(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">Huỷ</button>
                  <button onClick={handleTransfer} disabled={transferring || !parsedTransfer || (parsedTransfer ?? 0) > currentPocket.balance}
                    className="flex-1 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                    {transferring ? '...' : 'Chuyển'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {loading ? (
            <div className="py-8 text-center text-gray-300 text-sm">Đang tải...</div>
          ) : months.length === 0 ? (
            <div className="py-10 text-center text-gray-300 text-sm">Chưa có giao dịch nào</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {months.map(m => (
                <div key={m.month}>
                  {/* Month header */}
                  <div className="px-5 py-2.5 bg-gray-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">{fmtMonth(m.month)}</p>
                    <div className="flex gap-3 text-xs">
                      {m.totalDeposit > 0 && <span className="text-emerald-600">+{fmtMoney(m.totalDeposit)}</span>}
                      {m.totalWithdrawal > 0 && <span className="text-red-500">−{fmtMoney(m.totalWithdrawal)}</span>}
                    </div>
                  </div>
                  {/* Entries */}
                  {m.entries.map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 group">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${e.type === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                        {e.type === 'DEPOSIT' ? '+' : '−'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm font-semibold ${e.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {e.type === 'DEPOSIT' ? '+' : '−'}{fmtMoney(e.amount)}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">{fmtDate(e.date)}</span>
                        </div>
                        {e.note && <p className="text-xs text-gray-500 truncate mt-0.5">{e.note}</p>}
                        <p className="text-xs text-gray-300 mt-0.5">Số dư: {fmtMoney(e.balanceAfter)}</p>
                      </div>
                      <button onClick={() => handleDelete(e.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-lg leading-none shrink-0">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
