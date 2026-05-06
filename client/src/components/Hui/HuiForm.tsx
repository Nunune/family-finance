import { useState, useEffect } from 'react'
import api from '../../services/api'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'
import type { WalletInfo } from '../../types'

interface Props {
  onSaved: (hui: any) => void
  onClose: () => void
}

export default function HuiForm({ onSaved, onClose }: Props) {
  const [name, setName] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [totalRounds, setTotalRounds] = useState(12)
  const [myRounds, setMyRounds] = useState<number[]>([1])
  const [roundInput, setRoundInput] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY')
  const [organizerFeeRaw, setOrganizerFeeRaw] = useState('')
  const [walletId, setWalletId] = useState<string>('')
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/wallets').then(r => setWallets(r.data)).catch(() => {})
  }, [])

  function addRound() {
    const n = parseInt(roundInput)
    if (!n || n < 1 || n > totalRounds) return
    if (!myRounds.includes(n)) {
      setMyRounds(prev => [...prev, n].sort((a, b) => a - b))
    }
    setRoundInput('')
  }

  function roundDate(roundNo: number): string {
    const base = new Date(startDate)
    if (frequency === 'MONTHLY') {
      base.setMonth(base.getMonth() + roundNo - 1)
    } else {
      base.setDate(base.getDate() + (roundNo - 1) * 7)
    }
    return base.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })
  }

  function removeRound(n: number) {
    setMyRounds(prev => prev.filter(r => r !== n))
  }

  async function submit() {
    const amount = parseAmount(amountRaw)
    if (!name.trim()) return setError('Nhập tên hụi')
    if (!amount || amount <= 0) return setError('Nhập số tiền hợp lệ (vd: 500k, 1tr)')
    if (myRounds.length === 0) return setError('Cần ít nhất 1 kỳ hốt')
    if (myRounds.some(r => r < 1 || r > totalRounds)) return setError(`Kỳ hốt phải từ 1 đến ${totalRounds}`)

    const organizerFee = myRounds.includes(1) ? (parseAmount(organizerFeeRaw) ?? null) : null

    setSaving(true); setError('')
    try {
      const res = await api.post('/hui', { name: name.trim(), amount, totalRounds, myRounds, startDate, frequency, organizerFee, walletId: walletId || null })
      onSaved(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Lỗi server')
    } finally {
      setSaving(false)
    }
  }

  const baseAmount = parseAmount(amountRaw) ?? 0
  const slots = myRounds.length
  // Tổng đóng ≈ (số kỳ không hốt) × số suất × giá gốc
  const totalPay = (totalRounds - slots) * slots * baseAmount

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">🔄 Thêm hụi mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tên hụi</label>
          <input
            type="text" placeholder="Hụi cơ quan, Hụi xóm..." value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tiền đóng / kỳ / suất</label>
            <AmountInput
              value={amountRaw}
              onChange={setAmountRaw}
              placeholder="500k, 1tr..."
              chipSet={['500k', '1tr', '1tr5', '2tr', '3tr', '5tr']}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Chu kỳ</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="MONTHLY">Hàng tháng</option>
              <option value="WEEKLY">Hàng tuần</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tổng số kỳ</label>
            <input type="number" min={2} max={100} value={totalRounds}
              onChange={e => {
                const v = parseInt(e.target.value)
                setTotalRounds(v)
                setMyRounds(prev => prev.filter(r => r <= v))
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ngày bắt đầu</label>
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </div>

        {/* Kỳ hốt — multi-slot */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Kỳ hốt <span className="text-gray-400">(nhiều suất được)</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
            {myRounds.map(n => (
              <span key={n} className="inline-flex flex-col bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1">
                  Kỳ {n}
                  <button type="button" onClick={() => removeRound(n)} className="hover:text-red-500 leading-none">✕</button>
                </span>
                <span className="text-[10px] text-indigo-400 leading-tight">{roundDate(n)}</span>
              </span>
            ))}
            {myRounds.length === 0 && <span className="text-xs text-gray-400 italic">Chưa chọn kỳ nào</span>}
          </div>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                type="number" min={1} max={totalRounds} value={roundInput}
                onChange={e => setRoundInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRound()}
                placeholder={`1 – ${totalRounds}`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {roundInput && parseInt(roundInput) >= 1 && parseInt(roundInput) <= totalRounds && (
                <p className="text-[11px] text-indigo-400 mt-0.5 pl-1">
                  Kỳ {roundInput} = {roundDate(parseInt(roundInput))}
                </p>
              )}
            </div>
            <button type="button" onClick={addRound}
              className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-200 transition">
              + Thêm
            </button>
          </div>
        </div>

        {wallets.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Đồng bộ vào ví <span className="text-gray-400">(tuỳ chọn)</span></label>
            <select value={walletId} onChange={e => setWalletId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">— Không đồng bộ —</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name ?? w.currency} ({w.currency}) · {w.balance.toLocaleString('vi-VN')} ₫
                </option>
              ))}
            </select>
            {walletId && <p className="text-[11px] text-emerald-600 mt-1">✓ Mỗi lần tick đóng/hốt sẽ tự tạo giao dịch trong ví này</p>}
          </div>
        )}

        {myRounds.includes(1) && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tiền công thảo hụi <span className="text-gray-400">(tuỳ chọn, kỳ 1)</span></label>
            <AmountInput
              value={organizerFeeRaw}
              onChange={setOrganizerFeeRaw}
              placeholder="100k, 200k..."
              chipSet={['50k', '100k', '150k', '200k', '500k']}
            />
          </div>
        )}

        {/* Preview */}
        {baseAmount > 0 && myRounds.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-700 space-y-1">
            <p>Tổng đóng (ước tính): <strong>{totalPay.toLocaleString('vi-VN')} ₫</strong>
              {slots > 1 && <span className="text-xs text-emerald-500"> ({slots} suất × {totalRounds - slots} kỳ)</span>}
            </p>
            {myRounds.map(mr => {
              const collect = baseAmount * totalRounds - (mr === 1 ? (parseAmount(organizerFeeRaw) ?? 0) : 0)
              return (
                <p key={mr}>
                  Hốt kỳ {mr}: <strong>~{collect.toLocaleString('vi-VN')} ₫</strong>
                  {mr === 1 && parseAmount(organizerFeeRaw) ? ` (trừ ${parseAmount(organizerFeeRaw)!.toLocaleString('vi-VN')} ₫ công thảo)` : ''}
                </p>
              )
            })}
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={submit} disabled={saving}
          className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
          {saving ? 'Đang lưu...' : 'Tạo hụi'}
        </button>
      </div>
    </div>
  )
}
