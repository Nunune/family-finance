import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import api from '../../services/api'
import { ExchangeRate } from '../../types'
import { fmtCurrency, getCurrency } from '../../utils/currency'

interface MonthData { month: string; income: number; expense: number }
interface WalletSeries { id: string; currency: string; name: string | null; data: MonthData[] }
interface ApiResponse { months: string[]; wallets: WalletSeries[] }

const WALLET_COLORS: Record<string, string> = {
  VND: '#6366F1',
  AUD: '#F59E0B',
  USD: '#10B981',
  EUR: '#3B82F6',
  JPY: '#EC4899',
  SGD: '#8B5CF6',
  GBP: '#EF4444',
  CNY: '#F97316',
}

function fmt(n: number, currency = 'VND') {
  if (currency === 'VND' || n >= 1_000_000) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'tr'
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k'
    return String(Math.round(n))
  }
  return n.toFixed(2)
}

function monthLabel(m: string) {
  const [, mon] = m.split('-')
  return 'T' + parseInt(mon)
}

type ViewMode = 'net' | 'income' | 'expense'

interface Props {
  exchangeRates: ExchangeRate[]
}

export default function WalletMonthlyChart({ exchangeRates }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [months, setMonths] = useState(6)
  const [view, setView] = useState<ViewMode>('net')
  const [convertToVND, setConvertToVND] = useState(true)

  useEffect(() => {
    api.get('/wallets/monthly', { params: { months } })
      .then(r => setData(r.data))
      .catch(() => {})
  }, [months])

  if (!data || data.wallets.length < 2) return null

  function toVND(amount: number, currency: string) {
    if (currency === 'VND') return amount
    const rate = exchangeRates.find(r => r.fromCurrency === currency && r.toCurrency === 'VND')
    return rate ? Math.round(amount * rate.rate) : null
  }

  const chartData = data.months.map(month => {
    const row: Record<string, number | string> = { month: monthLabel(month) }
    data.wallets.forEach(w => {
      const md = w.data.find(d => d.month === month)
      const income = md?.income ?? 0
      const expense = md?.expense ?? 0
      const net = income - expense

      if (convertToVND && w.currency !== 'VND') {
        const vndIncome = toVND(income, w.currency)
        const vndExpense = toVND(expense, w.currency)
        const vndNet = toVND(net, w.currency)
        row[`${w.currency}_income`] = vndIncome ?? 0
        row[`${w.currency}_expense`] = vndExpense ?? 0
        row[`${w.currency}_net`] = vndNet ?? 0
      } else {
        row[`${w.currency}_income`] = income
        row[`${w.currency}_expense`] = expense
        row[`${w.currency}_net`] = net
      }
    })
    return row
  })

  const displayCurrency = convertToVND ? 'VND' : undefined
  const hasRates = data.wallets.every(w =>
    w.currency === 'VND' || exchangeRates.some(r => r.fromCurrency === w.currency && r.toCurrency === 'VND')
  )

  const dataKey = (currency: string) => `${currency}_${view}`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700">So sánh ví theo tháng</h3>
        <div className="flex items-center gap-2">
          {/* Month range */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
            {([3, 6, 12] as const).map(n => (
              <button key={n} onClick={() => setMonths(n)}
                className={`px-2 py-1 rounded-md transition font-medium ${months === n ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
                {n}T
              </button>
            ))}
          </div>
          {/* Convert to VND toggle */}
          {data.wallets.some(w => w.currency !== 'VND') && (
            <button
              onClick={() => setConvertToVND(v => !v)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition border ${convertToVND ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
            >
              ≈ VND
            </button>
          )}
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-0.5 w-fit text-xs">
        {([
          { key: 'net', label: 'Ròng' },
          { key: 'income', label: 'Thu' },
          { key: 'expense', label: 'Chi' },
        ] as { key: ViewMode; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-3 py-1 rounded-lg font-medium transition ${view === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {!hasRates && convertToVND && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
          ⚠️ Một số ví chưa có tỉ giá — số liệu quy đổi có thể thiếu. Thiết lập tỉ giá bên trên.
        </p>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barGap={4} margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => fmt(Math.abs(v), displayCurrency)}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const currency = name.split('_')[0]
              const dispCurrency = convertToVND ? 'VND' : currency
              const label = `${getCurrency(currency).symbol} ${currency}`
              return [fmtCurrency(value, dispCurrency), label]
            }}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
          />
          <Legend
            formatter={(name: string) => {
              const currency = name.split('_')[0]
              return `${getCurrency(currency).symbol} ${currency}`
            }}
            wrapperStyle={{ fontSize: 11 }}
          />
          {data.wallets.map(w => (
            <Bar
              key={w.id}
              dataKey={dataKey(w.currency)}
              fill={WALLET_COLORS[w.currency] ?? '#94a3b8'}
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
