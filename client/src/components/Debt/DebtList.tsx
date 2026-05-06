import { useState, useMemo, useEffect } from 'react'
import { Debt } from '../../types'
import api from '../../services/api'
import DebtPaymentForm from './DebtPaymentForm'
import AmountInput from '../shared/AmountInput'
import { parseAmount, fmtVND } from '../../utils/amountParser'

interface Props {
  debts: Debt[]
  userId: string
  onUpdate: (debt: Debt) => void
  onDelete: (id: string) => void
  onBulkUpdate?: (debts: Debt[]) => void
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

function computeDistribution(selectedDebts: Debt[], total: number) {
  let leftover = total
  return selectedDebts.map(debt => {
    if (leftover <= 0) return { debt, pay: 0 }
    const pay = Math.min(debt.remainingAmount, leftover)
    leftover -= pay
    return { debt, pay }
  })
}

export default function DebtList({ debts, userId, onUpdate, onDelete, onBulkUpdate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [hidePaid, setHidePaid] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250)
    return () => clearTimeout(t)
  }, [searchInput])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Bulk pay state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkDate, setBulkDate] = useState('')
  const [bulkNote, setBulkNote] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const hasFilter = searchInput.trim() || dateFrom || dateTo

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

  const unpaidFiltered = useMemo(() => filtered.filter(d => d.remainingAmount > 0), [filtered])

  function clearFilters() {
    setSearchInput('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  function toggleBulkMode() {
    setBulkMode(v => !v)
    setSelectedIds([])
    setBulkAmount('')
    setBulkDate('')
    setBulkNote('')
    setBulkError('')
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function selectAll() {
    setSelectedIds(unpaidFiltered.map(d => d.id))
  }

  const parsedBulk = parseAmount(bulkAmount)
  const bulkValid = parsedBulk !== null && parsedBulk > 0

  const selectedDebts = selectedIds
    .map(id => debts.find(d => d.id === id))
    .filter(Boolean) as Debt[]

  const distribution = bulkValid && selectedDebts.length > 0
    ? computeDistribution(selectedDebts, parsedBulk!)
    : []

  async function handleBulkPay() {
    if (!bulkValid || selectedIds.length === 0) return
    setBulkLoading(true)
    setBulkError('')
    try {
      const { data } = await api.post('/debts/bulk-pay', {
        debtIds: selectedIds,
        totalAmount: parsedBulk,
        date: bulkDate || undefined,
        note: bulkNote || undefined,
      })
      if (onBulkUpdate) {
        onBulkUpdate(data.updatedDebts)
      } else {
        for (const d of data.updatedDebts) onUpdate(d)
      }
      setBulkMode(false)
      setSelectedIds([])
      setBulkAmount('')
      setBulkDate('')
      setBulkNote('')
    } catch (err: any) {
      setBulkError(err.response?.data?.error || 'Lỗi khi thanh toán')
    } finally {
      setBulkLoading(false)
    }
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
          const isSelected = selectedIds.includes(debt.id)

          return (
            <div key={debt.id}
              className={`bg-white rounded-2xl border transition ${
                bulkMode && !isDone && isSelected ? 'border-emerald-400 ring-1 ring-emerald-300' :
                isDone ? 'opacity-60 border-gray-100' :
                overdue ? 'border-red-200' : 'border-gray-100'
              } shadow-sm`}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {bulkMode && !isDone && (
                    <button
                      onClick={() => toggleSelect(debt.id)}
                      className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <span className="text-[10px] leading-none">✓</span>}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">{debt.title}</span>
                          {isDone && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Đã xong</span>}
                          {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Quá hạn</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${scopeCls}`}>{scopeLbl}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{debt.counterparty}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ngày vay: {new Date(debt.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                        {debt.dueDate && (
                          <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                            Đến hạn: {new Date(debt.dueDate).toLocaleDateString('vi-VN')}
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

                    {!bulkMode && (
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
                    )}

                    {bulkMode && !isDone && isSelected && bulkValid && distribution.length > 0 && (() => {
                      const entry = distribution.find(e => e.debt.id === debt.id)
                      if (!entry || entry.pay === 0) return null
                      return (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            Trả: {fmtVND(entry.pay)}
                          </span>
                          {entry.pay >= debt.remainingAmount && (
                            <span className="text-[10px] text-white bg-emerald-500 px-2 py-0.5 rounded-full font-medium">Tất toán ✓</span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {!bulkMode && isOpen && (debt.payments?.length ?? 0) > 0 && (
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
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
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
          {unpaidFiltered.length > 1 && (
            <button
              onClick={toggleBulkMode}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                bulkMode ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {bulkMode ? '✕ Huỷ' : 'Trả gộp'}
            </button>
          )}
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
        {bulkMode && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-blue-600 font-medium">
              {selectedIds.length > 0 ? `Đã chọn ${selectedIds.length} khoản` : 'Chọn khoản cần trả'}
            </span>
            <button onClick={selectAll} className="text-xs text-blue-500 hover:text-blue-700 transition">
              Chọn tất cả
            </button>
          </div>
        )}
        {(filtered.length !== debts.length || hidePaid) && (
          <p className="text-xs text-gray-400">Hiển thị {filtered.length} / {debts.length} khoản</p>
        )}
      </div>

      <div className="space-y-5" style={{ paddingBottom: bulkMode ? '280px' : undefined }}>
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

      {/* Bulk pay bottom sheet */}
      {bulkMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50 safe-area-bottom">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Trả gộp nhiều khoản</p>
              {selectedIds.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedIds.length} khoản
                </span>
              )}
            </div>

            <AmountInput
              value={bulkAmount}
              onChange={setBulkAmount}
              placeholder="Tổng số tiền muốn trả (vd: 5tr, 500k)"
            />

            <div className="flex gap-2">
              <input
                type="date"
                value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <input
                type="text"
                value={bulkNote}
                onChange={e => setBulkNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            {distribution.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
                {distribution.map(({ debt, pay }) => (
                  <div key={debt.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate max-w-[55%]">{debt.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pay > 0 ? (
                        <>
                          <span className="text-emerald-600 font-medium">{fmtVND(pay)}</span>
                          {pay >= debt.remainingAmount && (
                            <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Xong</span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300">Không đủ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}

            <button
              onClick={handleBulkPay}
              disabled={!bulkValid || selectedIds.length === 0 || bulkLoading}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-40 transition hover:bg-emerald-600 active:bg-emerald-700"
            >
              {bulkLoading ? 'Đang xử lý...' : `Xác nhận trả${bulkValid ? ` ${fmtVND(parsedBulk!)}` : ''}`}
            </button>
          </div>
        </div>
      )}

      {!bulkMode && payingDebtId && (() => {
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
