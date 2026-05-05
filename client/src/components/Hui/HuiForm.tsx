import { useState } from 'react'
import api from '../../services/api'
function parseAmt(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\s/g, '')
  const m = t.match(/^([\d,.]+)(tr|triệu|m|k|nghìn|nghin)?$/)
  if (!m) return null
  const base = parseFloat(m[1].replace(/,/g, '.'))
  if (isNaN(base)) return null
  const mul = m[2] === 'tr' || m[2] === 'triệu' || m[2] === 'm' ? 1_000_000
    : m[2] === 'k' || m[2] === 'nghìn' || m[2] === 'nghin' ? 1_000 : 1
  return Math.round(base * mul)
}

interface Props {
  onSaved: (hui: any) => void
  onClose: () => void
}

export default function HuiForm({ onSaved, onClose }: Props) {
  const [name, setName] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [totalRounds, setTotalRounds] = useState(12)
  const [myRound, setMyRound] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 7) + '-01')
  const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const amount = parseAmt(amountRaw)
    if (!name.trim()) return setError('Nhập tên hụi')
    if (!amount || amount <= 0) return setError('Nhập số tiền hợp lệ')
    if (myRound < 1 || myRound > totalRounds) return setError(`Kỳ của bạn phải từ 1 đến ${totalRounds}`)

    setSaving(true); setError('')
    try {
      const res = await api.post('/hui', { name: name.trim(), amount, totalRounds, myRound, startDate, frequency })
      onSaved(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Lỗi server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
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
            <label className="text-xs text-gray-500 mb-1 block">Tiền đóng / kỳ</label>
            <input
              type="text" inputMode="numeric" placeholder="500k, 1tr..." value={amountRaw}
              onChange={e => setAmountRaw(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tổng số kỳ</label>
            <input type="number" min={2} max={100} value={totalRounds}
              onChange={e => { const v = parseInt(e.target.value); setTotalRounds(v); if (myRound > v) setMyRound(v) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Kỳ của bạn</label>
            <input type="number" min={1} max={totalRounds} value={myRound}
              onChange={e => setMyRound(parseInt(e.target.value))}
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

        <div className="bg-emerald-50 rounded-xl p-3 text-sm text-emerald-700">
          <p>Tổng đóng: <strong>{((parseAmt(amountRaw) ?? 0) * (totalRounds - 1)).toLocaleString('vi-VN')} ₫</strong></p>
          <p>Hốt được: <strong>{((parseAmt(amountRaw) ?? 0) * totalRounds).toLocaleString('vi-VN')} ₫</strong> vào kỳ {myRound}</p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={submit} disabled={saving}
          className="w-full bg-emerald-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition">
          {saving ? 'Đang lưu...' : 'Tạo hụi'}
        </button>
      </div>
    </div>
  )
}
