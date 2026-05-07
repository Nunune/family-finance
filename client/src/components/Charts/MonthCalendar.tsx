import { useState, useEffect, useMemo } from 'react'
import { PlanItem, Transaction } from '../../types'
import api from '../../services/api'

interface Props {
  byDay: { date: string; income: number; expense: number }[]
  year: number
  month: number
  walletType?: 'PERSONAL' | 'SHARED'
}

const DOW = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']

function cmp(n: number): string {
  if (!n) return ''
  if (n >= 1_000_000) {
    const v = Math.round(n / 100_000) / 10
    return v + 'tr'
  }
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return n.toString()
}

function getPlanDaysInMonth(item: PlanItem, year: number, month: number): number[] {
  if (!item.isActive) return []
  const lastDay = new Date(year, month, 0).getDate()
  if (item.frequency === 'ONCE') {
    if (!item.dueDate) return []
    const d = new Date(item.dueDate)
    if (d.getFullYear() === year && d.getMonth() === month - 1) return [d.getDate()]
    return []
  }
  if (item.frequency === 'MONTHLY') {
    if (!item.dueDay) return []
    return [Math.min(item.dueDay, lastDay)]
  }
  if (item.frequency === 'WEEKLY' && item.dueDay != null) {
    const firstOfMonth = new Date(year, month - 1, 1)
    const diff = (item.dueDay - firstOfMonth.getDay() + 7) % 7
    const days: number[] = []
    for (let d = 1 + diff; d <= lastDay; d += 7) days.push(d)
    return days
  }
  return []
}

export default function MonthCalendar({ byDay, year, month, walletType = 'PERSONAL' }: Props) {
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayTx, setDayTx] = useState<Transaction[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  useEffect(() => {
    const m = `${year}-${String(month).padStart(2, '0')}`
    api.get('/plan-items', { params: { month: m } }).then(r => setPlanItems(r.data)).catch(() => {})
  }, [year, month])

  const dayMap = useMemo(() => {
    const m: Record<number, { income: number; expense: number }> = {}
    byDay.forEach(d => {
      const day = new Date(d.date).getDate()
      m[day] = { income: d.income, expense: d.expense }
    })
    return m
  }, [byDay])

  const planMap = useMemo(() => {
    const m: Record<number, { planIncome: number; planExpense: number }> = {}
    planItems.forEach(item => {
      if (item.isDone) return
      getPlanDaysInMonth(item, year, month).forEach(day => {
        if (!m[day]) m[day] = { planIncome: 0, planExpense: 0 }
        if (item.type === 'INCOME') m[day].planIncome += item.amount
        else m[day].planExpense += item.amount
      })
    })
    return m
  }, [planItems, year, month])

  const firstDOW = new Date(year, month - 1, 1).getDay()
  const lastDate = new Date(year, month, 0).getDate()
  const today = new Date()
  const todayDate =
    today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : -1

  const cells: (number | null)[] = [
    ...Array(firstDOW).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const handleDayTap = async (day: number) => {
    setSelectedDay(day)
    setDayLoading(true)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    try {
      const r = await api.get('/transactions', {
        params: { walletType, startDate: dateStr, endDate: dateStr, limit: 50 },
      })
      setDayTx(r.data.transactions ?? [])
    } catch {
      setDayTx([])
    } finally {
      setDayLoading(false)
    }
  }

  const dayPlanItems = selectedDay
    ? planItems.filter(item => getPlanDaysInMonth(item, year, month).includes(selectedDay))
    : []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-semibold text-gray-800">Lịch tháng {month}/{year}</h2>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[11px] font-semibold py-1.5 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const colIdx = idx % 7
          const isSun = colIdx === 0
          const isSat = colIdx === 6
          const isToday = day === todayDate
          const data = day ? dayMap[day] : null
          const plan = day ? planMap[day] : null
          const hasData = data?.income || data?.expense || plan?.planIncome || plan?.planExpense

          return (
            <div
              key={idx}
              onClick={() => day && handleDayTap(day)}
              className={[
                'border-b border-r border-gray-100 min-h-[68px] p-1 flex flex-col gap-0.5 transition-colors',
                day
                  ? hasData
                    ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100'
                    : 'cursor-pointer hover:bg-gray-50/60'
                  : 'bg-gray-50/40',
                isToday ? '!bg-emerald-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {day && (
                <>
                  {/* Day number */}
                  <div className="flex items-center justify-start mb-0.5">
                    <span
                      className={[
                        'text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full leading-none',
                        isToday
                          ? 'bg-emerald-500 text-white'
                          : isSun
                          ? 'text-red-400'
                          : isSat
                          ? 'text-blue-400'
                          : 'text-gray-700',
                      ].join(' ')}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Actual income */}
                  {data?.income ? (
                    <span className="text-[10px] leading-[1.2] text-emerald-600 font-semibold tabular-nums">
                      {cmp(data.income)}
                    </span>
                  ) : null}

                  {/* Actual expense */}
                  {data?.expense ? (
                    <span className="text-[10px] leading-[1.2] text-red-500 font-semibold tabular-nums">
                      {cmp(data.expense)}
                    </span>
                  ) : null}

                  {/* Plan income (dashed underline = chưa xảy ra) */}
                  {plan?.planIncome ? (
                    <span className="text-[10px] leading-[1.2] text-emerald-400 tabular-nums underline decoration-dashed decoration-emerald-300">
                      {cmp(plan.planIncome)}
                    </span>
                  ) : null}

                  {/* Plan expense */}
                  {plan?.planExpense ? (
                    <span className="text-[10px] leading-[1.2] text-red-300 tabular-nums underline decoration-dashed decoration-red-200">
                      {cmp(plan.planExpense)}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-gray-100">
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Thu
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> Chi
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0" />
          <span className="underline decoration-dashed">Dự thu</span>
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-red-300 shrink-0" />
          <span className="underline decoration-dashed">Dự chi</span>
        </span>
      </div>

      {/* Day detail bottom sheet */}
      {selectedDay !== null && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
          <div
            className="relative bg-white rounded-t-3xl w-full max-h-[70vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-1 shrink-0" />

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800">
                  Ngày {selectedDay}/{month}/{year}
                </h3>
                {!dayLoading && (dayTx.length > 0 || dayPlanItems.length > 0) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dayTx.length > 0 && `${dayTx.length} giao dịch`}
                    {dayTx.length > 0 && dayPlanItems.length > 0 && ' · '}
                    {dayPlanItems.length > 0 && `${dayPlanItems.length} dự kiến`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-5 py-3 pb-8 space-y-1">
              {dayLoading ? (
                <div className="py-10 text-center text-gray-400 text-sm">Đang tải...</div>
              ) : dayTx.length === 0 && dayPlanItems.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Không có giao dịch</div>
              ) : (
                <>
                  {/* Actual transactions */}
                  {dayTx.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Giao dịch</p>
                      <div className="space-y-0.5">
                        {dayTx.map(tx => (
                          <div
                            key={tx.id}
                            className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
                          >
                            <span className="text-lg w-8 text-center shrink-0">{tx.category?.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {tx.note || tx.category?.name}
                              </p>
                              {tx.note && (
                                <p className="text-xs text-gray-400 truncate">{tx.category?.name}</p>
                              )}
                            </div>
                            <span
                              className={`text-sm font-semibold shrink-0 ${
                                tx.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {tx.type === 'INCOME' ? '+' : '−'}
                              {tx.amount.toLocaleString('vi-VN')} ₫
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan items */}
                  {dayPlanItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dự kiến</p>
                      <div className="space-y-0.5">
                        {dayPlanItems.map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 ${
                              item.isDone ? 'opacity-50' : ''
                            }`}
                          >
                            <span className="text-lg w-8 text-center shrink-0">
                              {item.category?.icon || (item.type === 'INCOME' ? '📥' : '📤')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                              <p className="text-xs text-gray-400">
                                {item.isDone ? '✓ Đã hoàn thành' : 'Chưa thực hiện'}
                              </p>
                            </div>
                            <span
                              className={`text-sm font-semibold shrink-0 ${
                                item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-300'
                              }`}
                            >
                              {item.type === 'INCOME' ? '+' : '−'}
                              {item.amount.toLocaleString('vi-VN')} ₫
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
