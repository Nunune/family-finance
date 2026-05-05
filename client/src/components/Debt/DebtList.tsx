import { useState, useMemo } from 'react'
import { Debt } from '../../types'
import api from '../../services/api'
import DebtPaymentForm from './DebtPaymentForm'

interface Props {
  debts: Debt[]
  userId: string
  onUpdate: (debt: Debt) => void
  onDelete: (id: string) => void
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

function progress(debt: Debt) {
  const paid = debt.originalAmount - debt.remainingAmount
  const pct = Math.round((paid / debt.originalAmount) * 100)
  return { paid, pct }
}

function scopeLabel(scope: string) {
  if (scope === 'PERSONAL') return { label: 'Cá nhân', cls: 'bg-blue-50 text-blue-600' }
  if (scope === 'SHARED') return { label: 'Quỹ chung', cls: 'bg-purple-50 text-purple-600' }
  return { label: 'Nội bộ GĐ', cls: 'bg-amber-50 text-amber-600' }
}

interface EditState {
  id: string
  title: string
  counterparty: string
  note: string
  dueDate: string
}

export default function DebtList({ debts, userId, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [search, setSearch] = useState('')
  const [hidePaid, setHidePaid] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const hasFilter = search.trim() || dateFrom || dateTo

  const filtered = useMemo(() => {
    return debts.filter(d => {
      if (hidePaid && d.remainingAmount <= 0) return false
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        if (!d.title.toLowerCase().includes(q) && !d.counterparty.toLowerCase().includes(q)) return false
      }
      if (dateFrom && new Date(d.createdAt) < new Date(dateFrom)) return false
      if (dateTo) {
        const to = new Date(dateTo)
        to.setUTCHours(23, 59, 59, 999)
        if (new Date(d.createdAt) > to) return false
      }
      return true
    })
  }, [debts, hidePaid, search, dateFrom, dateTo])

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  function startEdit(debt: Debt) {
    setEditState({
      id: debt.id,
      title: debt.title,
      counterparty: debt.counterparty,
      note: debt.note || '',
      dueDate: debt.dueDate ? new Date(debt.dueDate).toISOString().slice(0, 10) : '',
    })
    setEditError('')
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editState) return
    setEditSaving(true)
    setEditError('')
    try {
      const { data } = await api.put(`/debts/${editState.id}`, {
        title: editState.title,
        counterparty: editState.counterparty,
        note: editState.note || undefined,
        dueDate: editState.dueDate || undefined,
      })
      onUpdate(data)
      setEditState(null)
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Lỗi khi lưu')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá khoản nợ này?')) return
    setDeleting(id)
    try {
      await api.delete(`/debts/${id}`)
      onDelete(id)
    } finally {
      setDeleting(null)
    }
  }

  async function handleDeletePayment(debtId: string, paymentId: string, amount: number) {
    if (!confirm('Xoá lịch sử thanh toán này?')) return
    await api.delete(`/debts/${debtId}/payments/${paymentId}`)
    const debt = debts.find(d => d.id === debtId)
    if (debt) {
      onUpdate({
        ...debt,
        remainingAmount: debt.remainingAmount + amount,
        payments: debt.payments?.filter(p => p.id !== paymentId),
      })
    }
  }

  if (debts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-sm">Chưa có khoản nợ nào</p>
        <p className="text-xs mt-1 text-gray-300">Nhấn "+ Thêm nợ" để bắt đầu</p>
      </div>
    )
  }

  const borrowed = filtered.filter(d => d.type === 'BORROWED')
  const lent = filtered.filter(d => d.type === 'LENT')

  function renderGroup(items: Debt[], label: string, colorClass: string) {
    if (items.length === 0) return null
    return (
      <div className="space-y-2">
        <h3 className={`text-xs font-semibold uppercase tracking-wide px-1 ${colorClass}`}>{label}</h3>
        {items.map(debt => {
          const { paid, pct } = progress(debt)
          const { label: scopeLbl, cls: scopeCls } = scopeLabel(debt.scope)
          const isOwner = debt.ownerId === userId
          const isDone = debt.remainingAmount <= 0
          const isOpen = expanded === debt.id
          const overdue = debt.dueDate && !isDone && new Date(debt.dueDate) < new Date()

          return (
            <div key={debt.id} className={`bg-white rounded-2xl border transition ${isDone ? 'opacity-60 border-gray-100' : overdue ? 'border-red-200' : 'border-gray-100'} shadow-sm`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{debt.title}</span>
                      {isDone && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Đã xong</span>}
                      {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Quá hạn</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${scopeCls}`}>{scopeLbl}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{debt.counterparty}</p>
                    {debt.dueDate && (
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                        Hạn: {new Date(debt.dueDate).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                    {debt.note && <p className="text-xs text-gray-400 mt-0.5 italic">{debt.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-800">{fmt(debt.remainingAmount)} ₫</p>
                    <p className="text-xs text-gray-400">/ {fmt(debt.originalAmount)} ₫</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Đã trả: {fmt(paid)} ₫</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {!isDone && (
                    <button
                      onClick={() => setPayingDebtId(debt.id)}
                      className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition font-medium">
                      + Ghi nhận thanh toán
                    </button>
                  )}
                  {(debt.payments?.length ?? 0) > 0 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : debt.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 transition">
                      {isOpen ? 'Ẩn lịch sử' : `Lịch sử (${debt.payments?.length})`}
                    </button>
                  )}
                  {isOwner && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => startEdit(debt)}
                        className="text-xs text-gray-400 hover:text-emerald-600 transition">
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(debt.id)}
                        disabled={deleting === debt.id}
                        className="text-xs text-gray-300 hover:text-red-400 transition">
                        Xoá
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isOpen && (debt.payments?.length ?? 0) > 0 && (
                <div className="border-t border-gray-50 px-4 pb-3 pt-2 space-y-1.5">
                  {debt.payments!.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs text-gray-500">
                      <span>{new Date(p.date).toLocaleDateString('vi-VN')} · {p.paidBy?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-medium">{fmt(p.amount)} ₫</span>
                        {(isOwner || p.paidByUserId === userId) && (
                          <button onClick={() => handleDeletePayment(debt.id, p.id, p.amount)}
                            className="text-gray-200 hover:text-red-400 transition">✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, đối tác..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <button
            onClick={() => setHidePaid(v => !v)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition ${
              hidePaid ? 'bg-emerald-500 text-white border-emerald-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {hidePaid ? '✓ Ẩn đã xong' : 'Ẩn đã xong'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          <span className="text-gray-300 text-xs">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          {hasFilter && (
            <button onClick={clearFilters} className="shrink-0 text-xs text-gray-400 hover:text-red-400 transition px-1">✕</button>
          )}
        </div>
        {(filtered.length !== debts.length || hidePaid) && (
          <p className="text-xs text-gray-400">Hiển thị {filtered.length} / {debts.length} khoản</p>
        )}
      </div>

      <div className="space-y-5">
        {borrowed.length === 0 && lent.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm">Không tìm thấy khoản nào phù hợp</p>
          </div>
        ) : (
          <>
            {renderGroup(borrowed, 'Tôi đang vay', 'text-red-400')}
            {renderGroup(lent, 'Tôi đã cho vay', 'text-green-600')}
          </>
        )}
      </div>

      {payingDebtId && (() => {
        const debt = debts.find(d => d.id === payingDebtId)!
        return (
          <DebtPaymentForm
            debtId={payingDebtId}
            remainingAmount={debt.remainingAmount}
            onSave={payment => {
              onUpdate({
                ...debt,
                remainingAmount: Math.max(0, debt.remainingAmount - payment.amount),
                payments: [payment, ...(debt.payments ?? [])],
              })
              setPayingDebtId(null)
            }}
            onClose={() => setPayingDebtId(null)}
          />
        )
      })()}

      {/* Edit debt modal */}
      {editState && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-3">
            <h2 className="text-base font-bold text-gray-800">Sửa khoản nợ</h2>
            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tiêu đề</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  value={editState.title}
                  onChange={e => setEditState(s => s && ({ ...s, title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Người / tổ chức</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  value={editState.counterparty}
                  onChange={e => setEditState(s => s && ({ ...s, counterparty: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Hạn trả</label>
                  <input type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    value={editState.dueDate}
                    onChange={e => setEditState(s => s && ({ ...s, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="Tuỳ chọn"
                    value={editState.note}
                    onChange={e => setEditState(s => s && ({ ...s, note: e.target.value }))}
                  />
                </div>
              </div>
              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditState(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
                  Huỷ
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
                  {editSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
