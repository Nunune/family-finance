import { useEffect, useState } from 'react'
import api from '../../services/api'
import { parseAmount } from '../../utils/amountParser'
import AmountInput from '../shared/AmountInput'
import type { WeeklyBudget, Category } from '../../types'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function BudgetSettingsModal({ onClose, onSaved }: Props) {
  const [budgets, setBudgets] = useState<WeeklyBudget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editing, setEditing] = useState<string | null>(null) // categoryId being edited
  const [form, setForm] = useState({ limitAmount: '', alertPct: 80 })
  const [amountError, setAmountError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/budgets'),
      api.get('/transactions/categories/all'),
    ]).then(([b, c]) => {
      setBudgets(b.data)
      setCategories(c.data.filter((cat: Category) => cat.type === 'EXPENSE' || cat.type === 'BOTH'))
    }).catch(() => {})
  }, [])

  function startEdit(cat: Category) {
    const existing = budgets.find(b => b.categoryId === cat.id)
    setForm({
      limitAmount: existing ? existing.limitAmount.toLocaleString('vi-VN') : '',
      alertPct: existing?.alertPct ?? 80,
    })
    setAmountError('')
    setEditing(cat.id)
  }

  async function save(categoryId: string) {
    const parsed = parseAmount(form.limitAmount)
    if (!parsed || parsed <= 0) {
      setAmountError('Nhập số tiền hợp lệ (vd: 500k, 2tr)')
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/budgets/${categoryId}`, {
        limitAmount: parsed,
        alertPct: form.alertPct,
      })
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.categoryId === categoryId)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = res.data; return next
        }
        return [...prev, res.data]
      })
      setEditing(null)
      onSaved()
    } catch {
      setAmountError('Lưu thất bại, thử lại nhé')
    } finally {
      setSaving(false)
    }
  }

  async function remove(categoryId: string) {
    await api.delete(`/budgets/${categoryId}`)
    setBudgets(prev => prev.filter(b => b.categoryId !== categoryId))
    onSaved()
  }

  const fmtFull = (n: number) => n.toLocaleString('vi-VN') + ' ₫'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">🎯 Ngân sách theo tuần</h2>
            <p className="text-xs text-gray-400 mt-0.5">Đặt giới hạn chi tiêu cho từng danh mục</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {categories.map(cat => {
            const budget = budgets.find(b => b.categoryId === cat.id)
            const isEditing = editing === cat.id

            return (
              <div key={cat.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{cat.name}</p>
                    {budget && !isEditing && (
                      <p className="text-xs text-gray-400">
                        Giới hạn: {fmtFull(budget.limitAmount)} · Cảnh báo khi &gt;{budget.alertPct}%
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(cat)}
                        className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      >
                        {budget ? 'Sửa' : '+ Đặt'}
                      </button>
                    )}
                    {budget && !isEditing && (
                      <button
                        onClick={() => remove(cat.id)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                      >
                        Xoá
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Giới hạn chi tiêu / tuần</label>
                      <AmountInput
                        value={form.limitAmount}
                        onChange={v => { setForm(f => ({ ...f, limitAmount: v })); setAmountError('') }}
                      />
                      {amountError && <p className="text-xs text-red-500 mt-1">{amountError}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        Cảnh báo khi đạt {form.alertPct}% giới hạn
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={form.alertPct}
                        onChange={e => setForm(f => ({ ...f, alertPct: Number(e.target.value) }))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>10%</span>
                        <span className="font-medium text-indigo-600">{form.alertPct}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => save(cat.id)}
                        disabled={saving}
                        className="flex-1 bg-indigo-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
                      >
                        {saving ? 'Đang lưu...' : 'Lưu ngân sách'}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-4 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
                      >
                        Huỷ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
