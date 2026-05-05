import { useState } from 'react'
import api from '../../services/api'
import type { Hui, HuiRound } from '../../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => format(new Date(s), 'dd/MM', { locale: vi })

function parseAmt(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '')
  const m = t.match(/^([\d,.]+)(tr|triệu|m|k)?$/)
  if (!m) return null
  const base = parseFloat(m[1].replace(/,/g, '.'))
  if (isNaN(base)) return null
  const mul = m[2] === 'tr' || m[2] === 'triệu' || m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1
  return Math.round(base * mul)
}

// Số tiền mình thực đóng kỳ này
// - roundNo < myRound (hụi sống): bidAmount ?? baseAmount
// - roundNo === myRound: hốt hụi (không đóng)
// - roundNo > myRound (hụi chết): baseAmount luôn
function actualPay(r: HuiRound, hui: Hui): number | null {
  if (r.roundNo === hui.myRound) return null // hốt hụi
  if (r.roundNo < hui.myRound) return r.bidAmount ?? hui.amount // hụi sống
  return hui.amount // hụi chết — luôn giá gốc
}

// Lời so với giá gốc (chỉ khi hụi sống và có bid)
function profit(r: HuiRound, hui: Hui): number {
  if (r.roundNo >= hui.myRound || !r.bidAmount) return 0
  return hui.amount - r.bidAmount
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
  const today = new Date()

  // số kỳ đã xử lý (đã đóng hoặc đã hốt)
  const doneCount = hui.rounds.filter(r => r.isPaid || r.isReceived).length
  const myRoundData = hui.rounds.find(r => r.roundNo === hui.myRound)
  const nextPending = hui.rounds.find(r => !r.isPaid && !r.isReceived)
  const isCompleted = doneCount === hui.totalRounds || hui.status === 'COMPLETED'

  // Tổng lời đã thực hiện
  const totalProfit = hui.rounds
    .filter(r => (r.isPaid || r.isReceived) && r.roundNo < hui.myRound && r.bidAmount)
    .reduce((s, r) => s + (hui.amount - (r.bidAmount!)), 0)

  // Tổng đã thực đóng (excluding my round - that's income not expense)
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
    const amount = parseAmt(bidInput)
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
              {isCompleted
                ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Xong</span>
                : <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{hui.frequency === 'MONTHLY' ? 'Tháng' : 'Tuần'}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Giá gốc {fmt(hui.amount)} · {hui.totalRounds} kỳ · Hốt kỳ {hui.myRound}</p>
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
                Kỳ {nextPending.roundNo}: {fmtDate(nextPending.dueDate)}
                {new Date(nextPending.dueDate) <= today && ' ⚠️'}
              </span>
            )}
          </div>
        </div>

        {/* My round status */}
        {myRoundData && (
          <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-block ${
            myRoundData.isReceived ? 'bg-emerald-100 text-emerald-700'
            : new Date(myRoundData.dueDate) <= today ? 'bg-amber-100 text-amber-700'
            : 'bg-indigo-50 text-indigo-600'
          }`}>
            {myRoundData.isReceived ? '✅ Đã hốt' : '🎯 Hốt kỳ'} {hui.myRound} — {fmtDate(myRoundData.dueDate)}
          </div>
        )}
      </div>

      {/* Round list */}
      {expanded && (
        <div className="border-t border-gray-50">
          <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Hụi sống (chưa hốt) — điền tiền thực đóng để tính lời</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Hụi chết (đã hốt) — đóng giá gốc</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {hui.rounds.map(r => {
              const isMyRound = r.roundNo === hui.myRound
              const isHuiChet = r.roundNo > hui.myRound // đã hốt rồi
              const isDone = r.isPaid || r.isReceived
              const isOverdue = !isDone && new Date(r.dueDate) <= today
              const pay = actualPay(r, hui)
              const gain = profit(r, hui)
              const isBidding = biddingRound === r.roundNo

              return (
                <div key={r.roundNo} className={`px-4 py-3 ${isMyRound ? 'bg-indigo-50/40' : isHuiChet ? 'bg-gray-50/30' : ''}`}>
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
                        {isHuiChet && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Hụi chết</span>}
                        {isOverdue && !isDone && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Quá hạn</span>}
                      </div>

                      {/* Bid info */}
                      {!isMyRound && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {r.bidAmount ? (
                            <>
                              <span className="text-xs text-gray-500">
                                Đóng: <span className="font-medium text-indigo-600">{fmt(r.bidAmount)}</span>
                                {r.ownerName && <span className="text-gray-400"> · {r.ownerName} hốt</span>}
                              </span>
                              {!isHuiChet && gain > 0 && (
                                <span className="text-[10px] text-emerald-600 font-medium">+{fmt(gain)} lời</span>
                              )}
                              <button onClick={() => clearBid(r.roundNo)} className="text-[10px] text-gray-300 hover:text-red-400 ml-1">✕</button>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">{fmtDate(r.dueDate)} · Chưa điền tiền đóng</span>
                          )}
                        </div>
                      )}
                      {isMyRound && <span className="text-xs text-gray-400">{fmtDate(r.dueDate)}</span>}
                    </div>

                    {/* Amount & bid button */}
                    <div className="text-right shrink-0">
                      {isMyRound ? (
                        <div className="text-right">
                          <span className="text-sm font-bold text-indigo-600">Hốt tiền</span>
                          {hui.myRound === 1 && (
                            <p className="text-xs text-indigo-400 mt-0.5">
                              {hui.organizerFee != null
                                ? `~${fmt(hui.amount * hui.totalRounds - hui.organizerFee)}`
                                : `~${fmt(hui.amount * hui.totalRounds)}`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className={`text-sm font-bold ${isDone ? 'text-gray-400' : isHuiChet ? 'text-gray-600' : 'text-red-500'}`}>
                            -{fmt(pay ?? hui.amount)}
                          </span>
                          {!isDone && !isHuiChet && (
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
                    <div className="mt-2 ml-9 flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2">
                      <input
                        type="text" placeholder="Tiền thực đóng (4tr8)" value={bidInput}
                        onChange={e => setBidInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveBid(r.roundNo)}
                        autoFocus
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <input
                        type="text" placeholder="Người hốt (tuỳ chọn)" value={ownerInput}
                        onChange={e => setOwnerInput(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <button onClick={() => saveBid(r.roundNo)} className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-lg">Lưu</button>
                      <button onClick={() => setBiddingRound(null)} className="text-xs text-gray-400">Hủy</button>
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
