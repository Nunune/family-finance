import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import api from '../../services/api'
import type { FamilyReport } from '../../types'

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']

export default function FamilyReport() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [report, setReport] = useState<FamilyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  const load = useCallback(() => {
    setLoading(true)
    api.get('/auth/family/report', { params: { month: monthKey } })
      .then(r => setReport(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [monthKey])

  useEffect(() => { load() }, [load])

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">‹</button>
        <h3 className="font-semibold text-gray-800">{MONTH_NAMES[month - 1]} {year}</h3>
        <button onClick={nextMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">›</button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-3xl animate-pulse">⏳</div>
      ) : !report ? (
        <div className="text-center py-12 text-gray-400 text-sm">Không có dữ liệu</div>
      ) : (
        <>
          {/* Grand total */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
            <p className="text-sm opacity-80 mb-1">Tổng cả nhà</p>
            <p className={`text-3xl font-bold ${report.grandTotal.net < 0 ? 'text-red-200' : ''}`}>
              {report.grandTotal.net >= 0 ? '+' : ''}{fmt(report.grandTotal.net)}
            </p>
            <div className="flex gap-6 mt-3 text-sm">
              <div><p className="opacity-70">Tổng thu</p><p className="font-semibold">+{fmt(report.grandTotal.income)}</p></div>
              <div><p className="opacity-70">Tổng chi</p><p className="font-semibold">-{fmt(report.grandTotal.expense)}</p></div>
            </div>
          </div>

          {/* Per-member breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Cá nhân từng người</p>
            {report.members.map(m => (
              <div key={m.userId} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{m.name}</span>
                  </div>
                  <span className={`text-sm font-bold ${(m.personalIncome - m.personalExpense) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {(m.personalIncome - m.personalExpense) >= 0 ? '+' : ''}{fmt(m.personalIncome - m.personalExpense)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>Thu: <span className="text-emerald-600 font-medium">+{fmt(m.personalIncome)}</span></span>
                  <span>Chi: <span className="text-red-500 font-medium">-{fmt(m.personalExpense)}</span></span>
                </div>
              </div>
            ))}
          </div>

          {/* Shared + sub-funds */}
          {(report.shared.income > 0 || report.shared.expense > 0 || report.subFunds.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Quỹ chung</p>

              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">🏦 Quỹ chính</span>
                  <span className={`text-sm font-bold ${(report.shared.income - report.shared.expense) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {(report.shared.income - report.shared.expense) >= 0 ? '+' : ''}{fmt(report.shared.income - report.shared.expense)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>Thu: <span className="text-emerald-600 font-medium">+{fmt(report.shared.income)}</span></span>
                  <span>Chi: <span className="text-red-500 font-medium">-{fmt(report.shared.expense)}</span></span>
                </div>
              </div>

              {report.subFunds.filter(s => s.income > 0 || s.expense > 0).map(s => (
                <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{s.icon} {s.name}</span>
                    <span className={`text-sm font-bold ${(s.income - s.expense) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {(s.income - s.expense) >= 0 ? '+' : ''}{fmt(s.income - s.expense)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Thu: <span className="text-emerald-600 font-medium">+{fmt(s.income)}</span></span>
                    <span>Chi: <span className="text-red-500 font-medium">-{fmt(s.expense)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bar chart: members comparison */}
          {report.members.length > 1 && (report.grandTotal.income > 0 || report.grandTotal.expense > 0) && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-4">So sánh thu/chi cá nhân</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={report.members.map(m => ({ name: m.name, Thu: m.personalIncome, Chi: m.personalExpense }))} barSize={20}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={20}
                    tickFormatter={v => v >= 1000000 ? `${v/1000000}tr` : v >= 1000 ? `${v/1000}k` : String(v)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chi" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category breakdown pie */}
          {report.categoryBreakdown.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Chi tiêu theo danh mục (cả nhà)</p>
              <div className="flex gap-4 items-center">
                <PieChart width={120} height={120}>
                  <Pie data={report.categoryBreakdown.slice(0, 8)} dataKey="amount" cx={55} cy={55} innerRadius={30} outerRadius={55}>
                    {report.categoryBreakdown.slice(0, 8).map((c, i) => (
                      <Cell key={i} fill={c.color || `hsl(${i * 45}, 60%, 55%)`} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="flex-1 space-y-1.5">
                  {report.categoryBreakdown.slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm">{c.icon}</span>
                      <span className="text-xs text-gray-600 flex-1 truncate">{c.name}</span>
                      <span className="text-xs font-medium text-red-500">{fmt(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
