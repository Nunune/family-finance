import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import TransactionList from '../components/Transaction/TransactionList'
import TransactionForm from '../components/Transaction/TransactionForm'
import QuickAdd from '../components/Transaction/QuickAdd'
import type { SubFund, Transaction, Category } from '../types'

const fmtVND = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

interface Props {
  fund: SubFund
  onFundUpdate: (f: SubFund) => void
}

export default function SubFundWalletPage({ fund }: Props) {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [balance, setBalance] = useState(fund.balance)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | undefined>()

  const load = useCallback(async () => {
    if (!fund.wallet?.id) return
    setLoading(true)
    try {
      const [txRes, catRes] = await Promise.all([
        api.get('/transactions', { params: { walletId: fund.wallet.id, page: 0, limit: 50 } }),
        api.get('/transactions/categories/all'),
      ])
      const txs: Transaction[] = txRes.data.transactions ?? txRes.data
      setTransactions(txs)
      setCategories(catRes.data)
      const inc = txs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
      const exp = txs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
      setTotalIncome(inc)
      setTotalExpense(exp)
      setBalance((fund.wallet.initialBalance ?? 0) + inc - exp)
    } finally {
      setLoading(false)
    }
  }, [fund.wallet?.id, fund.wallet?.initialBalance])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!socket || !fund.wallet?.id) return
    const handler = () => load()
    socket.on('transaction:created', handler)
    socket.on('transaction:updated', handler)
    socket.on('transaction:deleted', handler)
    return () => {
      socket.off('transaction:created', handler)
      socket.off('transaction:updated', handler)
      socket.off('transaction:deleted', handler)
    }
  }, [socket, fund.wallet?.id, load])

  const isMember = fund.members.some(m => m.userId === user?.id)

  if (!isMember) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-gray-400">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-sm">Bạn chưa được thêm vào quỹ này</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{fund.icon}</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{fund.name}</h1>
          {fund.description && <p className="text-sm text-gray-400">{fund.description}</p>}
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80 mb-1">Số dư quỹ</p>
        <p className="text-3xl font-bold">{fmtVND(balance)}</p>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <p className="opacity-70">Thu</p>
            <p className="font-semibold">+{fmtVND(totalIncome)}</p>
          </div>
          <div>
            <p className="opacity-70">Chi</p>
            <p className="font-semibold">-{fmtVND(totalExpense)}</p>
          </div>
          <div>
            <p className="opacity-70">Thành viên</p>
            <p className="font-semibold">{fund.members.length} người</p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="flex gap-2 flex-wrap">
        {fund.members.map(m => (
          <div key={m.id} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1">
            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {m.user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-600">{m.user.name}</span>
            {m.role === 'ADMIN' && <span className="text-[10px] text-indigo-400">👑</span>}
          </div>
        ))}
      </div>

      {/* Add transaction button */}
      <button
        onClick={() => { setEditTx(undefined); setShowForm(true) }}
        className="w-full bg-indigo-500 text-white rounded-2xl py-3 text-sm font-medium hover:bg-indigo-600"
      >
        + Thêm giao dịch
      </button>

      {/* Transactions */}
      {loading ? (
        <div className="text-center py-12 text-gray-300 text-3xl animate-pulse">⏳</div>
      ) : (
        <TransactionList
          transactions={transactions}
          onEdit={tx => { setEditTx(tx); setShowForm(true) }}
          onDelete={load}
        />
      )}

      {showForm && (
        <TransactionForm
          walletType="SHARED"
          editing={editTx}
          subFundId={fund.id}
          onSuccess={() => { setShowForm(false); setEditTx(undefined); load() }}
          onCancel={() => { setShowForm(false); setEditTx(undefined) }}
        />
      )}

      {categories.length > 0 && (
        <QuickAdd
          walletType="SHARED"
          categories={categories}
          subFundId={fund.id}
          onSuccess={load}
        />
      )}
    </div>
  )
}
