import { useState, useEffect, useCallback } from 'react'
import { WalletType, Transaction, Summary, Category, WalletPocket } from '../types'
import api from '../services/api'
import TransactionList from '../components/Transaction/TransactionList'
import TransactionForm from '../components/Transaction/TransactionForm'
import QuickAdd from '../components/Transaction/QuickAdd'
import DailyBarChart from '../components/Charts/DailyBarChart'
import CategoryPieChart from '../components/Charts/CategoryPieChart'
import WeeklyInsightCard from '../components/Charts/WeeklyInsightCard'
import PocketManager from '../components/Pocket/PocketManager'
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
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [pockets, setPockets] = useState<WalletPocket[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showPocketManager, setShowPocketManager] = useState(false)

  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)
  const [exporting, setExporting] = useState(false)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    setPage(0)
    try {
      const [txRes, sumRes] = await Promise.all([
        api.get('/transactions', { params: { walletType, startDate, endDate, page: 0, limit: 50 } }),
        api.get('/transactions/summary/stats', { params: { walletType, month, year } }),
      ])
      setTransactions(txRes.data.transactions)
      setHasMore(txRes.data.hasMore)
      setSummary(sumRes.data)
    } finally { setLoading(false) }
  }, [walletType, startDate, endDate, month, year])

  async function loadMore() {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await api.get('/transactions', { params: { walletType, startDate, endDate, page: nextPage, limit: 50 } })
      setTransactions(prev => [...prev, ...res.data.transactions])
      setHasMore(res.data.hasMore)
      setPage(nextPage)
    } finally { setLoadingMore(false) }
  }

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data))
    if (!isShared) api.get('/pockets').then(r => setPockets(r.data))
  }, [isShared])

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

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/transactions/export/csv', {
        params: { walletType, startDate, endDate },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      const cd = res.headers['content-disposition'] ?? ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.href = url
      a.download = match?.[1] ?? `giao-dich-${month}-${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
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
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 space-y-6">
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
      {summary && (() => {
        const hiddenBalance = !isShared
          ? pockets.filter(p => p.isHidden).reduce((s, p) => s + p.balance, 0)
          : 0
        const availableBalance = summary.walletBalance - hiddenBalance
        return (
          <div className={`rounded-2xl p-5 ${
            summary.walletBalance >= 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-orange-400 to-red-400'
          } text-white`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-80">{hiddenBalance > 0 ? 'Tổng số dư' : 'Số dư hiện tại'}</p>
                <p className="text-2xl font-bold mt-0.5">{formatVND(summary.walletBalance)}</p>
                {hiddenBalance > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs opacity-70">
                      🔒 Đã ẩn: {formatVND(hiddenBalance)} ({pockets.filter(p => p.isHidden).map(p => p.name).join(', ')})
                    </p>
                    <p className="text-sm font-semibold opacity-90">
                      Khả dụng: {formatVND(availableBalance)}
                    </p>
                  </div>
                )}
                {summary.initialBalance === 0 && canEditBalance && (
                  <p className="text-xs opacity-70 mt-1">Chưa thiết lập số dư ban đầu</p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                {canEditBalance && (
                  <button onClick={openBalanceModal}
                    className="bg-white/20 hover:bg-white/30 transition rounded-xl px-3 py-2 text-xs font-medium">
                    ⚙ Thiết lập
                  </button>
                )}
                {!isShared && (
                  <button onClick={() => setShowPocketManager(true)}
                    className="bg-white/20 hover:bg-white/30 transition rounded-xl px-3 py-2 text-xs font-medium">
                    🗂 Ví tiền
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pocket cards — personal only */}
      {!isShared && pockets.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {pockets.map(pocket => (
            <div
              key={pocket.id}
              className="shrink-0 bg-white rounded-2xl border border-gray-100 p-3 w-36 cursor-pointer hover:border-gray-200 transition"
              onClick={() => setShowPocketManager(true)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{pocket.icon}</span>
                {pocket.isHidden && <span className="text-gray-400 text-xs">🔒</span>}
              </div>
              <p className="text-xs text-gray-500 truncate">{pocket.name}</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5"
                style={{ color: pocket.balance < 0 ? '#EF4444' : undefined }}>
                {pocket.balance.toLocaleString('vi-VN')}₫
              </p>
            </div>
          ))}
          <button
            onClick={() => setShowPocketManager(true)}
            className="shrink-0 w-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-emerald-300 hover:text-emerald-400 transition text-2xl"
          >
            +
          </button>
        </div>
      )}

      {categories.length > 0 && (
        <QuickAdd walletType={walletType} categories={categories} onSuccess={load} />
      )}

      {/* Month nav */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={prevMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">‹</button>
        <span className="text-base font-semibold text-gray-700 min-w-[120px] text-center">Tháng {month}/{year}</span>
        <button onClick={nextMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 text-xl font-bold transition-all">›</button>
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

      {/* Weekly insight */}
      <WeeklyInsightCard walletType={walletType} />

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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Giao dịch</h3>
          {transactions.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 border border-gray-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50"
            >
              <span>⬇</span>
              {exporting ? 'Đang xuất...' : 'Xuất CSV'}
            </button>
          )}
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Đang tải...</div>
        ) : (
          <>
            <TransactionList
              transactions={transactions}
              onEdit={t => { setEditing(t); setShowForm(true) }}
              onDelete={handleDelete}
              showUser={isShared}
            />
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full mt-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {loadingMore ? 'Đang tải...' : 'Xem thêm'}
              </button>
            )}
          </>
        )}
      </div>

      {showForm && (
        <TransactionForm
          walletType={walletType}
          pockets={pockets}
          editing={editing}
          onSuccess={() => { setShowForm(false); setEditing(null); load() }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {showPocketManager && (
        <PocketManager
          pockets={pockets}
          onCreate={p => setPockets(prev => [...prev, p])}
          onUpdate={p => setPockets(prev => prev.map(x => x.id === p.id ? p : x))}
          onDelete={id => setPockets(prev => prev.filter(x => x.id !== id))}
          onClose={() => setShowPocketManager(false)}
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
