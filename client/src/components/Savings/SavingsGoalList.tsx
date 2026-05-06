import { useState } from 'react'
import { SavingsGoal, SavingsContribution, SavingsWithdrawalRequest } from '../../types'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'tr'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(Math.round(n))
}

function computeSchedule(goal: SavingsGoal) {
  const now = new Date()
  const target = new Date(goal.targetDate)
  const remaining = goal.targetAmount - goal.savedAmount
  if (remaining <= 0) return []

  // Collect months from next month until targetDate's month (inclusive)
  const months: { date: Date; contribution: number; cumulative: number }[] = []
  let cur = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const targetMonth = new Date(target.getFullYear(), target.getMonth(), 1)

  while (cur <= targetMonth) {
    months.push({ date: new Date(cur), contribution: 0, cumulative: 0 })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  if (months.length === 0) return []

  const monthly = Math.ceil(remaining / months.length)
  let cum = goal.savedAmount
  months.forEach((m, i) => {
    const contrib = i < months.length - 1 ? monthly : Math.max(0, goal.targetAmount - cum)
    m.contribution = contrib
    cum += contrib
    m.cumulative = cum
  })

  return months
}

function WithdrawalRequestCard({
  goalId, request, onUpdate,
}: {
  goalId: string
  request: SavingsWithdrawalRequest
  onUpdate: () => void
}) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const isRequester = request.requestedById === user?.id
  const myApproval = request.approvals.find(a => a.userId === user?.id)

  async function respond(approved: boolean) {
    setLoading(true)
    try {
      await api.post(`/savings/${goalId}/withdrawal-requests/${request.id}/respond`, { approved })
      onUpdate()
    } finally { setLoading(false) }
  }

  async function cancel() {
    if (!window.confirm('Huỷ yêu cầu rút quỹ này?')) return
    setLoading(true)
    try {
      await api.delete(`/savings/${goalId}/withdrawal-requests/${request.id}`)
      onUpdate()
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-amber-800">
            🔔 Yêu cầu rút quỹ từ {request.requestedBy.name.split(' ').pop()}
          </p>
          <p className="text-sm font-bold text-amber-900 mt-0.5">{fmt(request.amount)}</p>
          {request.note && <p className="text-xs text-amber-700 mt-0.5">"{request.note}"</p>}
        </div>
        <span className="text-xs text-amber-500 shrink-0">
          {new Date(request.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      {/* Approvals */}
      {request.approvals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {request.approvals.map(a => (
            <span key={a.id} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              ✓ {a.user.name.split(' ').pop()}
            </span>
          ))}
        </div>
      )}

      {isRequester ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-600">
            Đang chờ {request.approvals.length} / {/* approvals so far */}
            thành viên duyệt…
          </p>
          <button onClick={cancel} disabled={loading}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">
            Huỷ yêu cầu
          </button>
        </div>
      ) : myApproval ? (
        <p className="text-xs text-emerald-600">✓ Bạn đã duyệt</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => respond(true)} disabled={loading}
            className="flex-1 py-1.5 bg-emerald-500 text-white text-xs font-medium rounded-lg disabled:opacity-50">
            ✓ Duyệt
          </button>
          <button onClick={() => respond(false)} disabled={loading}
            className="flex-1 py-1.5 bg-red-100 text-red-600 text-xs font-medium rounded-lg disabled:opacity-50">
            ✕ Từ chối
          </button>
        </div>
      )}
    </div>
  )
}

function ContributionEntryForm({ goalId, onDone }: { goalId: string; onDone: (c: SavingsContribution) => void }) {
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const amt = parseAmount(amount) ?? 0
    if (!amt || amt <= 0) { setError('Nhập số tiền'); return }
    setError(''); setLoading(true)
    try {
      const res = await api.post(`/savings/${goalId}/contributions`, { amount: amt, type, note, date })
      onDone(res.data)   // may be { withdrawalRequest } or a contribution
      setAmount(''); setNote('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi')
    } finally { setLoading(false) }
  }

  return (
    <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setType('DEPOSIT')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${type === 'DEPOSIT' ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          + Đóng quỹ
        </button>
        <button onClick={() => setType('WITHDRAWAL')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${type === 'WITHDRAWAL' ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          − Rút quỹ
        </button>
      </div>
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <AmountInput value={amount} onChange={setAmount} />
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 shrink-0" />
      </div>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button onClick={submit} disabled={loading}
        className="w-full py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-60">
        {loading ? '...' : 'Xác nhận'}
      </button>
    </div>
  )
}

interface Props {
  goals: SavingsGoal[]
  onUpdate: (g: SavingsGoal) => void
  onDelete: (id: string) => void
  onEdit: (g: SavingsGoal) => void
}

export default function SavingsGoalList({ goals, onUpdate, onDelete, onEdit }: Props) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showContribForm, setShowContribForm] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  if (goals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-2">🎯</div>
        <p className="text-sm">Chưa có quỹ tiết kiệm nào</p>
        <p className="text-xs mt-1">Tạo quỹ để bắt đầu lập kế hoạch</p>
      </div>
    )
  }

  async function handleDeleteContrib(goalId: string, contribId: string) {
    setDeleting(contribId)
    try {
      await api.delete(`/savings/${goalId}/contributions/${contribId}`)
      const res = await api.get('/savings')
      const updated = res.data.find((g: SavingsGoal) => g.id === goalId)
      if (updated) onUpdate(updated)
    } finally { setDeleting(null) }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!window.confirm('Xoá quỹ này? Toàn bộ lịch sử đóng quỹ sẽ bị xoá.')) return
    try {
      await api.delete(`/savings/${goalId}`)
      onDelete(goalId)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Không thể xoá quỹ')
    }
  }

  return (
    <div className="space-y-4">
      {goals.map(goal => {
        const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0
        const target = new Date(goal.targetDate)
        const now = new Date()
        const msLeft = target.getTime() - now.getTime()
        const daysLeft = Math.ceil(msLeft / 86_400_000)
        const monthsLeft = Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth())
        const remaining = goal.targetAmount - goal.savedAmount
        const monthlyNeeded = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining
        const isExpanded = expanded === goal.id
        const schedule = computeSchedule(goal)

        const totalDeposit = goal.contributions.filter(c => c.type === 'DEPOSIT').reduce((s, c) => s + c.amount, 0)
        const totalWithdraw = goal.contributions.filter(c => c.type === 'WITHDRAWAL').reduce((s, c) => s + c.amount, 0)

        const isOverdue = daysLeft < 0 && !goal.isCompleted
        const isNearDeadline = daysLeft >= 0 && daysLeft <= 30 && !goal.isCompleted
        const canEdit = goal.ownerId === user?.id

        return (
          <div key={goal.id} className={`bg-white rounded-2xl border ${goal.isCompleted ? 'border-emerald-200' : isOverdue ? 'border-red-200' : 'border-gray-100'} shadow-sm overflow-hidden`}>
            {/* Header */}
            <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : goal.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-2xl">{goal.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 text-sm">{goal.name}</h3>
                      {goal.isShared && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">👨‍👩‍👧 Gia đình</span>}
                      {goal.isCompleted && <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">✓ Hoàn thành</span>}
                      {isOverdue && <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">Quá hạn</span>}
                      {isNearDeadline && <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Còn {daysLeft} ngày</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Mục tiêu: {fmt(goal.targetAmount)} · {target.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}</p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-700">{fmt(goal.savedAmount)}</span>
                  <span className="text-gray-400">{pct.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${goal.isCompleted ? 'bg-emerald-500' : pct >= 75 ? 'bg-teal-500' : pct >= 40 ? 'bg-blue-400' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              {!goal.isCompleted && remaining > 0 && (
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span>Còn thiếu: <strong className="text-gray-700">{fmtShort(remaining)}</strong></span>
                  {monthsLeft > 0 && <span>·</span>}
                  {monthsLeft > 0 && <span>Cần ~<strong className="text-emerald-600">{fmtShort(monthlyNeeded)}/tháng</strong></span>}
                </div>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-50 px-4 pb-4 space-y-4">
                {/* Thu / Chi / Số dư */}
                <div className="grid grid-cols-3 gap-2 pt-3">
                  <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-emerald-600 mb-0.5">Tổng đóng</p>
                    <p className="text-sm font-bold text-emerald-700">{fmtShort(totalDeposit)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-red-500 mb-0.5">Tổng rút</p>
                    <p className="text-sm font-bold text-red-600">{fmtShort(totalWithdraw)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-blue-500 mb-0.5">Số dư quỹ</p>
                    <p className="text-sm font-bold text-blue-700">{fmtShort(goal.savedAmount)}</p>
                  </div>
                </div>

                {/* Schedule toggle */}
                {schedule.length > 0 && (
                  <div>
                    <button onClick={() => setShowSchedule(showSchedule === goal.id ? null : goal.id)}
                      className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      📅 {showSchedule === goal.id ? 'Ẩn' : 'Xem'} lịch trình đóng quỹ
                    </button>

                    {showSchedule === goal.id && (
                      <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-1.5 max-h-52 overflow-y-auto">
                        {schedule.map((row, i) => {
                          const isLast = i === schedule.length - 1
                          return (
                            <div key={i} className={`flex items-center justify-between text-xs py-1 ${isLast ? 'border-t border-dashed border-emerald-200 pt-2' : ''}`}>
                              <span className="text-gray-600 font-medium">
                                T{row.date.getMonth() + 1}/{row.date.getFullYear()}
                              </span>
                              <span className="text-emerald-600">+ {fmtShort(row.contribution)}</span>
                              <span className={`font-semibold ${row.cumulative >= goal.targetAmount ? 'text-emerald-600' : 'text-gray-700'}`}>
                                = {fmtShort(row.cumulative)}
                                {row.cumulative >= goal.targetAmount && ' ✓'}
                              </span>
                            </div>
                          )
                        })}
                        <p className="text-xs text-gray-400 text-center pt-1">
                          Mỗi tháng ~{fmtShort(schedule[0]?.contribution ?? 0)} · {schedule.length} tháng
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contribution history */}
                {goal.contributions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1.5">Lịch sử</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {goal.contributions.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs py-1">
                          <div className="flex items-center gap-1.5">
                            <span>{c.type === 'DEPOSIT' ? '↑' : '↓'}</span>
                            <span className={c.type === 'DEPOSIT' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                              {c.type === 'DEPOSIT' ? '+' : '-'}{fmtShort(c.amount)}
                            </span>
                            {c.note && <span className="text-gray-400">· {c.note}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">
                              {new Date(c.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                              {c.user && ` · ${c.user.name.split(' ').pop()}`}
                            </span>
                            {(c.userId === user?.id || goal.ownerId === user?.id) && (
                              <button onClick={() => handleDeleteContrib(goal.id, c.id)}
                                disabled={deleting === c.id}
                                className="text-gray-300 hover:text-red-400 transition text-xs">✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending withdrawal requests */}
                {goal.withdrawalRequests.length > 0 && (
                  <div className="space-y-2">
                    {goal.withdrawalRequests.map(r => (
                      <WithdrawalRequestCard
                        key={r.id}
                        goalId={goal.id}
                        request={r}
                        onUpdate={async () => {
                          const res = await api.get('/savings')
                          const updated = res.data.find((g: SavingsGoal) => g.id === goal.id)
                          if (updated) onUpdate(updated)
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Contribution form */}
                {showContribForm === goal.id ? (
                  <ContributionEntryForm
                    goalId={goal.id}
                    onDone={async () => {
                      setShowContribForm(null)
                      const res = await api.get('/savings')
                      const updated = res.data.find((g: SavingsGoal) => g.id === goal.id)
                      if (updated) onUpdate(updated)
                    }}
                  />
                ) : (
                  <button onClick={() => setShowContribForm(goal.id)}
                    className="w-full py-2 border border-dashed border-emerald-300 text-emerald-600 text-sm rounded-xl hover:bg-emerald-50 transition">
                    + Đóng / Rút quỹ
                  </button>
                )}

                {/* Actions */}
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => onEdit(goal)}
                      className="flex-1 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition">
                      ✏ Sửa
                    </button>
                    <button onClick={() => handleDeleteGoal(goal.id)}
                      className="flex-1 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition">
                      🗑 Xoá
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
