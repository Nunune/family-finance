import { useState, useRef, useEffect, useCallback } from 'react'
import { parseInput, ParseResult, learnPattern, parseDebt, DebtParseResult } from '../../utils/parser'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { Category, WalletType } from '../../types'
import { fmtCurrency } from '../../utils/currency'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { v4 as uuidv4 } from 'uuid'
import api from '../../services/api'

interface Props {
  walletType: WalletType
  categories: Category[]
  onSuccess: () => void
  subFundId?: string
  walletId?: string | null
  currency?: string
}

function formatAmt(n: number, currency = 'VND') {
  return fmtCurrency(n, currency)
}

// ─── Confidence Badge ────────────────────────────────────────────────────

function FieldBadge({ label, value, confidence, onOverride }: {
  label: string
  value: string
  confidence: 'high' | 'low' | 'none'
  onOverride?: () => void
}) {
  const colors = {
    high: 'bg-gray-100 text-gray-700',
    low: 'bg-amber-100 text-amber-700 border border-amber-300',
    none: 'bg-red-100 text-red-600 border border-red-300',
  }
  const icons = { high: '', low: '⚠️ ', none: '❓ ' }

  return (
    <button
      onClick={onOverride}
      disabled={!onOverride}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${colors[confidence]} ${onOverride ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
    >
      {icons[confidence]}{label}: {value}
    </button>
  )
}

// ─── Amount Confirm Modal ────────────────────────────────────────────────

function AmountConfirmModal({ raw, suggested, onConfirm, onCancel, currency = 'VND' }: {
  raw: string
  suggested: number
  onConfirm: (amount: number) => void
  onCancel: () => void
  currency?: string
}) {
  const [input, setInput] = useState(String(suggested))
  const isVND = currency === 'VND'
  const multipliers = isVND ? [1_000, 10_000, 100_000, 1_000_000] : [1, 10, 100, 1_000]

  function mulLabel(mul: number) {
    if (mul >= 1_000_000) return '×1M'
    if (mul >= 1_000) return `×${mul / 1_000}k`
    return `×${mul}`
  }

  const parsed = parseFloat(input)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-gray-800 mb-1">Xác nhận số tiền</h3>
        <p className="text-sm text-gray-500 mb-4">
          Bạn gõ <span className="font-mono bg-gray-100 px-1 rounded">"{raw}"</span> — số tiền chính xác là bao nhiêu?
        </p>

        <div className="flex gap-2 mb-4">
          {multipliers.map(mul => (
            <button key={mul} onClick={() => {
              const base = parseFloat(raw.replace(/[^\d.]/g, '')) || 0
              setInput(String(base * mul))
            }} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5 font-medium transition">
              {mulLabel(mul)}
            </button>
          ))}
        </div>

        <input
          type="number" value={input} onChange={e => setInput(e.target.value)}
          className="w-full border-2 border-emerald-300 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:border-emerald-500 mb-1"
        />
        <p className="text-center text-sm text-gray-400 mb-4">
          {parsed ? fmtCurrency(parsed, currency) : '—'}
        </p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-gray-600 text-sm">Hủy</button>
          <button
            onClick={() => onConfirm(parsed)}
            disabled={!parsed}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category Picker ─────────────────────────────────────────────────────

function CategoryPicker({ categories, type, onSelect }: {
  categories: Category[]
  type: 'INCOME' | 'EXPENSE'
  onSelect: (cat: Category) => void
}) {
  const filtered = categories.filter(c => c.type === type || c.type === 'BOTH')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-[60]">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[70vh] overflow-y-auto">
        <h3 className="font-bold text-gray-800 mb-3 text-center">Chọn danh mục</h3>
        <div className="grid grid-cols-4 gap-2">
          {filtered.map(c => (
            <button key={c.id} onClick={() => onSelect(c)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-emerald-50 transition">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-xs text-gray-600 text-center leading-tight">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main QuickAdd ────────────────────────────────────────────────────────

export default function QuickAdd({ walletType, categories, onSuccess, subFundId, walletId, currency = 'VND' }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [debtResult, setDebtResult] = useState<DebtParseResult | null>(null)
  const [overrideAmount, setOverrideAmount] = useState<number | null>(null)
  const [overrideCategory, setOverrideCategory] = useState<Category | null>(null)
  // Manual mode override khi parser nhầm / sai chính tả
  const [modeOverride, setModeOverride] = useState<'INCOME' | 'EXPENSE' | 'DEBT' | null>(null)
  const [debtTypeManual, setDebtTypeManual] = useState<'BORROWED' | 'LENT'>('BORROWED')
  const [counterpartyManual, setCounterpartyManual] = useState('')
  const [showAmountModal, setShowAmountModal] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const idempotencyKey = useRef(uuidv4())

  const { enqueue, pendingCount, isOnline } = useOfflineQueue(onSuccess)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      idempotencyKey.current = uuidv4()
      setSubmitted(false)
    } else {
      setText(''); setResult(null); setDebtResult(null)
      setOverrideAmount(null); setOverrideCategory(null)
      setModeOverride(null); setCounterpartyManual('')
    }
  }, [open])

  // Re-parse khi categories load xong (user có thể đã gõ trước khi categories về)
  useEffect(() => {
    if (text.trim().length <= 1 || categories.length === 0) return
    const debt = parseDebt(text)
    setDebtResult(debt)
    if (debt) { setDebtTypeManual(debt.debtType); setCounterpartyManual(debt.counterparty) }
    setResult(debt ? null : parseInput(text, categories))
  }, [categories])

  const handleInput = useCallback((val: string) => {
    setText(val)
    setOverrideAmount(null); setOverrideCategory(null); setModeOverride(null)
    if (val.trim().length > 1) {
      const debt = parseDebt(val)
      setDebtResult(debt)
      if (debt) { setDebtTypeManual(debt.debtType); setCounterpartyManual(debt.counterparty) }
      setResult(debt ? null : parseInput(val, categories))
    } else {
      setResult(null); setDebtResult(null)
    }
  }, [categories])

  // Chế độ hoạt động: ưu tiên modeOverride, sau đó parser
  const activeMode: 'INCOME' | 'EXPENSE' | 'DEBT' =
    modeOverride ?? (debtResult ? 'DEBT' : (result?.type === 'INCOME' ? 'INCOME' : 'EXPENSE'))

  function selectMode(mode: 'INCOME' | 'EXPENSE' | 'DEBT') {
    setModeOverride(mode)
    setOverrideCategory(null)
    if (mode === 'DEBT') {
      setDebtTypeManual(debtResult?.debtType ?? 'BORROWED')
      setCounterpartyManual(debtResult?.counterparty ?? '')
    }
  }

  const isDebtMode = activeMode === 'DEBT'

  // Derived values cho transaction mode
  const txType: 'INCOME' | 'EXPENSE' = activeMode === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const finalAmount = overrideAmount ?? (isDebtMode ? debtResult?.amount : result?.amount) ?? null
  const finalCategory = overrideCategory ?? (result?.categoryId ? categories.find(c => c.id === result.categoryId) : null)
  const finalDate = result?.date ?? new Date()
  const finalNote = result?.note ?? ''

  const amountConf = overrideAmount ? 'high' : ((isDebtMode ? debtResult?.amountConfidence : result?.amountConfidence) ?? 'none')
  const catConf = overrideCategory ? 'high' : (result?.categoryConfidence ?? 'none')
  const canSubmitTx = !isDebtMode && finalAmount !== null && finalAmount > 0 && finalCategory !== null && !submitting && !submitted
  const canSubmitDebt = isDebtMode && finalAmount !== null && finalAmount > 0 && !submitting && !submitted

  // Học từ input — bỏ số/đơn vị tiền, giữ từ >= 2 ký tự
  function rememberWords(input: string, categoryId: string, type: 'INCOME' | 'EXPENSE') {
    const amountLike = /^\d|k$|tr$|triệu$|nghìn$|ngàn$|đồng$/i
    const seen = new Set<string>()
    input.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length < 2 || amountLike.test(w) || seen.has(w)) return
      seen.add(w)
      learnPattern(w, categoryId, type)
    })
  }

  async function handleDebtSubmit() {
    const amount = overrideAmount ?? (debtResult?.amount ?? null)
    if (!amount) { setShowAmountModal(true); return }
    if ((debtResult?.amountConfidence === 'low' || amountConf === 'low') && !overrideAmount) {
      setShowAmountModal(true); return
    }
    const counterparty = counterpartyManual.trim() || 'Không rõ'
    setSubmitting(true)
    try {
      await api.post('/debts', {
        title: counterparty !== 'Không rõ' ? counterparty : (debtTypeManual === 'LENT' ? 'Cho mượn' : 'Vay'),
        type: debtTypeManual,
        scope: 'PERSONAL',
        originalAmount: amount,
        counterparty,
      })
      setSubmitted(true)
      onSuccess()
      setTimeout(() => setOpen(false), 700)
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!canSubmitTx || !finalCategory || !finalAmount) return

    if (amountConf === 'low' && !overrideAmount) {
      setShowAmountModal(true)
      return
    }

    setSubmitting(true)
    const data = {
      amount: finalAmount,
      type: txType,
      date: format(finalDate, 'yyyy-MM-dd'),
      note: finalNote,
      categoryId: finalCategory.id,
      walletType: (subFundId ? 'SUBFUND' : walletType) as WalletType,
      subFundId: subFundId ?? null,
      walletId: (walletId && walletType === 'PERSONAL' && !subFundId) ? walletId : null,
    }

    rememberWords(text, finalCategory.id, txType)

    if (!isOnline) {
      enqueue({ idempotencyKey: idempotencyKey.current, data })
      setSubmitted(true)
      setTimeout(() => setOpen(false), 800)
      setSubmitting(false)
      return
    }

    try {
      await api.post('/transactions', data, {
        headers: { 'Idempotency-Key': idempotencyKey.current },
      })
      setSubmitted(true)
      onSuccess()
      setTimeout(() => setOpen(false), 600)
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Đã lưu rồi (duplicate tap) → coi như thành công
        setSubmitted(true)
        onSuccess()
        setTimeout(() => setOpen(false), 600)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 z-40 flex flex-col items-end gap-2">
        {pendingCount > 0 && (
          <div className="bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
            {pendingCount} giao dịch chờ đồng bộ
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full shadow-xl text-2xl flex items-center justify-center transition-transform"
        >
          +
        </button>
      </div>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-white rounded-t-2xl w-full p-5 pb-8 max-h-[80vh] overflow-y-auto">

            {/* Offline banner */}
            {!isOnline && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-2 text-xs text-amber-700">
                <span>📶</span> Đang offline — giao dịch sẽ được lưu và đồng bộ khi có mạng
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-gray-800 flex-1">Nhập nhanh</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              value={text}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full border-2 border-gray-200 focus:border-emerald-400 rounded-xl px-4 py-3 text-base outline-none transition mb-2"
              placeholder="ăn trưa 45k · lương 15tr · tiền điện 480k"
            />

            {/* Quick amount chips — hiện khi chưa có số tiền hoặc text ngắn */}
            {result?.amountConfidence !== 'high' && !overrideAmount && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['20k', '50k', '100k', '200k', '500k', '1tr', '2tr', '5tr'].map(chip => (
                  <button key={chip} type="button"
                    onClick={() => handleInput(text ? text.replace(/\S+$/, chip) : chip)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition">
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Type selector — luôn hiện khi có text, cho phép override khi sai chính tả */}
            {text.trim().length > 1 && (
              <div className="flex gap-1.5 mb-3">
                {([
                  { mode: 'INCOME' as const, label: '↑ Thu', activeClass: 'bg-emerald-500 text-white', inactiveClass: 'bg-gray-100 text-gray-500' },
                  { mode: 'EXPENSE' as const, label: '↓ Chi', activeClass: 'bg-red-500 text-white', inactiveClass: 'bg-gray-100 text-gray-500' },
                  { mode: 'DEBT' as const, label: '💸 Nợ / Vay', activeClass: 'bg-orange-500 text-white', inactiveClass: 'bg-gray-100 text-gray-500' },
                ]).map(({ mode, label, activeClass, inactiveClass }) => (
                  <button key={mode} onClick={() => selectMode(mode)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === mode ? activeClass : inactiveClass}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Debt mode preview */}
            {isDebtMode && text.trim().length > 1 && (
              <div className="rounded-xl border-2 border-orange-200 bg-orange-50 p-3 mb-3 space-y-2">
                {/* BORROWED / LENT toggle */}
                <div className="flex gap-2">
                  {([
                    { t: 'BORROWED' as const, label: '🏦 Tôi đang vay' },
                    { t: 'LENT' as const, label: '💸 Tôi đã cho vay' },
                  ]).map(({ t, label }) => (
                    <button key={t} onClick={() => setDebtTypeManual(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                        debtTypeManual === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  {/* Số tiền */}
                  <FieldBadge
                    label="Số tiền"
                    value={finalAmount ? formatAmt(finalAmount, currency) : 'chưa rõ'}
                    confidence={amountConf === 'none' ? 'none' : amountConf}
                    onOverride={() => setShowAmountModal(true)}
                  />
                </div>

                {/* Tên người */}
                <input
                  value={counterpartyManual}
                  onChange={e => setCounterpartyManual(e.target.value)}
                  placeholder="Tên người (vd: Hoa, Ngân hàng ACB...)"
                  className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                />

                {amountConf === 'none' && (
                  <p className="text-xs text-red-500">❓ Không tìm thấy số tiền — nhấn vào để nhập</p>
                )}
              </div>
            )}

            {/* Transaction mode preview */}
            {!isDebtMode && (result || modeOverride) && text.trim().length > 1 && (
              <div className={`rounded-xl border-2 p-3 mb-3 transition ${canSubmitTx ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <FieldBadge
                    label="Số tiền"
                    value={finalAmount ? formatAmt(finalAmount, currency) : 'chưa rõ'}
                    confidence={amountConf === 'none' ? 'none' : amountConf}
                    onOverride={() => setShowAmountModal(true)}
                  />
                  <FieldBadge
                    label="Danh mục"
                    value={finalCategory ? `${finalCategory.icon} ${finalCategory.name}` : 'chưa rõ'}
                    confidence={catConf === 'none' ? 'none' : catConf}
                    onOverride={() => setShowCategoryPicker(true)}
                  />
                  {result && (
                    <FieldBadge
                      label={format(finalDate, 'dd/MM', { locale: vi })}
                      value="" confidence={result.dateConfidence}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  {amountConf === 'low' && <p className="text-xs text-amber-600">⚠️ Số tiền chưa rõ đơn vị — nhấn để xác nhận</p>}
                  {amountConf === 'none' && <p className="text-xs text-red-500">❓ Không tìm thấy số tiền — nhấn để nhập</p>}
                  {catConf === 'none' && <p className="text-xs text-red-500">❓ Không rõ danh mục — nhấn để chọn</p>}
                </div>
                {finalNote && <p className="text-xs text-gray-400 mt-1.5">📝 {finalNote}</p>}
              </div>
            )}

            {/* Submit */}
            {isDebtMode ? (
              <button onClick={handleDebtSubmit} disabled={!canSubmitDebt}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${
                  submitted ? 'bg-orange-100 text-orange-700'
                  : canSubmitDebt ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {submitted ? '✓ Đã lưu vào ví nợ' : submitting ? 'Đang lưu...' : canSubmitDebt ? '💸 Lưu vào ví nợ' : 'Nhập số tiền'}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canSubmitTx}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${
                  submitted ? 'bg-emerald-100 text-emerald-700'
                  : canSubmitTx ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {submitted ? '✓ Đã lưu' : submitting ? 'Đang lưu...' : canSubmitTx ? 'Lưu giao dịch' : 'Nhập thông tin phía trên'}
              </button>
            )}

            <p className="text-center text-xs text-gray-400 mt-2">Enter để lưu nhanh</p>
          </div>
        </div>
      )}

      {/* Amount confirm modal */}
      {showAmountModal && (result || debtResult) && (
        <AmountConfirmModal
          raw={(result?.amountRaw || debtResult?.amountRaw) || text}
          suggested={(result?.amount ?? debtResult?.amount) ?? 0}
          onConfirm={amount => { setOverrideAmount(amount); setShowAmountModal(false) }}
          onCancel={() => setShowAmountModal(false)}
          currency={currency}
        />
      )}

      {/* Category picker */}
      {showCategoryPicker && (
        <CategoryPicker
          categories={categories}
          type={txType}
          onSelect={cat => { setOverrideCategory(cat); setShowCategoryPicker(false) }}
        />
      )}
    </>
  )
}
