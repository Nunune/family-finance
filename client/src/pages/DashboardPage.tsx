import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Summary, Category, TransactionProposal } from '../types'
import DailyBarChart from '../components/Charts/DailyBarChart'
import CategoryPieChart from '../components/Charts/CategoryPieChart'
import WeeklyInsightCard from '../components/Charts/WeeklyInsightCard'
import QuickAdd from '../components/Transaction/QuickAdd'
import { useNavigate } from 'react-router-dom'

function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [personal, setPersonal] = useState<Summary | null>(null)
  const [shared, setShared] = useState<Summary | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [proposals, setProposals] = useState<TransactionProposal[]>([])
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const loadStats = useCallback(() => {
    api.get('/transactions/summary/stats', { params: { walletType: 'PERSONAL', month, year } })
      .then(r => setPersonal(r.data)).catch(() => {})

    if (user?.familyId) {
      api.get('/transactions/summary/stats', { params: { walletType: 'SHARED', month, year } })
        .then(r => setShared(r.data)).catch(() => {})
    }
  }, [user, month, year])

  useEffect(() => { loadStats() }, [loadStats])

  useEffect(() => {
    api.get('/transactions/categories/all').then(r => setCategories(r.data)).catch(() => {})
    api.get('/recurring/proposals').then(r => setProposals(r.data)).catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Xin chào, {user?.name} 👋</h1>
        <p className="text-gray-500 text-sm">Tháng {month}/{year}</p>
      </div>

      {proposals.length > 0 && (
        <button
          onClick={() => navigate('/plans')}
          className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 hover:bg-amber-100 transition text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⏰</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {proposals.length} giao dịch định kỳ chờ xác nhận
              </p>
              <p className="text-xs text-amber-600">
                {proposals.map(p => p.recurring?.title).filter(Boolean).slice(0, 2).join(', ')}
                {proposals.length > 2 ? `...` : ''}
              </p>
            </div>
          </div>
          <span className="text-amber-600 text-sm font-medium shrink-0">Duyệt →</span>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:shadow-md transition" onClick={() => navigate('/personal')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">👤 Ví cá nhân</h2>
            <span className="text-xs text-emerald-600 font-medium">Xem chi tiết →</span>
          </div>
          {personal ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Thu</p>
                  <p className="text-sm font-bold text-emerald-600 truncate">{formatVND(personal.totalIncome)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Chi</p>
                  <p className="text-sm font-bold text-red-500 truncate">{formatVND(personal.totalExpense)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Số dư</p>
                  <p className={`text-sm font-bold truncate ${(personal.walletBalance ?? personal.balance) >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{formatVND(personal.walletBalance ?? personal.balance)}</p>
                </div>
              </div>
              <DailyBarChart data={personal.byDay} />
            </>
          ) : <div className="h-32 flex items-center justify-center text-gray-300 text-sm">Đang tải...</div>}
        </div>

        {/* Shared summary */}
        {user?.familyId ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:shadow-md transition" onClick={() => navigate('/shared')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">🏠 Quỹ chung</h2>
              <span className="text-xs text-emerald-600 font-medium">Xem chi tiết →</span>
            </div>
            {shared ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Thu</p>
                    <p className="text-sm font-bold text-emerald-600 truncate">{formatVND(shared.totalIncome)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Chi</p>
                    <p className="text-sm font-bold text-red-500 truncate">{formatVND(shared.totalExpense)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Số dư</p>
                    <p className={`text-sm font-bold truncate ${(shared.walletBalance ?? shared.balance) >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{formatVND(shared.walletBalance ?? shared.balance)}</p>
                  </div>
                </div>
                <DailyBarChart data={shared.byDay} />
              </>
            ) : <div className="h-32 flex items-center justify-center text-gray-300 text-sm">Đang tải...</div>}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md transition" onClick={() => navigate('/family')}>
            <div className="text-4xl mb-3">👨‍👩‍👧‍👦</div>
            <h2 className="font-semibold text-gray-800 mb-1">Tham gia gia đình</h2>
            <p className="text-sm text-gray-500">Tạo hoặc tham gia nhóm để quản lý quỹ chung</p>
            <span className="mt-3 text-sm text-emerald-600 font-medium">Thiết lập ngay →</span>
          </div>
        )}
      </div>

      {/* Weekly insight */}
      <WeeklyInsightCard walletType="PERSONAL" />

      {/* Category breakdown */}
      {personal && personal.byCategory.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Chi tiêu cá nhân theo danh mục</h2>
          <CategoryPieChart data={personal.byCategory} />
        </div>
      )}

      <QuickAdd walletType="PERSONAL" categories={categories} onSuccess={loadStats} />
    </div>
  )
}
