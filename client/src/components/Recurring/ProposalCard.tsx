import { useState } from 'react'
import { TransactionProposal } from '../../types'
import api from '../../services/api'

interface Props {
  proposal: TransactionProposal
  onConfirmed: (id: string) => void
  onDismissed: (id: string) => void
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function ProposalCard({ proposal, onConfirmed, onDismissed }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const r = proposal.recurring!
  const scheduledDate = new Date(proposal.scheduledDate).toLocaleDateString('vi-VN')
  const typeLabel = proposal.type === 'EXPENSE' ? 'Chi' : 'Thu'
  const typeColor = proposal.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'

  async function confirm() {
    if (code.length !== 4) { setError('Nhập đúng 4 chữ số'); return }
    setError('')
    setLoading(true)
    try {
      await api.post(`/recurring/proposals/${proposal.id}/confirm`, { code })
      onConfirmed(proposal.id)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Lỗi xác nhận')
    } finally {
      setLoading(false)
    }
  }

  async function dismiss() {
    if (!window.confirm('Bỏ qua giao dịch này?')) return
    setLoading(true)
    try {
      await api.post(`/recurring/proposals/${proposal.id}/dismiss`)
      onDismissed(proposal.id)
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{r.title}</span>
            <span className={`text-xs font-medium ${typeColor}`}>
              {typeLabel} · {fmt(proposal.amount)} ₫
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {r.category?.icon} {r.category?.name} · {scheduledDate}
          </p>
          <p className="text-xs text-gray-400">
            Ví: {proposal.walletType === 'SHARED' ? 'Quỹ chung' : 'Cá nhân'}
          </p>
        </div>
        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium shrink-0">Chờ xác nhận</span>
      </div>

      <div className="bg-amber-50 rounded-xl p-3">
        <p className="text-xs text-amber-700 mb-2">
          Nhập mã xác nhận để tạo giao dịch:
          <span className="font-mono font-bold text-lg ml-2 tracking-widest text-amber-800">
            {proposal.confirmationCode}
          </span>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="____"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
            className="w-24 text-center font-mono text-lg tracking-widest border-2 border-amber-300 rounded-xl px-2 py-1.5 focus:outline-none focus:border-amber-500 bg-white"
          />
          <button
            onClick={confirm}
            disabled={loading || code.length !== 4}
            className="flex-1 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-xl disabled:opacity-60 transition">
            {loading ? '...' : 'Xác nhận & Tạo'}
          </button>
          <button
            onClick={dismiss}
            disabled={loading}
            className="px-3 py-1.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition">
            Bỏ qua
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    </div>
  )
}
