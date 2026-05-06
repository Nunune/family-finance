import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { MonthlyBudget, MonthlyBudgetItem, MonthlyBudgetResponse, Category, RecipientLabel } from '../types'
import { parseAmount } from '../utils/amountParser'
import AmountInput from '../components/shared/AmountInput'

function fmtVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return `Tháng ${m}/${y}`
}

function prevMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

interface BudgetBarProps {
  spent: number
  total: number
  label?: string
}

function BudgetBar({ spent, total, label }: BudgetBarProps) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
  const over = total > 0 && spent > total
  const warn = total > 0 && !over && pct >= 80

  const barColor = over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-400'
  const textColor = over ? 'text-red-600' : warn ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="w-full">
      <div className="flex justify-between items-center text-xs mb-1">
        {label && <span className="text-gray-500">{label}</span>}
        <span className={`ml-auto font-semibold ${textColor}`}>
          {total > 0 ? `${Math.round(pct)}%` : '—'}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1 text-gray-400">
        <span>Đã dùng {fmtVND(spent)}</span>
        {total > 0 && <span>/ {fmtVND(total)}</span>}
      </div>
    </div>
  )
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface EditItem {
  key: string
  categoryId?: string
  recipientLabelId?: string
  amount: string
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
        return {
          key: `cat-${c.id}`,
          categoryId: c.id,
          amount: found ? String(found.amount) : '',
          label: c.name,
          icon: c.icon,
          color: c.color,
        }
      })
    const recItems = recipients.map(r => {
      const found = existing.find(i => i.recipientLabelId === r.id)
      return {
        key: `rec-${r.id}`,
        recipientLabelId: r.id,
        amount: found ? String(found.amount) : '',
        label: r.name,
        icon: r.icon,
        color: r.color,
      }
    })
    return [...catItems, ...recItems]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateItem(key: string, amount: string) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, amount } : i))
  }

  async function handleSave() {
    const total = parseAmount(totalStr)
    if (!total || total <= 0) { setError('Nhập ngân sách tổng'); return }
    setSaving(true)
    setError('')
    try {
      const activeItems = items
        .filter(i => {
          const v = parseAmount(i.amount)
          return v !== null && v > 0
        })
        .map(i => ({
          categoryId: i.categoryId || null,
          recipientLabelId: i.recipientLabelId || null,
          amount: parseAmount(i.amount)!,
        }))
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

  return (
    <div className="space-y-5">
      {/* Total */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">💰 Ngân sách tổng tháng</p>
        <AmountInput value={totalStr} onChange={setTotalStr} />
      </div>

      {/* Categories */}
      {catItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">📂 Theo danh mục (tùy chọn)</p>
          <div className="space-y-3">
            {catItems.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-lg w-7 text-center">{item.icon}</span>
                <span className="text-sm text-gray-600 w-28 truncate">{item.label}</span>
                <div className="flex-1">
                  <AmountInput
                    value={item.amount}
                    onChange={v => updateItem(item.key, v)}
                    placeholder="Không giới hạn"
                    chipSet={[]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipients */}
      {recItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">👥 Theo thành viên (tùy chọn)</p>
          <div className="space-y-3">
            {recItems.map(item => (
              <div key={item.key} className="flex items-center gap-2">
                <span className="text-lg w-7 text-center">{item.icon}</span>
                <span className="text-sm text-gray-600 w-28 truncate">{item.label}</span>
                <div className="flex-1">
                  <AmountInput
                    value={item.amount}
                    onChange={v => updateItem(item.key, v)}
                    placeholder="Không giới hạn"
                    chipSet={[]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Hủy</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Đang lưu…' : 'Lưu ngân sách'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BudgetPage() {
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
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([
      api.get('/transactions/categories/all'),
      api.get('/recipients'),
    ]).then(([catRes, recRes]) => {
      setCategories(catRes.data)
      setRecipients(recRes.data)
    }).catch(() => {})
  }, [])

  const budget = data?.budget ?? null
  const totalSpent = data?.totalSpent ?? 0
  const categorySpent = data?.categorySpent ?? {}
  const recipientSpent = data?.recipientSpent ?? {}

  const catItems: MonthlyBudgetItem[] = budget?.items.filter(i => i.categoryId) ?? []
  const recItems: MonthlyBudgetItem[] = budget?.items.filter(i => i.recipientLabelId) ?? []

  if (editing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</button>
          <h1 className="text-base font-bold text-gray-800">Thiết lập ngân sách — {monthLabel(month)}</h1>
        </div>
        <EditForm
          month={month}
          budget={budget}
          categories={categories}
          recipients={recipients}
          onSave={saved => {
            setData(prev => prev ? { ...prev, budget: saved } : { budget: saved, totalSpent: 0, categorySpent: {}, recipientSpent: {} })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800">Ngân sách tháng</h1>
        <button
          onClick={() => setEditing(true)}
          className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition"
        >
          {budget ? '✏️ Sửa' : '+ Thiết lập'}
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setMonth(prevMonth(month))}
          className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg text-lg"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center">{monthLabel(month)}</span>
        <button
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= currentMonth()}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-2 py-1 rounded-lg text-lg"
        >
          ›
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-3xl">⏳</div>
      ) : !budget ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-5xl">📊</div>
          <p className="text-gray-500 text-sm">Chưa có ngân sách cho tháng này</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-2 px-5 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl"
          >
            Thiết lập ngân sách
          </button>
        </div>
      ) : (
        <>
          {/* Total budget card */}
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

          {/* Category budgets */}
          {catItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">Theo danh mục</p>
              <div className="divide-y divide-gray-50">
                {catItems.map(item => {
                  const spent = categorySpent[item.categoryId!] ?? 0
                  const pct = item.amount > 0 ? (spent / item.amount) * 100 : 0
                  const over = spent > item.amount
                  const warn = !over && pct >= 80
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{item.category?.icon}</span>
                        <span className="text-sm font-medium text-gray-700 flex-1">{item.category?.name}</span>
                        {over && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Vượt mức</span>}
                        {warn && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Gần đầy</span>}
                      </div>
                      <BudgetBar spent={spent} total={item.amount} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Member budgets */}
          {recItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">Theo thành viên</p>
              <div className="divide-y divide-gray-50">
                {recItems.map(item => {
                  const spent = recipientSpent[item.recipientLabelId!] ?? 0
                  const pct = item.amount > 0 ? (spent / item.amount) * 100 : 0
                  const over = spent > item.amount
                  const warn = !over && pct >= 80
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: item.recipientLabel?.color ?? '#6B7280' }}
                        >
                          {item.recipientLabel?.icon} {item.recipientLabel?.name}
                        </span>
                        <span className="flex-1" />
                        {over && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Vượt mức</span>}
                        {warn && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Gần đầy</span>}
                      </div>
                      <BudgetBar spent={spent} total={item.amount} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {catItems.length === 0 && recItems.length === 0 && (
            <p className="text-xs text-center text-gray-400 py-2">
              Chưa có ngân sách theo danh mục hay thành viên — nhấn Sửa để thêm
            </p>
          )}
        </>
      )}
    </div>
  )
}
