import { useState, useEffect } from 'react'
import api from '../../services/api'
import type { Hui, HuiRound, WalletInfo } from '../../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import AmountInput from '../shared/AmountInput'
import { parseAmount } from '../../utils/amountParser'

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => format(new Date(s), 'dd/MM', { locale: vi })
const fmtDateFull = (s: string) => format(new Date(s), 'dd/MM/yy', { locale: vi })
const fmtMonthYear = (s: string) => format(new Date(s), 'MM/yyyy', { locale: vi })

function toChip(v: number): string {
  if (v >= 1_000_000 && v % 1_000_000 === 0) return `${v / 1_000_000}tr`
  if (v >= 1_000_000 && v % 100_000 === 0) return `${Math.floor(v / 1_000_000)}tr${(v % 1_000_000) / 100_000}`
  if (v % 1_000 === 0) return `${v / 1_000}k`
  return v.toLocaleString('vi-VN')
}

function getBidChips(baseAmount: number): string[] {
  const percents = [0.75, 0.8, 0.85, 0.9, 0.95, 1.0]
  const seen = new Set<number>()
  return percents
    .map(p => Math.round(baseAmount * p / 10000) * 10000)
    .filter(v => { if (seen.has(v)) return false; seen.add(v); return true })
    .map(toChip)
}


// Tính tiền phải đóng kỳ này:
// - roundNo ∈ myRounds: hốt hụi → null (không đóng)
// - live = số suất chưa hốt (myRound > roundNo): đóng bidAmount hoặc giá gốc
// - dead = số suất đã hốt (myRound < roundNo): luôn đóng giá gốc
function actualPay(r: HuiRound, hui: Hui): number | null {
  if (hui.myRounds.includes(r.roundNo)) return null
  const live = hui.myRounds.filter(mr => mr > r.roundNo).length
  const dead = hui.myRounds.filter(mr => mr < r.roundNo).length
  const payPerLive = r.bidAmount ?? hui.amount
  return live * payPerLive + dead * hui.amount
}

// Lời thực đóng so với giá gốc (chỉ suất sống)
function profit(r: HuiRound, hui: Hui): number {
  if (!r.bidAmount) return 0
  const live = hui.myRounds.filter(mr => mr > r.roundNo).length
  return live * (hui.amount - r.bidAmount)
}

interface Props {
  huis: Hui[]
  onUpdate: (h: Hui) => void
  onDelete: (id: string) => void
}

export default function HuiList({ huis, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!huis.length) {
    return (
      <div className="text-center py-12 text-gray-300">
        <p className="text-4xl mb-3">🔄</p>
        <p className="text-sm">Chưa có hụi nào</p>
        <p className="text-xs mt-1">Thêm hụi để theo dõi vòng xoay và lịch đóng tiền</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {huis.map(h => (
        <HuiCard key={h.id} hui={h}
          expanded={expanded === h.id}
          onToggleExpand={() => setExpanded(p => p === h.id ? null : h.id)}
          onUpdate={onUpdate} onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function HuiCard({ hui, expanded, onToggleExpand, onUpdate, onDelete }: {
  hui: Hui; expanded: boolean
  onToggleExpand: () => void
  onUpdate: (h: Hui) => void
  onDelete: (id: string) => void
}) {
  const [toggling, setToggling] = useState<number | null>(null)
  const [biddingRound, setBiddingRound] = useState<number | null>(null)
  const [bidInput, setBidInput] = useState('')
  const [ownerInput, setOwnerInput] = useState('')
  const [editingMyRounds, setEditingMyRounds] = useState(false)
  const [myRoundsEdit, setMyRoundsEdit] = useState<number[]>(hui.myRounds)
  const [feeInlineInput, setFeeInlineInput] = useState(hui.organizerFee != null ? hui.organizerFee.toLocaleString('vi-VN') : '')
  const [savingMyRounds, setSavingMyRounds] = useState(false)
  const [editingWallet, setEditingWallet] = useState(false)
  const [walletIdEdit, setWalletIdEdit] = useState(hui.walletId ?? '')
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [editingFee, setEditingFee] = useState(false)
  const [feeInput, setFeeInput] = useState(hui.organizerFee != null ? hui.organizerFee.toLocaleString('vi-VN') : '')
  const [feeError, setFeeError] = useState('')
  const today = new Date()

  useEffect(() => {
    if (editingWallet && wallets.length === 0) {
      api.get('/wallets').then(r => setWallets(r.data)).catch(() => {})
    }
  }, [editingWallet])

  const slots = hui.myRounds.length

  const doneCount = hui.rounds.filter(r => r.isPaid || r.isReceived).length
  const nextPending = hui.rounds.find(r => !r.isPaid && !r.isReceived)
  const isCompleted = doneCount === hui.totalRounds || hui.status === 'COMPLETED'

  const totalProfit = hui.rounds
    .filter(r => r.isPaid && r.bidAmount)
    .reduce((s, r) => s + profit(r, hui), 0)

  const totalPaid = hui.rounds
    .filter(r => r.isPaid)
    .reduce((s, r) => s + (actualPay(r, hui) ?? 0), 0)

  async function refreshHui() {
    const res = await api.get('/hui')
    const updated = res.data.find((h: Hui) => h.id === hui.id)
    if (updated) onUpdate(updated)
  }

  async function toggleRound(roundNo: number) {
    setToggling(roundNo)
    try {
      await api.post(`/hui/${hui.id}/rounds/${roundNo}/toggle`)
      await refreshHui()
    } finally { setToggling(null) }
  }

  async function saveBid(roundNo: number) {
    const amount = parseAmount(bidInput)
    if (!amount || amount <= 0) return
    await api.patch(`/hui/${hui.id}/rounds/${roundNo}/bid`, {
      bidAmount: amount,
      ownerName: ownerInput || undefined,
    })
    setBiddingRound(null); setBidInput(''); setOwnerInput('')
    await refreshHui()
  }

  async function clearBid(roundNo: number) {
    await api.patch(`/hui/${hui.id}/rounds/${roundNo}/bid`, { bidAmount: null })
    await refreshHui()
  }

  async function saveOrganizerFee() {
    const fee = parseAmount(feeInput)
    setFeeError('')
    try {
      const res = await api.patch(`/hui/${hui.id}`, { organizerFee: fee ?? null })
      onUpdate(res.data)
      setEditingFee(false)
    } catch (err: any) {
      setFeeError(err?.response?.data?.error || 'Lỗi lưu, thử lại')
    }
  }

  async function clearOrganizerFee() {
    setFeeError('')
    try {
      const res = await api.patch(`/hui/${hui.id}`, { organizerFee: null })
      onUpdate(res.data)
      setFeeInput('')
      setEditingFee(false)
    } catch (err: any) {
      setFeeError(err?.response?.data?.error || 'Lỗi xóa phí, thử lại')
    }
  }

  async function saveWallet() {
    try {
      const res = await api.patch(`/hui/${hui.id}`, { walletId: walletIdEdit || null })
      onUpdate(res.data)
      setEditingWallet(false)
    } catch {}
  }

  async function saveMyRounds() {
    if (myRoundsEdit.length === 0) return
    setSavingMyRounds(true)
    try {
      const payload: any = { myRounds: myRoundsEdit }
      if (myRoundsEdit.includes(1)) {
        payload.organizerFee = parseAmount(feeInlineInput) ?? null
      }
      const res = await api.patch(`/hui/${hui.id}`, payload)
      onUpdate(res.data)
      setEditingMyRounds(false)
    } finally { setSavingMyRounds(false) }
  }

  async function handleDelete() {
    if (!confirm(`Xoá hụi "${hui.name}"?`)) return
    await api.delete(`/hui/${hui.id}`)
    onDelete(hui.id)
  }

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden ${isCompleted ? 'border-emerald-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{hui.name}</span>
              {slots > 1 && (
                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{slots} suất</span>
              )}
              {isCompleted
                ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Xong</span>
                : <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{hui.frequency === 'MONTHLY' ? 'Tháng' : 'Tuần'}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Giá gốc {fmt(hui.amount)}/suất · {hui.totalRounds} kỳ · Kỳ hốt {hui.myRounds.join(', ')}
            </p>
          </div>
          <div className="text-right shrink-0">
            {totalProfit > 0 && (
              <p className="text-xs font-semibold text-emerald-600">+{fmt(totalProfit)} lời</p>
            )}
            <p className="text-xs text-gray-400">{doneCount}/{hui.totalRounds} kỳ</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(doneCount / hui.totalRounds) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
            <span>Đã đóng: {fmt(totalPaid)}</span>
            {!isCompleted && nextPending && (
              <span className={new Date(nextPending.dueDate) <= today ? 'text-amber-500 font-medium' : ''}>
                Kỳ {nextPending.roundNo}: {fmtDateFull(nextPending.dueDate)}
                {new Date(nextPending.dueDate) <= today && ' ⚠️'}
              </span>
            )}
          </div>
        </div>

        {/* Collection rounds status */}
        <div className="mt-2 flex flex-wrap gap-1 items-center">
          {hui.myRounds.map(mr => {
            const mrd = hui.rounds.find(r => r.roundNo === mr)
            if (!mrd) return null
            return (
              <div key={mr} className={`text-xs px-2 py-1 rounded-lg inline-block ${
                mrd.isReceived ? 'bg-emerald-100 text-emerald-700'
                : new Date(mrd.dueDate) <= today ? 'bg-amber-100 text-amber-700'
                : 'bg-indigo-50 text-indigo-600'
              }`}>
                {mrd.isReceived ? '✅ Đã hốt' : '🎯 Kỳ hốt'} {mr} — {fmtDateFull(mrd.dueDate)}
              </div>
            )
          })}
          <button
            onClick={e => { e.stopPropagation(); setMyRoundsEdit(hui.myRounds); setFeeInlineInput(hui.organizerFee != null ? hui.organizerFee.toLocaleString('vi-VN') : ''); setEditingMyRounds(v => !v) }}
            className="text-[10px] text-gray-400 hover:text-indigo-500 px-1.5 py-0.5 rounded border border-dashed border-gray-200 hover:border-indigo-300"
          >
            {editingMyRounds ? 'Đóng' : '✏️ Sửa kỳ hốt'}
          </button>
        </div>

        {/* Inline myRounds editor */}
        {editingMyRounds && (
          <div className="mt-2 bg-indigo-50 rounded-xl px-3 py-2.5 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="text-[11px] text-indigo-700 font-medium">Chọn kỳ bạn hốt:</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: hui.totalRounds }, (_, i) => i + 1).map(n => {
                const selected = myRoundsEdit.includes(n)
                const roundDate = hui.rounds.find(r => r.roundNo === n)?.dueDate
                return (
                  <button key={n} type="button"
                    onClick={() => setMyRoundsEdit(prev =>
                      selected ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b)
                    )}
                    className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition min-w-[44px] ${
                      selected ? 'bg-indigo-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
                    }`}>
                    <span className="text-xs font-semibold leading-tight">K{n}</span>
                    {roundDate && (
                      <span className={`text-[9px] leading-tight ${selected ? 'text-indigo-100' : 'text-gray-400'}`}>
                        {fmtMonthYear(roundDate)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {myRoundsEdit.includes(1) && (
              <div className="border-t border-indigo-100 pt-2 space-y-1">
                <p className="text-[11px] text-orange-600 font-medium">Tiền công thảo hụi (kỳ 1):</p>
                <div className="flex flex-wrap gap-1 mb-1">
                  {['50k','100k','150k','200k','500k'].map(chip => (
                    <button key={chip} type="button"
                      onPointerDown={e => e.preventDefault()}
                      onClick={() => setFeeInlineInput(chip)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${feeInlineInput === chip ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'}`}>
                      {chip}
                    </button>
                  ))}
                  {feeInlineInput && (
                    <button type="button"
                      onPointerDown={e => e.preventDefault()}
                      onClick={() => setFeeInlineInput('')}
                      className="px-2 py-0.5 rounded-lg text-[11px] text-gray-400 border border-gray-200 hover:text-red-400">
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="Không có phí thảo"
                  value={feeInlineInput}
                  onChange={e => setFeeInlineInput(e.target.value)}
                  onBlur={() => { const v = parseAmount(feeInlineInput); if (v) setFeeInlineInput(v.toLocaleString('vi-VN')) }}
                  className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={saveMyRounds}
                disabled={savingMyRounds || myRoundsEdit.length === 0}
                className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {savingMyRounds ? 'Đang lưu…' : 'Lưu'}
              </button>
              <button onClick={() => setEditingMyRounds(false)} className="text-xs text-gray-400">Hủy</button>
            </div>
          </div>
        )}

        {/* Organizer fee row — chỉ khi hốt kỳ 1 */}
        {hui.myRounds.includes(1) && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
            {hui.organizerFee != null ? (
              <span className="text-[11px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                Phí thảo: {fmt(hui.organizerFee)}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">Chưa điền phí thảo</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); setFeeInput(hui.organizerFee != null ? hui.organizerFee.toLocaleString('vi-VN') : ''); setEditingFee(v => !v) }}
              className="text-[10px] text-gray-400 hover:text-orange-500 px-1.5 py-0.5 rounded border border-dashed border-gray-200 hover:border-orange-300"
            >
              {editingFee ? 'Đóng' : '✏️ Sửa'}
            </button>
          </div>
        )}

        {/* Organizer fee editor */}
        {editingFee && hui.myRounds.includes(1) && (
          <div className="mt-1.5 bg-orange-50 rounded-xl px-3 py-2.5 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="text-[11px] text-orange-700 font-medium">Tiền công thảo hụi (kỳ 1):</p>
            <div className="flex gap-2 flex-wrap">
              {['50k','100k','150k','200k','500k'].map(chip => (
                <button key={chip} type="button" onClick={() => setFeeInput(chip)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${feeInput === chip ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'}`}>
                  {chip}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                inputMode="text"
                placeholder="100k, 200k…"
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                onBlur={() => { const v = parseAmount(feeInput); if (v) setFeeInput(v.toLocaleString('vi-VN')) }}
                onKeyDown={e => e.key === 'Enter' && saveOrganizerFee()}
                autoFocus
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
              />
              {feeInput && parseAmount(feeInput) && (
                <span className="text-[10px] text-orange-500">
                  Hốt ~{fmt(hui.amount * hui.totalRounds - parseAmount(feeInput)!)}
                </span>
              )}
            </div>
            {feeError && <p className="text-xs text-red-500">{feeError}</p>}
            <div className="flex gap-2">
              <button onClick={saveOrganizerFee} className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg">Lưu</button>
              <button onClick={clearOrganizerFee} className="text-xs text-gray-400 hover:text-red-400">Xóa phí</button>
              <button onClick={() => setEditingFee(false)} className="text-xs text-gray-400 ml-auto">Hủy</button>
            </div>
          </div>
        )}

        {/* Wallet sync row */}
        <div className="mt-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {hui.walletId ? (
            <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">⚡ Đồng bộ ví</span>
          ) : (
            <span className="text-[11px] text-gray-400">Chưa liên kết ví</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setWalletIdEdit(hui.walletId ?? ''); setEditingWallet(v => !v) }}
            className="text-[10px] text-gray-400 hover:text-emerald-600 px-1.5 py-0.5 rounded border border-dashed border-gray-200 hover:border-emerald-300"
          >
            {editingWallet ? 'Đóng' : '✏️ Sửa'}
          </button>
        </div>

        {/* Wallet editor */}
        {editingWallet && (
          <div className="mt-1.5 bg-emerald-50 rounded-xl px-3 py-2.5 space-y-2" onClick={e => e.stopPropagation()}>
            <select value={walletIdEdit} onChange={e => setWalletIdEdit(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-300 bg-white">
              <option value="">— Không đồng bộ —</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.currency} ({w.currency})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={saveWallet} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg">Lưu</button>
              <button onClick={() => setEditingWallet(false)} className="text-xs text-gray-400">Hủy</button>
            </div>
          </div>
        )}
      </div>

      {/* Round list */}
      {expanded && (
        <div className="border-t border-gray-50">
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex gap-3 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Hụi sống (suất chưa hốt) — điền tiền thực đóng để tính lời</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Hụi chết (tất cả suất đã hốt) — đóng giá gốc</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {hui.rounds.map(r => {
              const isMyRound = hui.myRounds.includes(r.roundNo)
              // Tất cả suất đã hốt trước kỳ này
              const allDead = hui.myRounds.every(mr => mr < r.roundNo)
              const live = hui.myRounds.filter(mr => mr > r.roundNo).length
              const dead = hui.myRounds.filter(mr => mr < r.roundNo).length
              const isDone = r.isPaid || r.isReceived
              const isOverdue = !isDone && new Date(r.dueDate) <= today
              const pay = actualPay(r, hui)
              const gain = profit(r, hui)
              const isBidding = biddingRound === r.roundNo

              return (
                <div key={r.roundNo} className={`px-4 py-3 ${isMyRound ? 'bg-indigo-50/40' : allDead ? 'bg-gray-50/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    {isMyRound ? (
                      <button onClick={() => toggleRound(r.roundNo)} disabled={toggling === r.roundNo}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          r.isReceived ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-indigo-300 hover:border-indigo-500'
                        }`}>
                        {r.isReceived && <span className="text-[10px]">✓</span>}
                      </button>
                    ) : (
                      <button onClick={() => toggleRound(r.roundNo)} disabled={toggling === r.roundNo}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          r.isPaid ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isOverdue ? 'border-amber-400 hover:border-amber-500'
                          : 'border-gray-300 hover:border-emerald-400'
                        }`}>
                        {r.isPaid && <span className="text-[10px]">✓</span>}
                      </button>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          Kỳ {r.roundNo}
                        </span>
                        {isMyRound && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">Kỳ bạn hốt</span>}
                        {allDead && !isMyRound && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Hụi chết</span>}
                        {isOverdue && !isDone && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Quá hạn</span>}
                        {isDone && r.walletTransactionId && <span className="text-[10px] text-emerald-500">⚡</span>}
                      </div>

                      {/* Bid info */}
                      {!isMyRound && (
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {r.bidAmount ? (
                            <>
                              <span className="text-xs text-gray-500">
                                Đóng: <span className="font-medium text-indigo-600">{fmt(pay ?? 0)}</span>
                                {slots > 1 && live > 0 && (
                                  <span className="text-gray-400">
                                    {` (${live}×${fmt(r.bidAmount)}${dead > 0 ? ` + ${dead}×${fmt(hui.amount)}` : ''})`}
                                  </span>
                                )}
                                {r.ownerName && <span className="text-gray-400"> · {r.ownerName} hốt</span>}
                              </span>
                              {!allDead && gain > 0 && (
                                <span className="text-[10px] text-emerald-600 font-medium">+{fmt(gain)} lời</span>
                              )}
                              <button onClick={() => clearBid(r.roundNo)} className="text-[10px] text-gray-300 hover:text-red-400 ml-1">✕</button>
                            </>
                          ) : r.isPaid ? (
                            <span className="text-xs text-gray-500">
                              Giá gốc: <span className="font-medium">{fmt(pay ?? hui.amount * slots)}</span>
                              {slots > 1 && <span className="text-gray-400"> ({slots}×{fmt(hui.amount)})</span>}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{fmtDateFull(r.dueDate)} · Chưa điền tiền đóng</span>
                          )}
                        </div>
                      )}
                      {isMyRound && <span className="text-xs text-gray-400">{fmtDateFull(r.dueDate)}</span>}
                    </div>

                    {/* Amount & bid button */}
                    <div className="text-right shrink-0">
                      {isMyRound ? (
                        <div className="text-right">
                          <span className="text-sm font-bold text-indigo-600">Hốt tiền</span>
                          {hui.myRounds.includes(1) && r.roundNo === 1 && (
                            <p className="text-xs text-indigo-400 mt-0.5">
                              {hui.organizerFee != null
                                ? `~${fmt(hui.amount * hui.totalRounds - hui.organizerFee)}`
                                : `~${fmt(hui.amount * hui.totalRounds)}`}
                            </p>
                          )}
                          {r.roundNo !== 1 && (
                            <p className="text-xs text-indigo-400 mt-0.5">~{fmt(hui.amount * hui.totalRounds)}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className={`text-sm font-bold ${isDone ? 'text-gray-400' : allDead ? 'text-gray-600' : 'text-red-500'}`}>
                            -{fmt(pay ?? hui.amount * slots)}
                          </span>
                          {/* Show bid button only when there are live slots */}
                          {!isDone && live > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); setBiddingRound(r.roundNo); setBidInput(''); setOwnerInput(r.ownerName || '') }}
                              className="block text-[10px] text-indigo-400 hover:text-indigo-600 mt-0.5 ml-auto"
                            >
                              {r.bidAmount ? 'Sửa' : 'Điền tiền đóng'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bid input */}
                  {isBidding && (
                    <div className="mt-2 ml-9 bg-indigo-50 rounded-xl px-3 py-2.5 space-y-2">
                      {/* Quick chips */}
                      <div className="flex flex-wrap gap-1">
                        {getBidChips(hui.amount).map(chip => (
                          <button key={chip} type="button" onClick={() => setBidInput(chip)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                              bidInput === chip
                                ? 'bg-indigo-500 text-white'
                                : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100'
                            }`}>
                            {chip}
                          </button>
                        ))}
                      </div>
                      {/* Inputs row */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-0.5">
                          <input
                            type="text"
                            placeholder={slots > 1 ? `Tiền/suất sống (${live} suất)` : 'Tiền thực đóng (4tr8)'}
                            value={bidInput}
                            onChange={e => setBidInput(e.target.value)}
                            onBlur={() => {
                              const amt = parseAmount(bidInput)
                              if (amt && amt > 0) setBidInput(amt.toLocaleString('vi-VN'))
                            }}
                            onKeyDown={e => e.key === 'Enter' && saveBid(r.roundNo)}
                            autoFocus
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                          />
                          {bidInput && parseAmount(bidInput) && parseAmount(bidInput)! > 0 && (
                            <span className="text-[10px] text-indigo-400">
                              {slots > 1
                                ? `Tổng: ${fmt(live * parseAmount(bidInput)! + dead * hui.amount)}`
                                : fmt(parseAmount(bidInput)!)}
                            </span>
                          )}
                        </div>
                        <input
                          type="text" placeholder="Người hốt (tuỳ chọn)" value={ownerInput}
                          onChange={e => setOwnerInput(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                        />
                        <button onClick={() => saveBid(r.roundNo)} className="text-xs bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg">Lưu</button>
                        <button onClick={() => setBiddingRound(null)} className="text-xs text-gray-400">Hủy</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer summary */}
          <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="space-y-0.5">
                <p>Tổng thực đóng: <span className="font-medium text-red-500">{fmt(totalPaid)}</span></p>
                {totalProfit > 0 && <p>Đã lời: <span className="font-medium text-emerald-600">+{fmt(totalProfit)}</span></p>}
              </div>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600">Xoá hụi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
