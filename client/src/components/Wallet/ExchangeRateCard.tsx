import { useState } from 'react'
import api from '../../services/api'
import { fmtCurrency } from '../../utils/currency'
import type { ExchangeRate } from '../../types'

interface Props {
  currencies: string[]  // all non-VND currencies user has wallets for
  rates: ExchangeRate[]
  onUpdated: (rate: ExchangeRate) => void
}

export default function ExchangeRateCard({ currencies, rates, onUpdated }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  if (!currencies.length) return null

  async function save(currency: string) {
    const parsed = parseFloat(input.replace(/,/g, ''))
    if (isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    try {
      const res = await api.put('/exchange-rates', { fromCurrency: currency, toCurrency: 'VND', rate: parsed })
      onUpdated(res.data)
      setEditing(null); setInput('')
    } finally {
      setSaving(false) }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tỉ giá quy đổi → VND</p>
      {currencies.map(cur => {
        const rate = rates.find(r => r.fromCurrency === cur && r.toCurrency === 'VND')
        const isEditing = editing === cur
        return (
          <div key={cur} className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">1 {cur}</p>
              {rate ? (
                <p className="text-xs text-gray-400">= {fmtCurrency(rate.rate, 'VND')}</p>
              ) : (
                <p className="text-xs text-amber-500">Chưa có tỉ giá</p>
              )}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text" inputMode="numeric"
                  placeholder="VD: 16200"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && save(cur)}
                  className="w-28 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button onClick={() => save(cur)} disabled={saving}
                  className="text-xs bg-indigo-500 text-white px-2 py-1.5 rounded-lg disabled:opacity-50">
                  Lưu
                </button>
                <button onClick={() => { setEditing(null); setInput('') }} className="text-xs text-gray-400">Huỷ</button>
              </div>
            ) : (
              <button
                onClick={() => { setEditing(cur); setInput(rate ? String(rate.rate) : '') }}
                className="text-xs text-indigo-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50"
              >
                {rate ? 'Cập nhật' : 'Nhập tỉ giá'}
              </button>
            )}
          </div>
        )
      })}
      <p className="text-[10px] text-gray-300">Tỉ giá dùng để hiển thị giá trị tương đương, không tự động chuyển đổi</p>
    </div>
  )
}
