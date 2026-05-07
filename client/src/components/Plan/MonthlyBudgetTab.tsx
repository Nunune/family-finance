import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import { MonthlyBudget, MonthlyBudgetItem, MonthlyBudgetResponse, Category, RecipientLabel } from '../../types'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'

function fmtVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return (Math.round(n / 100_000) / 10) + 'tr'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return n.toString()
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return `Tháng ${mo}/${y}`
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

// ─── BudgetBar ────────────────────────────────────────────────────────────────

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const over = total > 0 && spent > total
  const warn = !over && pct >= 80
  const bar = over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-400'
  const txt = over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-emerald-600'
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">Đã dùng {fmtVND(spent)}</span>
        <span className={`font-semibold ${txt}`}>{total > 0 ? `${Math.round(pct)}%` : '—'}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      {total > 0 && (
        <p className="text-xs text-gray-400 mt-1 text-right">/ {fmtVND(total)}</p>
      )}
    </div>
  )
}

// ─── EditForm ─────────────────────────────────────────────────────────────────

type InputMode = 'amount' | 'pct'

interface EditItem {
  key: string
  categoryId?: string
  recipientLabelId?: string
  amount: string
  pct: string
  mode: InputMode
  label: string
  icon: string
  color?: string
}

interface EditFormProps {
  month: string
  budget: MonthlyBudget | null
  categories: Category[]
  recipients: RecipientLabel[]
  onSave: (budget: MonthlyBudget) => void
  onCancel: () => void
}

function EditForm({ month, budget, categories, recipients, onSave, onCancel }: EditFormProps) {
  const [totalStr, setTotalStr] = useState(budget ? String(budget.amount) : '')
  const [items, setItems] = useState<EditItem[]>(() => {
    const existing = budget?.items ?? []
    const catItems = categories
      .filter(c => c.type === 'EXPENSE' || c.type === 'BOTH')
      .map(c => {
        const found = existing.find(i => i.categoryId === c.id)
        return { key: `cat-${c.id}`, categoryId: c.id, amount: found ? String(found.amount) : '', pct: '', mode: 'amount' as InputMode, label: c.name, icon: c.icon, color: c.color }
      })
    const recItems = recipients.map(r => {
      const found = existing.find(i => i.recipientLabelId === r.id)
      return { key: `rec-${r.id}`, recipientLabelId: r.id, amount: found ? String(found.amount) : '', pct: '', mode: 'amount' as InputMode, label: r.name, icon: r.icon, color: r.color }
    })
    return [...catItems, ...recItems]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = parseAmount(totalStr) ?? 0

  function toggleMode(key: string) {
    setItems(prev => prev.map(item => {
      if (item.key !== key) return item
      if (item.mode === 'amount') {
        const amt = parseAmount(item.amount)
        const pct = amt && total > 0 ? String(Math.round(amt / total * 100)) : ''
        return { ...item, mode: 'pct', pct }
      } else {
        const pctVal = parseFloat(item.pct)
        const amt = !isNaN(pctVal) && total > 0 ? String(Math.round(total * pctVal / 100)) : ''
        return { ...item, mode: 'amount', amount: amt }
      }
    }))
  }

  function updateItem(key: string, patch: Partial<Pick<EditItem, 'amount' | 'pct'>>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i))
  }

  async function handleSave() {
    if (!total || total <= 0) { setError('Nhập ngân sách tổng'); return }
    setSaving(true); setError('')
    try {
      const activeItems = items
        .map(i => {
          const amount = i.mode === 'amount'
            ? parseAmount(i.amount)
            : (() => { const p = parseFloat(i.pct); return !isNaN(p) && p > 0 ? Math.round(total * p / 100) : null })()
          return { ...i, resolvedAmount: amount }
        })
        .filter(i => i.resolvedAmount !== null && i.resolvedAmount > 0)
        .map(i => ({ categoryId: i.categoryId || null, recipientLabelId: i.recipientLabelId || null, amount: i.resolvedAmount! }))
      const res = await api.put('/monthly-budgets', { month, amount: total, items: activeItems })
      onSave(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Lỗi lưu, thử lại')
    } finally {
      setSaving(false)
    }
  }

  const catItems = items.filter(i => i.categoryId)
  const recItems = items.filter(i => i.recipientLabelId)

  function renderItemRow(item: EditItem) {
    const pctVal = parseFloat(item.pct)
    const previewAmt = !isNaN(pctVal) && pctVal > 0 && total > 0 ? Math.round(total * pctVal / 100) : null

    return (
      <div key={item.key} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
        <span className="text-lg w-7 text-center shrink-0">{item.icon}</span>
        <span className="text-sm text-gray-600 w-24 truncate shrink-0">{item.label}</span>

        {/* Mode toggle */}
        <button
          type="button"
          onClick={() => toggleMode(item.key)}
          className="shrink-0 text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition font-medium min-w-[28px] text-center"
        >
          {item.mode === 'amount' ? '₫' : '%'}
        </button>

        {/* Input */}
        {item.mode === 'amount' ? (
          <div className="flex-1 min-w-0">
            <AmountInput value={item.amount} onChange={v => updateItem(item.key, { amount: v })} placeholder="Không giới hạn" chipSet={[]} />
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={item.pct}
              onChange={e => updateItem(item.key, { pct: e.target.value })}
              placeholder="0"
              className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <span className="text-sm text-gray-500 shrink-0">%</span>
            {previewAmt !== null && (
              <span className="text-xs text-gray-400 shrink-0">≈ {fmtShort(previewAmt)}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">💰 Ngân sách tổng tháng</p>
        <AmountInput value={totalStr} onChange={setTotalStr} />
        {total > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">= {fmtVND(total)}</p>
        )}
      </div>

      {catItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">📂 Theo danh mục</p>
          <p className="text-xs text-gray-400 mb-3">Nhấn ₫/% để đổi cách nhập</p>
          <div>{catItems.map(renderItemRow)}</div>
        </div>
      )}

      {recItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">👥 Theo thành viên</p>
          <p className="text-xs text-gray-400 mb-3">Nhấn ₫/% để đổi cách nhập</p>
          <div>{recItems.map(renderItemRow)}</div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}

      <div className="flex gap-2 pt-1 pb-4">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">Hủy</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Đang lưu…' : 'Lưu ngân sách'}
        </button>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MonthlyBudgetTab() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<MonthlyBudgetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [recipients, setRecipients] = useState<RecipientLabel[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/monthly-budgets?month=${month}`)
      setData(res.data)
    } catch { setData(null) } finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([api.get('/transactions/categories/all'), api.get('/recipients')])
      .then(([c, r]) => { setCategories(c.data); setRecipients(r.data) })
      .catch(() => {})
  }, [])

  const budget = data?.budget ?? null
  const totalSpent = data?.totalSpent ?? 0
  const categorySpent = data?.categorySpent ?? {}
  const recipientSpent = data?.recipientSpent ?? {}
  const catItems: MonthlyBudgetItem[] = budget?.items.filter(i => i.categoryId) ?? []
  const recItems: MonthlyBudgetItem[] = budget?.items.filter(i => i.recipientLabelId) ?? []

  if (editing) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</button>
          <h2 className="text-sm font-bold text-gray-800">Thiết lập ngân sách — {monthLabel(month)}</h2>
        </div>
        <EditForm
          month={month}
          budget={budget}
          categories={categories}
          recipients={recipients}
          onSave={saved => { setData(prev => prev ? { ...prev, budget: saved } : { budget: saved, totalSpent: 0, categorySpent: {}, recipientSpent: {} }); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(prevMonth(month))} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg text-lg">‹</button>
          <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center">{monthLabel(month)}</span>
          <button onClick={() => setMonth(nextMonth(month))} disabled={month >= currentMonth()} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 w-8 h-8 flex items-center justify-center rounded-lg text-lg">›</button>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition"
        >
          {budget ? '✏️ Sửa' : '+ Thiết lập'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-3xl">⏳</div>
      ) : !budget ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">📊</div>
          <p className="text-gray-500 text-sm">Chưa có ngân sách cho tháng này</p>
          <button onClick={() => setEditing(true)} className="mt-2 px-5 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl">
            Thiết lập ngân sách
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tổng ngân sách</p>
            <BudgetBar spent={totalSpent} total={budget.amount} />
            <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
              <span>Còn lại</span>
              <span className={budget.amount - totalSpent < 0 ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                {fmtVND(Math.max(0, budget.amount - totalSpent))}
              </span>
            </div>
          </div>

          {catItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">Theo danh mục</p>
              <div className="divide-y divide-gray-50">
                {catItems.map(item => {
                  const spent = categorySpent[item.categoryId!] ?? 0
                  const pct = item.amount > 0 ? (spent / item.amount) * 100 : 0
                  const budgetPct = budget.amount > 0 ? Math.round(item.amount / budget.amount * 100) : null
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{item.category?.icon}</span>
                        <span className="text-sm font-medium text-gray-700 flex-1">{item.category?.name}</span>
                        {budgetPct !== null && (
                          <span className="text-xs text-gray-400">{budgetPct}% NS</span>
                        )}
                        {spent > item.amount && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Vượt mức</span>}
                        {!( spent > item.amount) && pct >= 80 && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Gần đầy</span>}
                      </div>
                      <BudgetBar spent={spent} total={item.amount} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {recItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">Theo thành viên</p>
              <div className="divide-y divide-gray-50">
                {recItems.map(item => {
                  const spent = recipientSpent[item.recipientLabelId!] ?? 0
                  const pct = item.amount > 0 ? (spent / item.amount) * 100 : 0
                  const budgetPct = budget.amount > 0 ? Math.round(item.amount / budget.amount * 100) : null
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: item.recipientLabel?.color ?? '#6B7280' }}>
                          {item.recipientLabel?.icon} {item.recipientLabel?.name}
                        </span>
                        <span className="flex-1" />
                        {budgetPct !== null && <span className="text-xs text-gray-400">{budgetPct}% NS</span>}
                        {spent > item.amount && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Vượt mức</span>}
                        {!(spent > item.amount) && pct >= 80 && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Gần đầy</span>}
                      </div>
                      <BudgetBar spent={spent} total={item.amount} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {catItems.length === 0 && recItems.length === 0 && (
            <p className="text-xs text-center text-gray-400 py-2">Chưa có ngân sách chi tiết — nhấn Sửa để thêm</p>
          )}
        </>
      )}
    </div>
  )
}
