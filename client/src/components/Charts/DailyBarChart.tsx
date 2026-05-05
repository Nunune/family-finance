import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'

interface Props {
  data: { date: string; income: number; expense: number }[]
}

function shortDate(d: string) {
  return format(new Date(d), 'dd/MM')
}

function formatK(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
  return String(v)
}

export default function DailyBarChart({ data }: Props) {
  if (!data.length) return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Không có dữ liệu</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barGap={2}>
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(v: number, name: string) => [new Intl.NumberFormat('vi-VN').format(v) + ' ₫', name === 'income' ? 'Thu' : 'Chi']}
          labelFormatter={shortDate}
        />
        <Legend formatter={v => v === 'income' ? 'Thu nhập' : 'Chi tiêu'} />
        <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
