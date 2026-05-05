import { useState } from 'react'
import api from '../../services/api'
import type { Hui, HuiRound } from '../../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => format(new Date(s), 'dd/MM/yyyy', { locale: vi })

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
      {huis.map(h => <HuiCard key={h.id} hui={h} expanded={expanded === h.id}
        onToggleExpand={() => setExpanded(prev => prev === h.id ? null : h.id)}
        onUpdate={onUpdate} onDelete={onDelete} />)}
    </div>
  )
}

function HuiCard({ hui, expanded, onToggleExpand, onUpdate, onDelete }: {
  hui: Hui
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (h: Hui) => void
  onDelete: (id: string) => void
}) {
  const [toggling, setToggling] = useState<number | null>(null)
  const today = new Date()

  const paidCount = hui.rounds.filter(r => r.isPaid || r.isReceived).length
  const myRoundData = hui.rounds.find(r => r.roundNo === hui.myRound)
  const nextUnpaid = hui.rounds.find(r => !r.isPaid && !r.isReceived)
  const isCompleted = paidCount === hui.totalRounds || hui.status === 'COMPLETED'

  async function toggleRound(roundNo: number) {
    setToggling(roundNo)
    try {
      await api.post(`/hui/${hui.id}/rounds/${roundNo}/toggle`)
      const res = await api.get('/hui')
      const updated = res.data.find((h: Hui) => h.id === hui.id)
      if (updated) onUpdate(updated)
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete() {
    if (!confirm(`Xoá hụi "${hui.name}"?`)) return
    await api.delete(`/hui/${hui.id}`)
    onDelete(hui.id)
  }

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${isCompleted ? 'border-emerald-200' : 'border-gray-100'}`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{hui.name}</span>
              {isCompleted
                ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Hoàn thành</span>
                : <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{hui.frequency === 'MONTHLY' ? 'Tháng' : 'Tuần'}</span>
              }
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Đóng {fmt(hui.amount)}/kỳ · Tổng {hui.totalRounds} kỳ · Kỳ của bạn: {hui.myRound}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-600">{fmt(hui.amount * hui.totalRounds)}</p>
            <p className="text-xs text-gray-400">khi hốt kỳ {hui.myRound}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{paidCount}/{hui.totalRounds} kỳ đã đóng</span>
            {!isCompleted && nextUnpaid && (
              <span className={new Date(nextUnpaid.dueDate) <= today ? 'text-amber-500 font-medium' : ''}>
                Kỳ {nextUnpaid.roundNo}: {fmtDate(nextUnpaid.dueDate)}
                {new Date(nextUnpaid.dueDate) <= today && ' ⚠️'}
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(paidCount / hui.totalRounds) * 100}%` }} />
          </div>
        </div>

        {/* My round status */}
        {myRoundData && (
          <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-block ${
            myRoundData.isReceived ? 'bg-emerald-100 text-emerald-700' :
            new Date(myRoundData.dueDate) <= today ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'
          }`}>
            {myRoundData.isReceived ? '✅ Đã hốt kỳ ' : '🎯 Kỳ bạn hốt: '}{hui.myRound} — {fmtDate(myRoundData.dueDate)}
          </div>
        )}
      </div>

      {/* Round list */}
      {expanded && (
        <div className="border-t border-gray-50">
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {hui.rounds.map(r => {
              const isMyRound = r.roundNo === hui.myRound
              const isDone = r.isPaid || r.isReceived
              const isOverdue = !isDone && new Date(r.dueDate) <= today
              return (
                <div key={r.roundNo} className={`flex items-center gap-3 px-4 py-2.5 ${isMyRound ? 'bg-indigo-50/50' : ''}`}>
                  <button
                    onClick={() => toggleRound(r.roundNo)}
                    disabled={toggling === r.roundNo}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isDone ? (isMyRound ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-emerald-500 border-emerald-500 text-white')
                             : isOverdue ? 'border-amber-400 hover:border-amber-500'
                             : 'border-gray-300 hover:border-emerald-400'
                    }`}
                  >
                    {isDone && <span className="text-[10px]">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        Kỳ {r.roundNo}
                      </span>
                      {isMyRound && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">Của bạn</span>}
                      {r.ownerName && !isMyRound && <span className="text-xs text-gray-400">{r.ownerName}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{fmtDate(r.dueDate)}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${isMyRound ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {isMyRound ? '+' : '-'}{fmt(hui.amount)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-gray-50 flex justify-between items-center">
            <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600 transition">Xoá hụi</button>
          </div>
        </div>
      )}
    </div>
  )
}
