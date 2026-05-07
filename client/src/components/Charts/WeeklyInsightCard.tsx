import { useEffect, useState } from 'react'
import api from '../../services/api'
import BudgetSettingsModal from './BudgetSettingsModal'
import type { WeeklySummary, WeeklyCategorySummary, BenchmarkType } from '../../types'

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'tr'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return n.toLocaleString('vi-VN')
}
const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

const ALERT_CONFIG = {
  HIGH: {
    bg: 'bg-red-50 border-red-200',
    icon: '🔴',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    bar: 'bg-red-400',
  },
  MODERATE: {
    bg: 'bg-amber-50 border-amber-200',
    icon: '🟡',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-400',
  },
  NORMAL: {
    bg: 'bg-white border-gray-100',
    icon: '🟢',
    text: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-600',
    bar: 'bg-emerald-400',
  },
  GOOD: {
    bg: 'bg-emerald-50 border-emerald-100',
    icon: '💚',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-400',
  },
}

// Fun/witty Vietnamese budget alert messages
const FUN_BUDGET_MSGS: Record<string, { EXCEEDED: string[]; WARNING: string[] }> = {
  'Ăn uống': {
    EXCEEDED: [
      '🍲 No đến mức ngân sách cũng no rồi! Tuần sau cơm nhà thôi nhé~',
      '😋 Dạ dày đang thắng, ví đang thua. Tỉ số hiện tại: 1-0 cho bụng!',
    ],
    WARNING: [
      '🍜 Ví đang hơi buồn vì bếp quá hot tuần này...',
      '🍱 Sắp chạm trần ngân sách ăn uống rồi! Kiếm mấy bữa cơm nhà thôi!',
    ],
  },
  'Di chuyển': {
    EXCEEDED: [
      '🚗 Bánh xe quay nhiều quá, ví thủng rồi kìa!',
      '⛽ Xăng xe tuần này đang đốt cháy cả ngân sách luôn!',
    ],
    WARNING: [
      '🛵 Đi ít thôi nha, gần chạm mức cảnh báo di chuyển rồi!',
      '🚌 Thử đi xe buýt vài bữa cho ví thở với~',
    ],
  },
  'Mua sắm': {
    EXCEEDED: [
      '🛍️ Túi mua sắm nặng bằng... nợ rồi! Dừng tay thôi!',
      '💳 Thẻ đang kêu cứu, ngân sách mua sắm out rồi!',
    ],
    WARNING: [
      '🛒 Giỏ hàng đang khá nặng đó, gần tới giới hạn rồi!',
      '🏷️ Đợt sale nào hấp dẫn quá đúng không? Nhớ là ví có hạn nha!',
    ],
  },
  'Giải trí': {
    EXCEEDED: [
      '🎮 Vui quá mà quên mất ví đang khóc kìa!',
      '🎬 Chill nhiều quá rồi, ngân sách giải trí đã full!',
    ],
    WARNING: [
      '🎭 Vui vẻ vừa vừa thôi nha, sắp chạm ngưỡng cảnh báo rồi!',
      '🍿 Còn một chút nữa là hết ngân sách giải trí — cân nhắc nhé!',
    ],
  },
  'Sức khoẻ': {
    EXCEEDED: [
      '💊 Đầu tư sức khoẻ nhiều quá, ví cũng cần chăm sóc đó!',
      '🏥 Ngân sách y tế vượt mức rồi, cố gắng khoẻ thêm nhé!',
    ],
    WARNING: [
      '🩺 Sắp chạm giới hạn sức khoẻ tuần này — hy vọng là đang khoẻ hơn!',
      '💪 Khoẻ mạnh thì tốt, nhưng đừng quên ngân sách cũng cần "khoẻ"!',
    ],
  },
}

const GENERIC_BUDGET_MSGS = {
  EXCEEDED: [
    '💸 Ví đang kêu cứu! Danh mục này vượt ngân sách rồi~',
    '🔥 Ngân sách bốc khói! Danh mục này đã quá giới hạn!',
    '😅 Hơi quá tay rồi! Tuần sau kiềm chế lại nhé!',
  ],
  WARNING: [
    '⚠️ Gần chạm giới hạn rồi, cẩn thận thêm chút nha!',
    '🎯 Gần tới ngưỡng cảnh báo — nước đến chân rồi đó!',
    '📊 Ngân sách tuần này còn ít thôi, chi cẩn thận nha!',
  ],
}

function getFunBudgetMsg(catName: string, status: 'EXCEEDED' | 'WARNING'): string {
  const pool = FUN_BUDGET_MSGS[catName]?.[status] ?? GENERIC_BUDGET_MSGS[status]
  return pool[Math.floor(Math.random() * pool.length)]
}

const BENCHMARK_LABEL: Record<BenchmarkType, string> = {
  HISTORY: 'TB 3 tuần trước',
  MONTHLY_BUDGET: 'Ngân sách ÷ 4',
  MONTHLY_ACTUAL: 'Chi tháng ÷ 4',
}

const BENCHMARK_DETAIL: Record<BenchmarkType, string> = {
  HISTORY: 'Mốc = trung bình 3 tuần gần nhất',
  MONTHLY_BUDGET: 'Mốc = ngân sách tháng chia 4',
  MONTHLY_ACTUAL: 'Mốc = tổng chi tháng này chia 4',
}

function generalAlertMessage(alert: WeeklySummary['alert'], ratio: number, benchmarkType: BenchmarkType): string {
  if (!alert) return ''
  const pct = Math.round(Math.abs(ratio - 1) * 100)
  const HIGH = [
    `🔥 Chi tiêu tuần này cao hơn ${pct}% so với mốc — ví đang bốc khói rồi!`,
    `💸 Tiền bay đi đâu hết ${pct}% so với mốc vậy? Kiểm tra lại thôi!`,
  ]
  const MODERATE = [
    `📈 Chi tiêu tuần này cao hơn ${pct}% so với mốc — hơi nhiều đó!`,
    `🟡 Tốc độ tiêu tiền đang tăng ${pct}% so với mốc — chú ý chút nha!`,
  ]
  const GOOD = [
    `🏆 Tuần này tiết kiệm hơn ${pct}%! Vô địch tiết kiệm rồi!`,
    `💚 Ví đang mỉm cười với bạn! Tiết kiệm được ${pct}% so với mốc!`,
  ]
  if (alert === 'HIGH') return HIGH[Math.floor(Math.random() * HIGH.length)]
  if (alert === 'MODERATE') return MODERATE[Math.floor(Math.random() * MODERATE.length)]
  if (alert === 'GOOD') return GOOD[Math.floor(Math.random() * GOOD.length)]
  return 'Chi tiêu tuần này bình thường 👍'
}

function BudgetBar({ cat }: { cat: WeeklyCategorySummary }) {
  if (!cat.budget) return null
  const pct = Math.min(cat.usedPct ?? 0, 100)
  const isOver = (cat.usedPct ?? 0) > 100
  const isWarn = cat.budgetStatus === 'WARNING'

  return (
    <div className="mt-1">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className={isOver ? 'text-red-500 font-medium' : isWarn ? 'text-amber-600' : 'text-gray-400'}>
          {cat.usedPct ?? 0}% ngân sách
        </span>
        <span className="text-gray-400">{fmtFull(cat.budget.limitAmount)}/tuần</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isOver && (
        <p className="text-[10px] text-red-500 mt-0.5">
          Vượt {fmtFull((cat.usedPct! / 100) * cat.budget.limitAmount - cat.budget.limitAmount)} so với giới hạn
        </p>
      )}
    </div>
  )
}

export default function WeeklyInsightCard({ walletType = 'PERSONAL' }: { walletType?: string }) {
  const [data, setData] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [alertMsgCache] = useState(() => new Map<string, string>())

  function load() {
    api.get('/transactions/summary/weekly', { params: { walletType } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [walletType])

  function getAlertMsg(key: string, gen: () => string): string {
    if (!alertMsgCache.has(key)) alertMsgCache.set(key, gen())
    return alertMsgCache.get(key)!
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 h-32 flex items-center justify-center text-gray-300 text-sm">
      Đang tải...
    </div>
  )

  if (!data || (data.thisWeek === 0 && data.avgExpense === 0 && data.topCategories.every(c => !c.budget))) return null

  const cfg = ALERT_CONFIG[data.alert ?? 'NORMAL']
  const maxExpense = Math.max(...data.weeks.map(w => w.expense), 1)

  const exceededCats = data.topCategories.filter(c => c.budgetStatus === 'EXCEEDED')
  const warnCats = data.topCategories.filter(c => c.budgetStatus === 'WARNING')

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm">📊 Chi tiêu theo tuần</h2>
        <div className="flex items-center gap-2">
          {data.alert && (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.badge}`}>
              {cfg.icon} {data.alert === 'HIGH' ? 'Khét ví rồi!' : data.alert === 'MODERATE' ? 'Ví sắp cháy' : data.alert === 'GOOD' ? 'Sắp giàu rồi' : 'Quá ổn áp'}
            </span>
          )}
          {walletType === 'PERSONAL' && (
            <button
              onClick={() => setShowBudgetModal(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/60 text-gray-400 hover:text-indigo-500 transition-colors"
              title="Cài ngân sách"
            >
              ⚙️
            </button>
          )}
        </div>
      </div>

      {/* Bar chart */}
      {data.weeks.some(w => w.expense > 0) && (
        <div className="flex items-end gap-2 h-20">
          {data.weeks.map(week => {
            const heightPct = maxExpense > 0 ? (week.expense / maxExpense) * 100 : 0
            const isCurrent = week.weeksAgo === 0
            return (
              <div key={week.weeksAgo} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400 font-medium leading-none">
                  {week.expense > 0 ? fmt(week.expense) : '—'}
                </span>
                <div className="w-full flex items-end" style={{ height: 48 }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      isCurrent ? 'bg-red-400' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.max(heightPct, week.expense > 0 ? 8 : 0)}%` }}
                  />
                </div>
                <span className={`text-[10px] leading-none text-center ${isCurrent ? 'font-bold text-gray-700' : 'text-gray-400'}`}>
                  {week.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Overall alert message */}
      {data.alert && data.alert !== 'NORMAL' && data.thisWeek > 0 && (
        <p className={`text-xs ${cfg.text} leading-relaxed`}>
          {getAlertMsg('overall', () => generalAlertMessage(data.alert, data.ratio, data.benchmarkType))}
        </p>
      )}

      {/* Budget breach alerts */}
      {exceededCats.length > 0 && (
        <div className="space-y-1">
          {exceededCats.map(cat => (
            <div key={cat.categoryId} className="flex items-start gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">{cat.icon}</span>
              <p className="text-xs text-red-700 leading-relaxed">
                {getAlertMsg(`exceeded-${cat.categoryId}`, () => getFunBudgetMsg(cat.name, 'EXCEEDED'))}
              </p>
            </div>
          ))}
        </div>
      )}
      {warnCats.length > 0 && exceededCats.length === 0 && (
        <div className="space-y-1">
          {warnCats.slice(0, 2).map(cat => (
            <div key={cat.categoryId} className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">{cat.icon}</span>
              <p className="text-xs text-amber-700 leading-relaxed">
                {getAlertMsg(`warn-${cat.categoryId}`, () => getFunBudgetMsg(cat.name, 'WARNING'))}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Benchmark progress block */}
      {data.benchmarkAmount > 0 && data.thisWeek > 0 && (
        <div className="rounded-xl bg-white/60 border border-white/80 px-3 py-2.5 space-y-2">
          {/* Top row: this week vs benchmark */}
          <div className="flex items-end justify-between text-xs">
            <div>
              <p className="text-gray-400 text-[10px]">Tuần này</p>
              <p className={`font-bold text-sm ${cfg.text}`}>{fmtFull(data.thisWeek)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-[10px]">Mốc</p>
              <p className="font-bold text-gray-600 text-sm">{fmtFull(data.benchmarkAmount)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.ratio >= 1.0 ? 'bg-red-400' : data.ratio >= 0.9 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(data.ratio * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={
                data.ratio >= 1.0 ? 'text-red-500 font-semibold' :
                data.ratio >= 0.9 ? 'text-amber-600 font-semibold' : 'text-gray-400'
              }>
                {Math.round(data.ratio * 100)}% mốc
                {data.ratio >= 1.0 && ' — Vượt mức!'}
                {data.ratio >= 0.9 && data.ratio < 1.0 && ' — Gần chạm!'}
              </span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                data.benchmarkType === 'HISTORY' ? 'bg-indigo-50 text-indigo-500' :
                data.benchmarkType === 'MONTHLY_BUDGET' ? 'bg-emerald-50 text-emerald-600' :
                'bg-gray-100 text-gray-500'
              }`}>
                {BENCHMARK_DETAIL[data.benchmarkType]}
              </span>
            </div>
          </div>

          {/* Projected */}
          {data.projectedWeek > 0 && data.daysElapsed < 7 && (
            <p className={`text-[10px] ${data.projectedWeek > data.benchmarkAmount ? 'text-amber-600' : 'text-gray-400'}`}>
              Dự kiến cả tuần: ~{fmtFull(data.projectedWeek)}
            </p>
          )}
        </div>
      )}

      {/* Stats row khi chưa có benchmark */}
      {!(data.benchmarkAmount > 0) && data.thisWeek > 0 && data.avgExpense > 0 && (
        <div className="flex gap-4 text-xs">
          <div>
            <p className="text-gray-400">Tuần này</p>
            <p className={`font-bold ${cfg.text}`}>{fmtFull(data.thisWeek)}</p>
          </div>
          <div>
            <p className="text-gray-400">Trung bình/tuần</p>
            <p className="font-bold text-gray-600">{fmtFull(data.avgExpense)}</p>
          </div>
        </div>
      )}

      {/* Categories with budget bars */}
      {data.topCategories.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs text-gray-400 font-medium">
            {data.topCategories.some(c => c.budget) ? 'Theo dõi ngân sách' : 'Danh mục nhiều nhất tuần này'}
          </p>
          {data.topCategories.map(cat => {
            const maxAmt = Math.max(...data.topCategories.map(c => c.amount), 1)
            const barWidth = cat.amount > 0 ? Math.round((cat.amount / maxAmt) * 100) : 0
            return (
              <div key={cat.categoryId}>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-5 shrink-0">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-600 truncate">{cat.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {cat.budgetStatus === 'EXCEEDED' && <span className="text-[10px] font-bold text-red-500">VƯỢT!</span>}
                        {cat.budgetStatus === 'WARNING' && <span className="text-[10px] font-bold text-amber-500">GẦN!</span>}
                        <span className="text-xs font-medium text-gray-700">{cat.amount > 0 ? fmtFull(cat.amount) : '—'}</span>
                      </div>
                    </div>
                    {cat.budget ? (
                      <BudgetBar cat={cat} />
                    ) : (
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {walletType === 'PERSONAL' && !data.topCategories.some(c => c.budget) && (
            <button
              onClick={() => setShowBudgetModal(true)}
              className="w-full text-xs text-indigo-500 py-2 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              + Đặt ngân sách tuần để theo dõi tốt hơn
            </button>
          )}
        </div>
      )}

      {showBudgetModal && (
        <BudgetSettingsModal
          onClose={() => setShowBudgetModal(false)}
          onSaved={() => { load() }}
        />
      )}
    </div>
  )
}
