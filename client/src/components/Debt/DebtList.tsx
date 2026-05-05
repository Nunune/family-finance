import { useState } from 'react'
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

export default function DebtList({ debts, userId, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

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
    // Optimistically update
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
      </div>
    )
  }

  const borrowed = debts.filter(d => d.type === 'BORROWED')
  const lent = debts.filter(d => d.type === 'LENT')

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

                <div className="flex items-center gap-2 mt-3">
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
                    <button
                      onClick={() => handleDelete(debt.id)}
                      disabled={deleting === debt.id}
                      className="ml-auto text-xs text-gray-300 hover:text-red-400 transition">
                      Xoá
                    </button>
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
      <div className="space-y-5">
        {renderGroup(borrowed, 'Tôi đang vay', 'text-red-400')}
        {renderGroup(lent, 'Tôi đã cho vay', 'text-green-600')}
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
    </>
  )
}
