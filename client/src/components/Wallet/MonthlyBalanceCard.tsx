import { useState, useEffect } from 'react'
import api from '../../services/api'
import { fmtCurrency } from '../../utils/currency'
import { parseAmount } from '../../utils/amountParser'

interface PocketRow {
  id: string
  name: string
  icon: string
  color: string
  initialBalance: number
  openingBalance: number
  income: number
  expense: number
  closingBalance: number
}

interface WalletRow {
  id: string
  name: string | null
  currency: string
  initialBalance: number
  openingBalance: number
  income: number
  expense: number
  closingBalance: number
  pockets: PocketRow[]
}

interface Props {
  month: number
  year: number
  walletType: 'PERSONAL' | 'SHARED'
}

export default function MonthlyBalanceCard({ month, year, walletType }: Props) {
  const [data, setData] = useState<WalletRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editingInitial, setEditingInitial] = useState<{ type: 'wallet' | 'pocket'; id: string } | null>(null)
  const [initInput, setInitInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/wallets/balance-history', { params: { month, year, walletType } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, year, walletType])

  async function saveInitial() {
    if (!editingInitial) return
    const val = parseAmount(initInput) ?? parseFloat(initInput) ?? 0
    setSaving(true)
    try {
      if (editingInitial.type === 'wallet') {
        await api.put('/transactions/wallet/balance', {
          walletType,
          ...(walletType === 'PERSONAL' ? { walletId: editingInitial.id } : {}),
          initialBalance: String(val),
        })
      } else {
        await api.patch(`/pockets/${editingInitial.id}`, { initialBalance: val })
      }
      const r = await api.get('/wallets/balance-history', { params: { month, year, walletType } })
      setData(r.data)
      setEditingInitial(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null
  if (!data.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-700">📊 Số dư tháng {month}/{year}</h2>
      </div>

      {data.map(wallet => {
        const fmt = (n: number) => fmtCurrency(n, wallet.currency)
        const hasPockets = wallet.pockets.length > 0

        return (
          <div key={wallet.id}>
            {/* Wallet row */}
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-600">
                  {wallet.name ?? wallet.currency}
                  {hasPockets && <span className="text-gray-400 font-normal"> (tổng)</span>}
                </span>
                <button
                  onClick={() => { setEditingInitial({ type: 'wallet', id: wallet.id }); setInitInput(wallet.initialBalance.toLocaleString('vi-VN')) }}
                  className="text-[10px] text-gray-400 hover:text-indigo-500 border border-dashed border-gray-200 hover:border-indigo-300 px-1.5 py-0.5 rounded"
                >
                  Số dư gốc
                </button>
              </div>
              {editingInitial?.id === wallet.id && editingInitial.type === 'wallet' && (
                <InitialBalanceEditor
                  value={initInput} onChange={setInitInput} saving={saving}
                  onSave={saveInitial} onCancel={() => setEditingInitial(null)}
                />
              )}
              <BalanceRow fmt={fmt} opening={wallet.openingBalance} income={wallet.income} expense={wallet.expense} closing={wallet.closingBalance} />
            </div>

            {/* Pocket rows */}
            {wallet.pockets.map((pocket, pi) => (
              <div key={pocket.id} className={`pl-6 pr-4 py-2.5 ${pi < wallet.pockets.length - 1 ? 'border-b border-gray-50' : ''} bg-gray-50/40`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[10px]" style={{ backgroundColor: pocket.color + '30' }}>
                      {pocket.icon}
                    </span>
                    {pocket.name}
                  </span>
                  <button
                    onClick={() => { setEditingInitial({ type: 'pocket', id: pocket.id }); setInitInput(pocket.initialBalance.toLocaleString('vi-VN')) }}
                    className="text-[10px] text-gray-400 hover:text-indigo-500 border border-dashed border-gray-200 hover:border-indigo-300 px-1.5 py-0.5 rounded"
                  >
                    Số dư gốc
                  </button>
                </div>
                {editingInitial?.id === pocket.id && editingInitial.type === 'pocket' && (
                  <InitialBalanceEditor
                    value={initInput} onChange={setInitInput} saving={saving}
                    onSave={saveInitial} onCancel={() => setEditingInitial(null)}
                  />
                )}
                <BalanceRow fmt={fmt} opening={pocket.openingBalance} income={pocket.income} expense={pocket.expense} closing={pocket.closingBalance} incomeLabel="Bỏ vào" expenseLabel="Lấy ra" />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function BalanceRow({ fmt, opening, income, expense, closing, incomeLabel = 'Thu', expenseLabel = 'Chi' }: {
  fmt: (n: number) => string
  opening: number; income: number; expense: number; closing: number
  incomeLabel?: string; expenseLabel?: string
}) {
  return (
    <div className="grid grid-cols-4 gap-1 text-center">
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Đầu tháng</p>
        <p className="text-xs font-medium text-gray-700">{fmt(opening)}</p>
      </div>
      <div>
        <p className="text-[9px] text-emerald-500 mb-0.5">{incomeLabel}</p>
        <p className="text-xs font-medium text-emerald-600">+{fmt(income)}</p>
      </div>
      <div>
        <p className="text-[9px] text-red-400 mb-0.5">{expenseLabel}</p>
        <p className="text-xs font-medium text-red-500">-{fmt(expense)}</p>
      </div>
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Cuối tháng</p>
        <p className={`text-xs font-bold ${closing >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{fmt(closing)}</p>
      </div>
    </div>
  )
}

function InitialBalanceEditor({ value, onChange, saving, onSave, onCancel }: {
  value: string; onChange: (v: string) => void
  saving: boolean; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="mb-2 bg-indigo-50 rounded-lg px-2 py-1.5 flex items-center gap-2">
      <span className="text-[10px] text-indigo-600 shrink-0">Số dư gốc:</span>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSave()}
        autoFocus
        className="flex-1 text-xs border border-indigo-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
        placeholder="0"
      />
      <button onClick={onSave} disabled={saving}
        className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded disabled:opacity-50">
        {saving ? '...' : 'Lưu'}
      </button>
      <button onClick={onCancel} className="text-[10px] text-gray-400">Hủy</button>
    </div>
  )
}
