import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { name: string; color: string; icon: string; total: number }[]
}

export default function CategoryPieChart({ data }: Props) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Không có chi tiêu</div>

  const total = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="total" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => new Intl.NumberFormat('vi-VN').format(v) + ' ₫'} />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex-1 space-y-2 w-full">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-gray-600 flex-1 truncate">{d.icon} {d.name}</span>
            <span className="text-sm font-medium text-gray-700">{Math.round(d.total / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
