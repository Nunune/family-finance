import { useState, useEffect, useCallback } from 'react'
import { WalletType, Transaction, Summary, Category } from '../types'
import api from '../services/api'
import TransactionList from '../components/Transaction/TransactionList'
import TransactionForm from '../components/Transaction/TransactionForm'
import QuickAdd from '../components/Transaction/QuickAdd'
import DailyBarChart from '../components/Charts/DailyBarChart'
import CategoryPieChart from '../components/Charts/CategoryPieChart'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'

interface Props {
  walletType: WalletType
}

function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

export default function WalletPage({ walletType }: Props) {
  const isShared = walletType === 'SHARED'
  const { socket } = useSocket()
  const { user } = useAuth()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(false)

  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, sumRes] = await Promise.all([
        api.get('/transactions', { params: { walletType, startDate, endDate } }),
        api.get('/transactions/summary/stats', { params: { walletType, month, year } }),
      ])
      setTransactions(txRes.data)
      setSummary(sumRes.data)
    } finally { setLoading(false) }
  }, [walletType, startDate, endDate, month, year])

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!socket || !isShared) return
    socket.on('connect', load)
    socket.on('transaction:new', load)
    socket.on('transaction:updated', load)
    socket.on('transaction:deleted', load)
    let pollInterval: ReturnType<typeof setInterval> | null = null
    socket.on('disconnect', () => { pollInterval = setInterval(load, 30_000) })
    socket.on('connect', () => { if (pollInterval) { clearInterval(pollInterval); pollInterval = null } })
    return () => {
      socket.off('connect', load)
      socket.off('transaction:new', load)
      socket.off('transaction:updated', load)
      socket.off('transaction:deleted', load)
      socket.off('disconnect')
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [socket, isShared, load])

  async function handleDelete(id: string) {
    if (!confirm('Xóa giao dịch này?')) return
    await api.delete(`/transactions/${id}`)
    load()
  }

  async function saveInitialBalance() {
    setSavingBalance(true)
    try {
      await api.put('/transactions/wallet/balance', {
        walletType,
        initialBalance: balanceInput.replace(/\./g, '').replace(',', '.'),
      })
      setShowBalanceModal(false)
      load()
    } finally {
      setSavingBalance(false)
    }
  }

  function openBalanceModal() {
    setBalanceInput(summary ? String(summary.initialBalance) : '0')
    setShowBalanceModal(true)
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const canEditBalance = !isShared || user?.role === 'ADMIN'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {isShared ? '🏠 Quỹ chung gia đình' : '👤 Ví cá nhân'}
          </h1>
          {isShared && <p className="text-xs text-gray-400 mt-0.5">Cập nhật theo thời gian thực</p>}
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          Nhập đầy đủ
        </button>
      </div>

      {/* Total wallet balance */}
      {summary && (
        <div className={`rounded-2xl p-5 flex items-center justify-between ${
          summary.walletBalance >= 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-orange-400 to-red-400'
        } text-white`}>
          <div>
            <p className="text-sm opacity-80">Số dư hiện tại</p>
            <p className="text-2xl font-bold mt-0.5">{formatVND(summary.walletBalance)}</p>
            {summary.initialBalance > 0 && (
              <p className="text-xs opacity-70 mt-1">Bao gồm số dư ban đầu: {formatVND(summary.initialBalance)}</p>
            )}
            {summary.initialBalance === 0 && canEditBalance && (
              <p className="text-xs opacity-70 mt-1">Chưa thiết lập số dư ban đầu</p>
            )}
          </div>
          {canEditBalance && (
            <button onClick={openBalanceModal}
              className="bg-white/20 hover:bg-white/30 transition rounded-xl px-3 py-2 text-xs font-medium">
              ⚙ Thiết lập
            </button>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <QuickAdd walletType={walletType} categories={categories} onSuccess={load} />
      )}

      {/* Month nav */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 text-lg px-2">‹</button>
        <span className="text-base font-semibold text-gray-700">Tháng {month}/{year}</span>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 text-lg px-2">›</button>
      </div>

      {/* Monthly summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium mb-1">Thu nhập</p>
            <p className="text-lg font-bold text-emerald-700 truncate">{formatVND(summary.totalIncome)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <p className="text-xs text-red-500 font-medium mb-1">Chi tiêu</p>
            <p className="text-lg font-bold text-red-600 truncate">{formatVND(summary.totalExpense)}</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${summary.balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <p className={`text-xs font-medium mb-1 ${summary.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Tháng này</p>
            <p className={`text-lg font-bold truncate ${summary.balance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{formatVND(summary.balance)}</p>
          </div>
        </div>
      )}

      {/* Charts */}
      {summary && summary.byDay.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thu chi theo ngày</h3>
            <DailyBarChart data={summary.byDay} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Chi tiêu theo danh mục</h3>
            <CategoryPieChart data={summary.byCategory} />
          </div>
        </div>
      )}

      {/* Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Giao dịch</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <TransactionList
            transactions={transactions}
            onEdit={t => { setEditing(t); setShowForm(true) }}
            onDelete={handleDelete}
            showUser={isShared}
          />
        )}
      </div>

      {showForm && (
        <TransactionForm
          walletType={walletType}
          editing={editing}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* Initial balance modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-800">Số dư ban đầu</h2>
            <p className="text-sm text-gray-500">
              Nhập số tiền đã có trước khi dùng app. Giúp tính chính xác số dư hiện tại.
            </p>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Ví dụ: 5.000.000"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowBalanceModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">
                Huỷ
              </button>
              <button onClick={saveInitialBalance} disabled={savingBalance}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium disabled:opacity-60">
                {savingBalance ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
