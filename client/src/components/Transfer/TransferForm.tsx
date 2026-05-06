import { useEffect, useState } from 'react'
import api from '../../services/api'
import type { TransferWallet } from '../../types'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'

interface Props {
  onSuccess: () => void
  onClose: () => void
}

export default function TransferForm({ onSuccess, onClose }: Props) {
  const [wallets, setWallets] = useState<TransferWallet[]>([])
  const [fromKey, setFromKey] = useState('')
  const [toKey, setToKey] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/transfers/wallets').then(r => {
      setWallets(r.data)
      if (r.data.length >= 2) {
        setFromKey(r.data[0].key)
        setToKey(r.data[1].key)
      }
    })
  }, [])

  async function submit() {
    const amount = parseAmount(amountRaw)
    if (!amount || amount <= 0) return setError('Nhập số tiền hợp lệ')
    if (!fromKey || !toKey) return setError('Chọn ví nguồn và ví đích')
    if (fromKey === toKey) return setError('Ví nguồn và ví đích không được trùng')

    const from = wallets.find(w => w.key === fromKey)!
    const to = wallets.find(w => w.key === toKey)!

    setSaving(true)
    setError('')
    try {
      await api.post('/transfers', {
        fromWalletType: from.walletType,
        fromSubFundId: from.subFundId,
        toWalletType: to.walletType,
        toSubFundId: to.subFundId,
        amount,
        date,
        note: note || undefined,
      })
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Lỗi khi chuyển tiền')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">↔ Chuyển tiền giữa ví</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Từ ví</label>
            <select
              value={fromKey}
              onChange={e => setFromKey(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {wallets.map(w => (
                <option key={w.key} value={w.key}>{w.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Đến ví</label>
            <select
              value={toKey}
              onChange={e => setToKey(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {wallets.filter(w => w.key !== fromKey).map(w => (
                <option key={w.key} value={w.key}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền</label>
          <AmountInput value={amountRaw} onChange={setAmountRaw} />
        </div>

        {/* Date + Note */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ngày</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
            <input
              type="text"
              placeholder="Góp quỹ tháng 5..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="w-full bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
        >
          {saving ? 'Đang chuyển...' : 'Chuyển tiền'}
        </button>
      </div>
    </div>
  )
}
