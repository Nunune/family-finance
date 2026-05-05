import { useState } from 'react'
import { Transaction, TransactionLog } from '../../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface Props {
  transactions: Transaction[]
  onEdit: (t: Transaction) => void
  onDelete: (id: string) => void
  showUser?: boolean
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫'
}

function AuditLog({ logs }: { logs: TransactionLog[] }) {
  const actionLabel: Record<string, string> = {
    created: 'Thêm bởi',
    updated: 'Sửa bởi',
    deleted: 'Xóa bởi',
  }
  return (
    <div className="mt-1 space-y-0.5">
      {logs.map(log => (
        <p key={log.id} className="text-xs text-gray-400">
          {actionLabel[log.action] ?? log.action}{' '}
          <span className="text-gray-500 font-medium">{log.byUserName}</span>
          {' · '}{format(new Date(log.createdAt), 'HH:mm dd/MM', { locale: vi })}
        </p>
      ))}
    </div>
  )
}

export default function TransactionList({ transactions, onEdit, onDelete, showUser }: Props) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  function toggleLog(id: string) {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!transactions.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm">Chưa có giao dịch nào</p>
      </div>
    )
  }

  const grouped: Record<string, Transaction[]> = {}
  transactions.forEach(t => {
    const day = t.date.slice(0, 10)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(t)
  })

  return (
    <div className="space-y-4">
      {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([day, items]) => {
        const dayIncome = items.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
        const dayExpense = items.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

        return (
          <div key={day}>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {format(new Date(day), 'EEEE, dd/MM/yyyy', { locale: vi })}
              </span>
              <div className="flex gap-3 text-xs">
                {dayIncome > 0 && <span className="text-emerald-600">+{formatVND(dayIncome)}</span>}
                {dayExpense > 0 && <span className="text-red-500">-{formatVND(dayExpense)}</span>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {items.map((t, i) => {
                const hasLogs = (t.logs?.length ?? 0) > 0
                const logsOpen = expandedLogs.has(t.id)
                // Giao dịch đã bị sửa nếu có log "updated"
                const wasEdited = t.logs?.some(l => l.action === 'updated')

                return (
                  <div key={t.id} className={`px-4 py-3 hover:bg-gray-50 transition group ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="text-2xl w-9 text-center flex-shrink-0">{t.category.icon}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate">{t.category.name}</span>
                          {showUser && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.user.name}</span>
                          )}
                          {wasEdited && (
                            <span className="text-xs text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full">đã sửa</span>
                          )}
                        </div>
                        {t.note && <p className="text-xs text-gray-400 truncate mt-0.5">{t.note}</p>}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-semibold ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t.type === 'INCOME' ? '+' : '-'}{formatVND(t.amount)}
                        </span>
                        <div className="hidden group-hover:flex gap-1">
                          {hasLogs && (
                            <button
                              onClick={() => toggleLog(t.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1 rounded"
                              title="Lịch sử chỉnh sửa"
                            >
                              {logsOpen ? '▲' : '🕐'}
                            </button>
                          )}
                          <button onClick={() => onEdit(t)} className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-1 rounded">Sửa</button>
                          <button onClick={() => onDelete(t.id)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1 rounded">Xóa</button>
                        </div>
                      </div>
                    </div>

                    {/* Audit log — chỉ hiện khi user tap 🕐 */}
                    {logsOpen && hasLogs && (
                      <div className="mt-2 pl-12 border-t border-gray-50 pt-2">
                        <AuditLog logs={t.logs!} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
