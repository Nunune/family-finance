import { RecurringTransaction } from '../../types'
import api from '../../services/api'

interface Props {
  items: RecurringTransaction[]
  userId: string
  onUpdate: (r: RecurringTransaction) => void
  onDelete: (id: string) => void
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

const FREQ_LABEL: Record<string, string> = { MONTHLY: 'Hàng tháng', WEEKLY: 'Hàng tuần' }
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

export default function RecurringList({ items, userId, onUpdate, onDelete }: Props) {
  async function toggleActive(r: RecurringTransaction) {
    const { data } = await api.put(`/recurring/${r.id}`, { isActive: !r.isActive })
    onUpdate(data)
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá giao dịch định kỳ này?')) return
    await api.delete(`/recurring/${id}`)
    onDelete(id)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-2">🔄</div>
        <p className="text-sm">Chưa có giao dịch định kỳ</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map(r => {
        const isOwner = r.ownerId === userId
        const dueDate = new Date(r.nextDue)
        const dueLabel = dueDate.toLocaleDateString('vi-VN')
        const reminderDate = new Date(dueDate)
        reminderDate.setDate(reminderDate.getDate() - r.remindDays)
        const reminderLabel = reminderDate.toLocaleDateString('vi-VN')
        const reminderSoon = reminderDate <= new Date()
        const scheduleLabel = r.frequency === 'MONTHLY'
          ? `Ngày ${r.dayOfMonth} hàng tháng`
          : r.dayOfWeek !== undefined ? `${DOW[r.dayOfWeek]} hàng tuần` : FREQ_LABEL[r.frequency]

        return (
          <div key={r.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 transition ${!r.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{r.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.type === 'EXPENSE' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {r.type === 'EXPENSE' ? '−' : '+'} {fmt(r.amount)} ₫
                  </span>
                  {!r.isActive && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Tạm dừng</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.category?.icon} {r.category?.name} · {scheduleLabel}
                </p>
                <p className="text-xs text-gray-400">
                  Lần tới: <span className="text-gray-600 font-medium">{dueLabel}</span>
                </p>
                <p className={`text-xs ${reminderSoon ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                  {reminderSoon
                    ? '⏰ Đang chờ xác nhận — vào Kế hoạch → Chờ XN'
                    : `Nhắc vào: ${reminderLabel} (trước ${r.remindDays} ngày)`
                  }
                </p>
                <p className="text-xs text-gray-400">
                  Ví: {r.walletType === 'SHARED' ? 'Quỹ chung' : 'Cá nhân'}
                </p>
              </div>
              {isOwner && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => toggleActive(r)}
                    className={`text-xs px-3 py-1 rounded-lg border transition ${
                      r.isActive
                        ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}>
                    {r.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                  </button>
                  <button onClick={() => handleDelete(r.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition">
                    Xoá
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
