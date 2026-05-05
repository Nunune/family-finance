import { useEffect, useState } from 'react'
import api from '../../services/api'

interface WeekData {
  weeksAgo: number
  label: string
  startDate: string
  endDate: string
  expense: number
}

interface WeeklySummary {
  weeks: WeekData[]
  thisWeek: number
  avgExpense: number
  ratio: number
  alert: 'HIGH' | 'MODERATE' | 'NORMAL' | 'GOOD' | null
  topCategories: { name: string; icon: string; amount: number }[]
  projectedWeek: number
  daysElapsed: number
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'tr'
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 0) + 'k'
  return n.toLocaleString('vi-VN')
}
const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

const ALERT_CONFIG = {
  HIGH: {
    bg: 'bg-red-50 border-red-200',
    icon: '🔴',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
  },
  MODERATE: {
    bg: 'bg-amber-50 border-amber-200',
    icon: '🟡',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  NORMAL: {
    bg: 'bg-white border-gray-100',
    icon: '🟢',
    text: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-600',
  },
  GOOD: {
    bg: 'bg-emerald-50 border-emerald-100',
    icon: '💚',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
}

function alertMessage(alert: WeeklySummary['alert'], ratio: number): string {
  if (!alert) return ''
  const pct = Math.round(Math.abs(ratio - 1) * 100)
  if (alert === 'HIGH') return `Chi tiêu tuần này cao hơn ${pct}% so với trung bình — nên kiểm soát lại!`
  if (alert === 'MODERATE') return `Chi tiêu tuần này cao hơn ${pct}% so với trung bình`
  if (alert === 'GOOD') return `Tuần này tiết kiệm hơn ${pct}% so với trung bình — tốt lắm! 🎉`
  return 'Chi tiêu tuần này bình thường'
}

export default function WeeklyInsightCard({ walletType = 'PERSONAL' }: { walletType?: string }) {
  const [data, setData] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/transactions/summary/weekly', { params: { walletType } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [walletType])

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 h-32 flex items-center justify-center text-gray-300 text-sm">
      Đang tải...
    </div>
  )

  if (!data || data.weeks.length === 0 || data.thisWeek === 0 && data.avgExpense === 0) return null

  const cfg = ALERT_CONFIG[data.alert ?? 'NORMAL']
  const maxExpense = Math.max(...data.weeks.map(w => w.expense), 1)

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm">📊 Chi tiêu theo tuần</h2>
        {data.alert && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.badge}`}>
            {cfg.icon} {data.alert === 'HIGH' ? 'Cao bất thường' : data.alert === 'MODERATE' ? 'Cao hơn TB' : data.alert === 'GOOD' ? 'Tiết kiệm' : 'Bình thường'}
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-20">
        {data.weeks.map(week => {
          const heightPct = maxExpense > 0 ? (week.expense / maxExpense) * 100 : 0
          const isCurrent = week.weeksAgo === 0
          return (
            <div key={week.weeksAgo} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 font-medium leading-none">
                {week.expense > 0 ? fmt(week.expense) : '—'}
              </span>
              <div className="w-full flex items-end" style={{ height: 48 }}>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isCurrent
                      ? data.alert === 'HIGH' ? 'bg-red-400' : data.alert === 'MODERATE' ? 'bg-amber-400' : data.alert === 'GOOD' ? 'bg-emerald-400' : 'bg-emerald-400'
                      : 'bg-gray-200'
                  }`}
                  style={{ height: `${Math.max(heightPct, week.expense > 0 ? 8 : 0)}%` }}
                />
              </div>
              <span className={`text-[10px] leading-none text-center ${isCurrent ? 'font-bold text-gray-700' : 'text-gray-400'}`}>
                {week.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Alert message */}
      {data.alert && data.alert !== 'NORMAL' && (
        <p className={`text-xs ${cfg.text} leading-relaxed`}>
          {alertMessage(data.alert, data.ratio)}
        </p>
      )}

      {/* Stats row */}
      <div className="flex gap-4 text-xs">
        <div>
          <p className="text-gray-400">Tuần này</p>
          <p className={`font-bold ${cfg.text}`}>{fmtFull(data.thisWeek)}</p>
        </div>
        {data.avgExpense > 0 && (
          <div>
            <p className="text-gray-400">Trung bình/tuần</p>
            <p className="font-bold text-gray-600">{fmtFull(data.avgExpense)}</p>
          </div>
        )}
        {data.projectedWeek > 0 && data.daysElapsed < 7 && (
          <div>
            <p className="text-gray-400">Dự kiến cả tuần</p>
            <p className={`font-bold ${data.projectedWeek > data.avgExpense * 1.2 ? 'text-amber-600' : 'text-gray-600'}`}>
              ~{fmtFull(data.projectedWeek)}
            </p>
          </div>
        )}
      </div>

      {/* Top categories */}
      {data.topCategories.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 font-medium">Danh mục nhiều nhất tuần này</p>
          {data.topCategories.map((cat, i) => {
            const barWidth = data.topCategories[0].amount > 0
              ? Math.round((cat.amount / data.topCategories[0].amount) * 100)
              : 0
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm w-5 shrink-0">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-600 truncate">{cat.name}</span>
                    <span className="text-xs font-medium text-gray-700 shrink-0 ml-2">{fmtFull(cat.amount)}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${data.alert === 'HIGH' ? 'bg-red-300' : data.alert === 'MODERATE' ? 'bg-amber-300' : 'bg-emerald-300'}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
