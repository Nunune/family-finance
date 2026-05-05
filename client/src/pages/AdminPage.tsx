import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../services/api'

interface Stats {
  summary: {
    totalUsers: number
    newThisWeek: number
    newThisMonth: number
    totalFamilies: number
    totalSubFunds: number
    wallets: Record<string, number>
    activeUsersLast30d: number
  }
  growth: { date: string; count: number }[]
  recentUsers: {
    id: string
    name: string
    email: string
    familyId: string | null
    role: string
    createdAt: string
  }[]
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function fmtShortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('Không có quyền truy cập'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-20 text-gray-300 text-3xl animate-pulse">⏳</div>
  )

  if (error || !stats) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-4xl mb-3">🔒</p>
      <p className="text-gray-500">{error || 'Không có dữ liệu'}</p>
    </div>
  )

  const { summary, growth, recentUsers } = stats
  const totalWallets = Object.values(summary.wallets).reduce((a, b) => a + b, 0)

  // Only show last 14 days on chart to avoid crowding
  const chartData = growth.slice(-14).map(d => ({ ...d, date: fmtShortDate(d.date) }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Tổng quan hệ thống</h1>
        <p className="text-sm text-gray-400 mt-0.5">Theo dõi tăng trưởng thành viên — không hiển thị số tiền</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Tổng thành viên" value={summary.totalUsers} icon="👥" color="emerald" />
        <StatCard label="Mới tuần này" value={summary.newThisWeek} icon="🆕" color="blue" />
        <StatCard label="Mới tháng này" value={summary.newThisMonth} icon="📅" color="indigo" />
        <StatCard label="Hoạt động 30 ngày" value={summary.activeUsersLast30d} icon="⚡" color="amber" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Gia đình" value={summary.totalFamilies} icon="🏠" color="purple" />
        <StatCard label="Ví cá nhân" value={summary.wallets['PERSONAL'] ?? 0} icon="👛" color="gray" />
        <StatCard label="Quỹ chung" value={summary.wallets['SHARED'] ?? 0} icon="🏦" color="gray" />
        <StatCard label="Quỹ phụ" value={summary.totalSubFunds} icon="📂" color="gray" />
      </div>

      {/* Growth chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Đăng ký mới — 14 ngày gần nhất</p>
        {chartData.some(d => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 13 }}
                formatter={(v: number) => [`${v} người`, 'Đăng ký']}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">
            Chưa có đăng ký mới trong 14 ngày qua
          </div>
        )}
      </div>

      {/* Recent signups */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-sm font-semibold text-gray-700">Thành viên mới nhất</p>
        </div>
        <div className="divide-y divide-gray-50">
          {recentUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-600 shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{fmtDate(u.createdAt)}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  {u.familyId
                    ? <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">Có gia đình</span>
                    : <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Chưa có gia đình</span>
                  }
                  {u.role === 'ADMIN' && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Admin</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-300 pb-4">
        Tổng {totalWallets} ví · {summary.totalFamilies} gia đình · {summary.totalSubFunds} quỹ phụ
      </p>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-600',
  }
  return (
    <div className={`rounded-2xl p-4 ${colors[color] ?? colors.gray}`}>
      <p className="text-xl mb-1">{icon}</p>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  )
}
