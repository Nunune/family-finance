import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import PlanItemForm from './PlanItemForm'
import type { PlanItem } from '../../types'

const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

function dueDateLabel(item: PlanItem): string {
  if (item.frequency === 'MONTHLY') return `Ngày ${item.dueDay} hàng tháng`
  if (item.frequency === 'WEEKLY') return `${DAY_NAMES[item.dueDay ?? 0]} hàng tuần`
  if (item.dueDate) {
    const d = new Date(item.dueDate)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }
  return ''
}

function freqBadge(freq: string) {
  if (freq === 'MONTHLY') return <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">Tháng</span>
  if (freq === 'WEEKLY') return <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">Tuần</span>
  return <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">1 lần</span>
}

export default function PlanItemList() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [reminders, setReminders] = useState<(PlanItem & { diffDays: number })[]>([])

  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/plan-items', { params: { month: monthKey } }),
      api.get('/plan-items/reminders'),
    ]).then(([r, rem]) => {
      setItems(r.data)
      setReminders(rem.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [monthKey])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  async function toggle(item: PlanItem) {
    const newDone = !item.isDone
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isDone: newDone } : i))
    try {
      await api.post(`/plan-items/${item.id}/completion`, {
        periodKey: item.periodKey,
        isDone: newDone,
      })
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isDone: !newDone } : i))
    }
  }

  async function remove(id: string) {
    if (!confirm('Xoá khoản dự kiến này?')) return
    await api.delete(`/plan-items/${id}`)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const income = items.filter(i => i.type === 'INCOME')
  const expense = items.filter(i => i.type === 'EXPENSE')
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpense = expense.reduce((s, i) => s + i.amount, 0)
  const net = totalIncome - totalExpense
  const doneIncome = income.filter(i => i.isDone).reduce((s, i) => s + i.amount, 0)
  const doneExpense = expense.filter(i => i.isDone).reduce((s, i) => s + i.amount, 0)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dueSoonCount = reminders.length

  return (
    <div className="space-y-4">
      {/* Reminder banner */}
      {isCurrentMonth && dueSoonCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-medium text-amber-800">⏰ {dueSoonCount} khoản sắp đến hạn</p>
          <div className="mt-2 space-y-1">
            {reminders.map(r => (
              <p key={r.id} className="text-xs text-amber-700">
                {r.type === 'INCOME' ? '💰' : '💸'} {r.title} —{' '}
                {r.diffDays === 0 ? 'Hôm nay!' : `còn ${r.diffDays} ngày`}{' '}
                ({fmtFull(r.amount)})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">‹</button>
        <h3 className="font-semibold text-gray-800">{MONTH_NAMES[month - 1]} {year}</h3>
        <button onClick={nextMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">›</button>
      </div>

      {/* Summary card */}
      {(totalIncome > 0 || totalExpense > 0) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tổng dự kiến tháng này</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400">Dự thu</p>
              <p className="text-base font-bold text-emerald-600">{fmtFull(totalIncome)}</p>
              {doneIncome > 0 && <p className="text-[10px] text-gray-400">Đã thu: {fmtFull(doneIncome)}</p>}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Dự chi</p>
              <p className="text-base font-bold text-red-500">{fmtFull(totalExpense)}</p>
              {doneExpense > 0 && <p className="text-[10px] text-gray-400">Đã chi: {fmtFull(doneExpense)}</p>}
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Dự tính còn lại</p>
              <p className={`text-base font-bold ${net >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                {net >= 0 ? '+' : ''}{fmtFull(net)}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          {totalExpense > 0 && (
            <div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min((doneExpense / totalExpense) * 100, 100)}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{Math.round((doneExpense / totalExpense) * 100)}% đã thực hiện</p>
            </div>
          )}
        </div>
      )}

      {/* Income section */}
      {income.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">💰 Dự thu ({income.length})</p>
          {income.map(item => <PlanItemRow key={item.id} item={item} onToggle={toggle} onEdit={i => { setEditItem(i); setShowForm(true) }} onDelete={remove} />)}
        </div>
      )}

      {/* Expense section */}
      {expense.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">💸 Dự chi ({expense.length})</p>
          {expense.map(item => <PlanItemRow key={item.id} item={item} onToggle={toggle} onEdit={i => { setEditItem(i); setShowForm(true) }} onDelete={remove} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-gray-300">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">Chưa có khoản dự kiến nào</p>
          <p className="text-xs mt-1">Thêm dự thu / dự chi để lên kế hoạch tháng</p>
        </div>
      )}

      {/* Add button */}
      <button
        onClick={() => { setEditItem(null); setShowForm(true) }}
        className="w-full border-2 border-dashed border-indigo-200 text-indigo-500 rounded-2xl py-3 text-sm font-medium hover:bg-indigo-50 transition-colors"
      >
        + Thêm khoản dự thu / dự chi
      </button>

      {showForm && (
        <PlanItemForm
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaved={() => { setShowForm(false); setEditItem(null); load() }}
        />
      )}
    </div>
  )
}

function AutoBadge({ type }: { type: 'DEBT' | 'HUI' }) {
  if (type === 'DEBT') return <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full shrink-0">Nợ</span>
  return <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">Hụi</span>
}

function PlanItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: PlanItem
  onToggle: (i: PlanItem) => void
  onEdit: (i: PlanItem) => void
  onDelete: (id: string) => void
}) {
  const isIncome = item.type === 'INCOME'
  const isAuto = item.isAuto

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      item.isDone ? 'bg-gray-50 border-gray-100 opacity-60'
      : item.isDueSoon ? 'bg-amber-50 border-amber-200'
      : isAuto ? 'bg-gray-50/60 border-gray-100 border-dashed'
      : 'bg-white border-gray-100'
    }`}>
      {/* Checkbox — read-only for auto items */}
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
        item.isDone ? 'bg-emerald-500 border-emerald-500 text-white'
        : isAuto ? 'border-gray-200 bg-gray-100'
        : 'border-gray-300'
      } ${!isAuto ? 'cursor-pointer hover:border-emerald-400' : ''}`}
        onClick={() => !isAuto && onToggle(item)}
      >
        {item.isDone && <span className="text-[10px]">✓</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && <span className="text-sm">{item.category.icon}</span>}
          <p className={`text-sm font-medium truncate ${item.isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
            {item.title}
          </p>
          {item.isDueSoon && !item.isDone && (
            <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full shrink-0">Sắp đến!</span>
          )}
          {isAuto && item.sourceType && <AutoBadge type={item.sourceType} />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-400">
            {item.dueDate ? (() => { const d = new Date(item.dueDate); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}` })() : dueDateLabel(item)}
          </span>
          {!isAuto && freqBadge(item.frequency)}
        </div>
      </div>

      {/* Amount */}
      <p className={`text-sm font-bold shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
        {isIncome ? '+' : '-'}{fmtFull(item.amount)}
      </p>

      {/* Actions — hidden for auto items */}
      {!isAuto && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(item)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 text-sm">✏️</button>
          <button onClick={() => onDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 text-sm">🗑️</button>
        </div>
      )}
    </div>
  )
}

