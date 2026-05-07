import { useState, useRef, useEffect, useCallback } from 'react'
import { parseInput, ParseResult, learnPattern, parseDebt, DebtParseResult, parseHui, HuiParseResult } from '../../utils/parser'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { Category, Hui, WalletType, RecipientLabel } from '../../types'
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

// ─── Keyword matching ────────────────────────────────────────────────────

function matchKeywordCategories(text: string, categories: Category[]): Category[] {
  const normalized = text.toLowerCase()
  return categories.filter(cat => {
    if (!cat.keywords?.trim()) return false
    const kws = cat.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length >= 2)
    return kws.some(kw => normalized.includes(kw))
  })
}

function matchRecipientLabel(text: string, labels: RecipientLabel[]): string | null {
  const n = text.toLowerCase()
  const found = labels.find(l => l.name.length >= 2 && n.includes(l.name.toLowerCase()))
  return found?.id ?? null
}

interface BatchItem {
  id: string
  rawText: string
  mode: 'INCOME' | 'EXPENSE' | 'DEBT' | 'HUI'
  amount: number | null
  amountConf: 'high' | 'low' | 'none'
  note: string
  date: Date
  category: Category | null
  catConf: 'high' | 'low' | 'none'
  recipientLabelId: string | null
  huiRoundNo: number | null
  huiId: string | null
  debtType: 'BORROWED' | 'LENT'
  counterparty: string
  selected: boolean
  hasError?: boolean
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

// ─── Batch Card ───────────────────────────────────────────────────────────

function BatchCard({
  item, categories, recipientLabels, huis, onUpdate, onRemove,
}: {
  item: BatchItem
  categories: Category[]
  recipientLabels: RecipientLabel[]
  huis: Hui[] | null
  onUpdate: (updates: Partial<BatchItem>) => void
  onRemove: () => void
}) {
  const [showAmt, setShowAmt] = useState(false)
  const [showCat, setShowCat] = useState(false)

  const canSave = item.mode === 'HUI'
    ? item.huiId != null && item.huiRoundNo != null
    : item.mode === 'DEBT'
    ? (item.amount ?? 0) > 0
    : (item.amount ?? 0) > 0 && item.category != null

  const borderCls = !item.selected
    ? 'border-gray-100 opacity-50'
    : item.hasError
    ? 'border-red-300 bg-red-50'
    : !canSave
    ? 'border-amber-200 bg-amber-50/30'
    : item.mode === 'INCOME' ? 'border-emerald-200'
    : item.mode === 'HUI' ? 'border-indigo-200'
    : item.mode === 'DEBT' ? 'border-orange-200'
    : 'border-red-100'

  return (
    <div className={`border-2 rounded-xl p-3 space-y-2 transition ${borderCls}`}>
      {/* Row 1: checkbox + raw text + remove */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onUpdate({ selected: !item.selected })}
          className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition ${
            item.selected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-300'
          }`}
        >
          {item.selected && <span className="text-[9px] text-white font-bold leading-none">✓</span>}
        </button>
        <span className="flex-1 text-xs text-gray-500 truncate">{item.rawText}</span>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-base leading-none shrink-0">×</button>
      </div>

      {/* Row 2: mode + amount + category badges */}
      <div className="flex flex-wrap gap-1.5 pl-7">
        {(item.mode === 'INCOME' || item.mode === 'EXPENSE') && (
          <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
            {(['INCOME', 'EXPENSE'] as const).map(m => (
              <button key={m}
                onClick={() => onUpdate({ mode: m, category: null, catConf: 'none' })}
                className={`px-2 py-0.5 text-[10px] font-semibold transition ${
                  item.mode === m
                    ? m === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-white text-gray-400 hover:bg-gray-50'
                }`}>
                {m === 'INCOME' ? '↑ Thu' : '↓ Chi'}
              </button>
            ))}
          </div>
        )}
        {item.mode === 'HUI' && <span className="px-2 py-0.5 rounded-lg text-[10px] bg-indigo-100 text-indigo-700 font-medium">🔄 Hụi</span>}
        {item.mode === 'DEBT' && <span className="px-2 py-0.5 rounded-lg text-[10px] bg-orange-100 text-orange-700 font-medium">💸 Nợ</span>}

        <button onClick={() => setShowAmt(true)}
          className={`px-2 py-0.5 rounded-lg text-xs font-medium transition ${
            item.amountConf === 'high' ? 'bg-gray-100 text-gray-700'
            : item.amountConf === 'low' ? 'bg-amber-100 text-amber-700 border border-amber-300'
            : 'bg-red-100 text-red-600 border border-red-300'
          }`}>
          {item.amountConf !== 'high' && (item.amountConf === 'low' ? '⚠️ ' : '❓ ')}
          {item.amount ? fmtCurrency(item.amount, 'VND') : 'Nhập số tiền'}
        </button>

        {(item.mode === 'INCOME' || item.mode === 'EXPENSE') && (
          <button onClick={() => setShowCat(true)}
            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition ${
              item.catConf === 'high' ? 'bg-gray-100 text-gray-700'
              : item.catConf === 'low' ? 'bg-amber-100 text-amber-700 border border-amber-300'
              : 'bg-red-100 text-red-600 border border-red-300'
            }`}>
            {item.catConf !== 'high' && (item.catConf === 'low' ? '⚠️ ' : '❓ ')}
            {item.category ? `${item.category.icon} ${item.category.name}` : 'Chọn danh mục'}
          </button>
        )}

        {item.mode === 'HUI' && (
          <>
            {item.huiRoundNo != null
              ? <span className="px-2 py-0.5 rounded-lg text-xs bg-indigo-100 text-indigo-700">Kỳ {item.huiRoundNo}</span>
              : <span className="px-2 py-0.5 rounded-lg text-xs bg-red-100 text-red-600 border border-red-300">❓ Chưa rõ kỳ</span>
            }
            {huis && huis.length > 0 && (
              <select value={item.huiId ?? ''} onChange={e => onUpdate({ huiId: e.target.value || null })}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white focus:outline-none max-w-[130px]">
                <option value="">Chọn dây hụi</option>
                {huis.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            )}
          </>
        )}
      </div>

      {item.mode === 'EXPENSE' && recipientLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-7">
          {recipientLabels.map(l => (
            <button key={l.id}
              onClick={() => onUpdate({ recipientLabelId: item.recipientLabelId === l.id ? null : l.id })}
              className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] border transition ${
                item.recipientLabelId === l.id ? 'text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
              style={item.recipientLabelId === l.id ? { backgroundColor: l.color, borderColor: l.color } : {}}>
              {l.icon} {l.name}
            </button>
          ))}
        </div>
      )}

      {item.hasError && <p className="text-xs text-red-500 pl-7">Lỗi lưu — kiểm tra lại</p>}

      {showAmt && (
        <AmountConfirmModal
          raw={item.rawText} suggested={item.amount ?? 0}
          onConfirm={amount => { onUpdate({ amount, amountConf: 'high' }); setShowAmt(false) }}
          onCancel={() => setShowAmt(false)}
        />
      )}
      {showCat && (
        <CategoryPicker
          categories={categories}
          type={item.mode === 'INCOME' ? 'INCOME' : 'EXPENSE'}
          onSelect={cat => { onUpdate({ category: cat, catConf: 'high' }); setShowCat(false) }}
        />
      )}
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
  const [modeOverride, setModeOverride] = useState<'INCOME' | 'EXPENSE' | 'DEBT' | 'HUI' | null>(null)
  const [huiResult, setHuiResult] = useState<HuiParseResult | null>(null)
  const [huis, setHuis] = useState<Hui[] | null>(null)
  const [selectedHuiId, setSelectedHuiId] = useState<string | null>(null)
  const huisFetched = useRef(false)
  const [recipientLabels, setRecipientLabels] = useState<RecipientLabel[]>([])
  const [recipientLabelId, setRecipientLabelId] = useState<string | null>(null)
  const recipientsFetched = useRef(false)
  const [debtTypeManual, setDebtTypeManual] = useState<'BORROWED' | 'LENT'>('BORROWED')
  const [counterpartyManual, setCounterpartyManual] = useState('')
  const [keywordMatches, setKeywordMatches] = useState<Category[]>([])
  const [showAmountModal, setShowAmountModal] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchAnalyzed, setBatchAnalyzed] = useState(false)
  const [batchSummary, setBatchSummary] = useState<{ savedCount: number; totalAmount: number } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const idempotencyKey = useRef(uuidv4())

  const { enqueue, pendingCount, isOnline } = useOfflineQueue(onSuccess)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      idempotencyKey.current = uuidv4()
      setSubmitted(false)
      if (!recipientsFetched.current) {
        recipientsFetched.current = true
        api.get('/recipients').then(r => setRecipientLabels(r.data)).catch(() => {})
      }
    } else {
      setText(''); setResult(null); setDebtResult(null)
      setOverrideAmount(null); setOverrideCategory(null)
      setModeOverride(null); setCounterpartyManual('')
      setHuiResult(null); setHuis(null); setSelectedHuiId(null)
      huisFetched.current = false
      setRecipientLabelId(null); setKeywordMatches([])
      setBatchItems([]); setBatchAnalyzed(false); setBatchSummary(null); setAnalyzing(false)
    }
  }, [open])

  // Re-parse khi categories load xong (user có thể đã gõ trước khi categories về)
  useEffect(() => {
    if (text.trim().length <= 1 || categories.length === 0) return
    if (parseHui(text)) return
    const debt = parseDebt(text)
    setDebtResult(debt)
    if (debt) { setDebtTypeManual(debt.debtType); setCounterpartyManual(debt.counterparty) }
    setResult(debt ? null : parseInput(text, categories))
    setKeywordMatches(matchKeywordCategories(text, categories))
  }, [categories])

  const handleInput = useCallback((val: string) => {
    setText(val)
    setOverrideAmount(null); setOverrideCategory(null); setModeOverride(null)
    if (val.split(' - ').filter(l => l.trim().length > 1).length > 1) {
      setResult(null); setDebtResult(null); setHuiResult(null); setKeywordMatches([])
      return
    }
    if (val.trim().length > 1) {
      const hui = parseHui(val)
      setHuiResult(hui)
      if (hui && !huisFetched.current) {
        huisFetched.current = true
        api.get('/hui').then(r => {
          const active = (r.data as Hui[]).filter(h => h.status !== 'COMPLETED')
          setHuis(active)
          if (active.length === 1) setSelectedHuiId(active[0].id)
        }).catch(() => setHuis([]))
      }
      if (hui) { setDebtResult(null); setResult(null); setKeywordMatches([]); return }

      const debt = parseDebt(val)
      setDebtResult(debt)
      if (debt) { setDebtTypeManual(debt.debtType); setCounterpartyManual(debt.counterparty) }
      const parsed = debt ? null : parseInput(val, categories)
      setResult(parsed)
      setKeywordMatches(debt ? [] : matchKeywordCategories(val, categories))
      // Auto-gợi ý recipient label từ text
      if (!debt) setRecipientLabelId(matchRecipientLabel(val, recipientLabels))
    } else {
      setResult(null); setDebtResult(null); setHuiResult(null); setKeywordMatches([])
      setRecipientLabelId(null)
    }
  }, [categories, recipientLabels])

  // Chế độ hoạt động: ưu tiên modeOverride, sau đó parser
  const activeMode: 'INCOME' | 'EXPENSE' | 'DEBT' | 'HUI' =
    modeOverride ?? (huiResult ? 'HUI' : debtResult ? 'DEBT' : (result?.type === 'INCOME' ? 'INCOME' : 'EXPENSE'))

  function selectMode(mode: 'INCOME' | 'EXPENSE' | 'DEBT' | 'HUI') {
    setModeOverride(mode)
    setOverrideCategory(null)
    if (mode === 'DEBT') {
      setDebtTypeManual(debtResult?.debtType ?? 'BORROWED')
      setCounterpartyManual(debtResult?.counterparty ?? '')
    }
  }

  const isDebtMode = activeMode === 'DEBT'
  const isHuiMode = activeMode === 'HUI'

  // Derived values cho transaction mode
  const txType: 'INCOME' | 'EXPENSE' = activeMode === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const finalAmount = overrideAmount ?? (isDebtMode ? debtResult?.amount : result?.amount) ?? null
  const selectedHui = huis?.find(h => h.id === selectedHuiId) ?? null
  const finalHuiAmount = overrideAmount ?? huiResult?.amount ?? null
  const parserCat = result?.categoryId ? categories.find(c => c.id === result.categoryId) : null
  const parserCatConf = result?.categoryConfidence ?? 'none'
  // Keyword auto-select: only when parser is not confident
  const kwAutoSelect = keywordMatches.length === 1 && parserCatConf !== 'high' ? keywordMatches[0] : null
  const finalCategory = overrideCategory ?? (parserCatConf === 'high' ? parserCat : (kwAutoSelect ?? parserCat))
  const finalDate = result?.date ?? new Date()
  const finalNote = result?.note ?? ''

  const amountConf = overrideAmount ? 'high' : ((isDebtMode ? debtResult?.amountConfidence : result?.amountConfidence) ?? 'none')
  const catConf = overrideCategory ? 'high'
    : kwAutoSelect ? 'high'
    : parserCatConf
  const canSubmitTx = !isDebtMode && !isHuiMode && finalAmount !== null && finalAmount > 0 && finalCategory !== null && !submitting && !submitted
  const canSubmitDebt = isDebtMode && finalAmount !== null && finalAmount > 0 && !submitting && !submitted
  const canSubmitHui = isHuiMode && selectedHuiId !== null && huiResult?.roundNo != null && !submitting && !submitted

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

  const isMultiLine = text.split(' - ').filter(l => l.trim().length > 1).length > 1
  const validLineCount = text.split(' - ').filter(l => l.trim().length > 1).length

  function updateBatchItem(id: string, updates: Partial<BatchItem>) {
    setBatchItems(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  async function handleAnalyze() {
    const lines = text.split(' - ').map(l => l.trim()).filter(l => l.length > 1)
    if (lines.length === 0) return
    setAnalyzing(true)

    let activeHuis: Hui[] = huis ?? []
    const hasHuiLine = lines.some(l => parseHui(l) !== null)
    if (hasHuiLine && !huisFetched.current) {
      try {
        const r = await api.get('/hui')
        activeHuis = (r.data as Hui[]).filter((h: Hui) => h.status !== 'COMPLETED')
        setHuis(activeHuis)
        huisFetched.current = true
      } catch { activeHuis = [] }
    }

    const items: BatchItem[] = lines.map(line => {
      const huiParsed = parseHui(line)
      if (huiParsed) {
        const matchedHui = activeHuis.length === 1 ? activeHuis[0] : null
        return {
          id: uuidv4(), rawText: line, mode: 'HUI' as const,
          amount: huiParsed.amount, amountConf: huiParsed.amountConfidence,
          note: line, date: new Date(),
          category: null, catConf: 'none' as const,
          recipientLabelId: null, huiRoundNo: huiParsed.roundNo ?? null,
          huiId: matchedHui?.id ?? null,
          debtType: 'BORROWED' as const, counterparty: '', selected: true,
        }
      }
      const debtParsed = parseDebt(line)
      if (debtParsed) {
        return {
          id: uuidv4(), rawText: line, mode: 'DEBT' as const,
          amount: debtParsed.amount, amountConf: debtParsed.amountConfidence,
          note: line, date: new Date(),
          category: null, catConf: 'none' as const,
          recipientLabelId: null, huiRoundNo: null, huiId: null,
          debtType: debtParsed.debtType, counterparty: debtParsed.counterparty,
          selected: true,
        }
      }
      const parsed = parseInput(line, categories)
      const kwMatches = matchKeywordCategories(line, categories)
      const parserCat = parsed.categoryId ? categories.find(c => c.id === parsed.categoryId) ?? null : null
      const parserConf = parsed.categoryConfidence
      const kwAuto = kwMatches.length === 1 && parserConf !== 'high' ? kwMatches[0] : null
      const cat = parserConf === 'high' ? parserCat : (kwAuto ?? parserCat)
      return {
        id: uuidv4(), rawText: line, mode: parsed.type,
        amount: parsed.amount, amountConf: parsed.amountConfidence,
        note: parsed.note || line, date: parsed.date,
        category: cat ?? null, catConf: parserConf,
        recipientLabelId: matchRecipientLabel(line, recipientLabels),
        huiRoundNo: null, huiId: null,
        debtType: 'BORROWED' as const, counterparty: '', selected: true,
      }
    })

    setBatchItems(items)
    setBatchAnalyzed(true)
    setAnalyzing(false)
  }

  async function handleBatchSubmit() {
    const toSave = batchItems.filter(item => item.selected)
    if (toSave.length === 0) return
    setSubmitting(true)
    let savedCount = 0
    let totalAmount = 0
    let hasErrors = false

    for (const item of toSave) {
      try {
        if (item.mode === 'HUI') {
          if (!item.huiId || item.huiRoundNo == null) continue
          const huiData = huis?.find(h => h.id === item.huiId)
          if (item.amount && huiData && item.amount !== huiData.amount) {
            await api.patch(`/hui/${item.huiId}/rounds/${item.huiRoundNo}/bid`, { bidAmount: item.amount })
          }
          await api.post(`/hui/${item.huiId}/rounds/${item.huiRoundNo}/toggle`)
          if (item.amount) totalAmount += item.amount
          savedCount++
        } else if (item.mode === 'DEBT') {
          if (!item.amount || item.amount <= 0) continue
          await api.post('/debts', {
            title: item.counterparty || (item.debtType === 'LENT' ? 'Cho mượn' : 'Vay'),
            type: item.debtType, scope: 'PERSONAL',
            originalAmount: item.amount, counterparty: item.counterparty || 'Không rõ',
          })
          totalAmount += item.amount
          savedCount++
        } else {
          if (!item.amount || item.amount <= 0 || !item.category) continue
          await api.post('/transactions', {
            amount: item.amount, type: item.mode,
            date: format(item.date, 'yyyy-MM-dd'),
            note: item.note, categoryId: item.category.id,
            walletType: (subFundId ? 'SUBFUND' : walletType) as WalletType,
            subFundId: subFundId ?? null,
            walletId: (walletId && walletType === 'PERSONAL' && !subFundId) ? walletId : null,
            recipientLabelId: item.mode === 'EXPENSE' ? item.recipientLabelId : null,
          }, { headers: { 'Idempotency-Key': uuidv4() } })
          totalAmount += item.amount
          savedCount++
        }
        setBatchItems(prev => prev.map(b => b.id === item.id ? { ...b, selected: false } : b))
      } catch {
        hasErrors = true
        setBatchItems(prev => prev.map(b => b.id === item.id ? { ...b, hasError: true } : b))
      }
    }

    setSubmitting(false)
    if (savedCount > 0) {
      setBatchSummary({ savedCount, totalAmount })
      onSuccess()
      if (!hasErrors) setTimeout(() => setOpen(false), 2500)
    }
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

  async function handleHuiSubmit() {
    if (!selectedHui || huiResult?.roundNo == null) return
    const roundNo = huiResult.roundNo
    const amount = overrideAmount ?? huiResult?.amount ?? null
    setSubmitting(true)
    try {
      if (amount && amount !== selectedHui.amount) {
        await api.patch(`/hui/${selectedHui.id}/rounds/${roundNo}/bid`, { bidAmount: amount })
      }
      await api.post(`/hui/${selectedHui.id}/rounds/${roundNo}/toggle`)
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
      recipientLabelId: txType === 'EXPENSE' ? recipientLabelId : null,
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
            {!batchAnalyzed && !batchSummary && (
              <input
                ref={inputRef}
                value={text}
                onChange={e => handleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full border-2 border-gray-200 focus:border-emerald-400 rounded-xl px-4 py-3 text-base outline-none transition mb-2"
                placeholder="ăn trưa 45k · lương 15tr (nhiều: sữa 85k - điện 350k - hụi 500k kỳ 3)"
              />
            )}

            {/* Multi-line: Phân tích button */}
            {isMultiLine && !batchAnalyzed && !batchSummary && (
              <div className="mt-1">
                <p className="text-xs text-gray-400 mb-2">{validLineCount} giao dịch — phân cách bằng " - "</p>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${analyzing ? 'bg-gray-100 text-gray-400' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}
                >
                  {analyzing ? 'Đang phân tích...' : `✦ Phân tích ${validLineCount} giao dịch`}
                </button>
              </div>
            )}

            {/* ── Single-line mode ── */}
            {!isMultiLine && !batchAnalyzed && !batchSummary && (<>

            {/* Quick amount chips — hiện khi chưa có số tiền hoặc text ngắn */}
            {result?.amountConfidence !== 'high' && !overrideAmount && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['20k', '50k', '100k', '200k', '500k', '1tr', '2tr', '5tr'].map(chip => (
                  <button key={chip} type="button"
                    onPointerDown={e => e.preventDefault()}
                    onClick={() => { handleInput(text ? text.replace(/\S+$/, chip) : chip); inputRef.current?.focus() }}
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
                  { mode: 'DEBT' as const, label: '💸 Nợ', activeClass: 'bg-orange-500 text-white', inactiveClass: 'bg-gray-100 text-gray-500' },
                  { mode: 'HUI' as const, label: '🔄 Hụi', activeClass: 'bg-indigo-500 text-white', inactiveClass: 'bg-gray-100 text-gray-500' },
                ]).map(({ mode, label, activeClass, inactiveClass }) => (
                  <button key={mode} onClick={() => selectMode(mode)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${activeMode === mode ? activeClass : inactiveClass}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* HUI mode preview */}
            {isHuiMode && text.trim().length > 1 && (
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 mb-3 space-y-2">
                {huis === null ? (
                  <p className="text-xs text-indigo-500">Đang tải danh sách hụi...</p>
                ) : huis.length === 0 ? (
                  <p className="text-xs text-red-500">Không có dây hụi nào đang hoạt động</p>
                ) : (
                  <>
                    {huis.length > 1 && (
                      <div>
                        <p className="text-xs text-indigo-600 mb-1 font-medium">Chọn dây hụi:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {huis.map(h => (
                            <button key={h.id} onClick={() => setSelectedHuiId(h.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                                selectedHuiId === h.id
                                  ? 'bg-indigo-500 text-white border-indigo-500'
                                  : 'bg-white text-gray-600 border-gray-200'
                              }`}>
                              {h.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedHui && huiResult?.roundNo != null && (() => {
                      const rn = huiResult.roundNo
                      const isCollect = selectedHui.myRounds.includes(rn)
                      const live = selectedHui.myRounds.filter(mr => mr > rn).length
                      const dead = selectedHui.myRounds.filter(mr => mr < rn).length
                      return (
                        <div className="text-xs text-indigo-700 bg-indigo-100 rounded-lg px-2 py-1">
                          {isCollect
                            ? `🎯 Kỳ ${rn} là kỳ hốt của bạn — đánh dấu đã hốt`
                            : `💰 Đóng ${live} suất sống${dead > 0 ? ` + ${dead} suất chết` : ''}`}
                        </div>
                      )
                    })()}
                    <div className="flex flex-wrap gap-1.5">
                      {selectedHui && huis.length === 1 && (
                        <FieldBadge label="Dây" value={selectedHui.name} confidence="high" />
                      )}
                      <FieldBadge
                        label="Kỳ"
                        value={huiResult?.roundNo != null ? String(huiResult.roundNo) : 'chưa rõ'}
                        confidence={huiResult?.roundNo != null ? 'high' : 'none'}
                      />
                      {selectedHui && huiResult?.roundNo != null && !selectedHui.myRounds.includes(huiResult.roundNo) && (
                        <FieldBadge
                          label="Tiền đóng/suất"
                          value={finalHuiAmount ? formatAmt(finalHuiAmount) : formatAmt(selectedHui.amount)}
                          confidence={finalHuiAmount ? (huiResult?.amountConfidence ?? 'high') : 'low'}
                          onOverride={() => setShowAmountModal(true)}
                        />
                      )}
                    </div>
                    {!selectedHuiId && huis.length > 1 && (
                      <p className="text-xs text-amber-600">⚠️ Chọn dây hụi để tiếp tục</p>
                    )}
                    {huiResult?.roundNo == null && (
                      <p className="text-xs text-amber-600">⚠️ Chưa rõ kỳ nào — thêm "kỳ 3" vào câu</p>
                    )}
                  </>
                )}
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
                      label="Ngày"
                      value={
                        result.dateConfidence === 'low'
                          ? 'Hôm nay'
                          : format(finalDate, 'dd/MM', { locale: vi })
                      }
                      confidence={result.dateConfidence}
                    />
                  )}
                </div>

                {/* Multiple keyword matches — let user pick */}
                {keywordMatches.length > 1 && !overrideCategory && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-indigo-500 font-medium">Từ khoá khớp:</span>
                    {keywordMatches.map(cat => (
                      <button key={cat.id} type="button"
                        onPointerDown={e => e.preventDefault()}
                        onClick={() => setOverrideCategory(cat)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition">
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  {amountConf === 'low' && <p className="text-xs text-amber-600">⚠️ Số tiền chưa rõ đơn vị — nhấn để xác nhận</p>}
                  {amountConf === 'none' && <p className="text-xs text-red-500">❓ Không tìm thấy số tiền — nhấn để nhập</p>}
                  {catConf === 'none' && keywordMatches.length === 0 && <p className="text-xs text-red-500">❓ Không rõ danh mục — nhấn để chọn</p>}
                </div>
                {finalNote && <p className="text-xs text-gray-400 mt-1.5">📝 {finalNote}</p>}
              </div>
            )}

            {/* Recipient label chips — EXPENSE only */}
            {!isDebtMode && !isHuiMode && txType === 'EXPENSE' && recipientLabels.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 mb-1.5">Dành cho</p>
                <div className="flex flex-wrap gap-1.5">
                  {recipientLabels.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onPointerDown={e => e.preventDefault()}
                      onClick={() => setRecipientLabelId(recipientLabelId === l.id ? null : l.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs border-2 transition font-medium ${recipientLabelId === l.id ? 'text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      style={recipientLabelId === l.id ? { backgroundColor: l.color, borderColor: l.color } : {}}
                    >
                      <span>{l.icon}</span>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            {isHuiMode ? (
              <button onClick={handleHuiSubmit} disabled={!canSubmitHui}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${
                  submitted ? 'bg-indigo-100 text-indigo-700'
                  : canSubmitHui ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}>
                {submitted ? '✓ Đã đóng hụi' : submitting ? 'Đang lưu...' : canSubmitHui ? '🔄 Đóng hụi' : 'Thiếu thông tin'}
              </button>
            ) : isDebtMode ? (
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
            </>)}

            {/* ── Batch review mode ── */}
            {batchAnalyzed && (!batchSummary || batchItems.some(b => b.hasError)) && (
              <>
                {!batchSummary && (
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {batchItems.filter(b => b.selected).length}/{batchItems.length} giao dịch đã chọn
                    </p>
                    <button
                      onClick={() => { setBatchAnalyzed(false); setBatchItems([]) }}
                      className="text-xs text-indigo-500 hover:text-indigo-700"
                    >
                      ← Sửa lại
                    </button>
                  </div>
                )}
                {batchSummary && batchItems.some(b => b.hasError) && (
                  <p className="text-xs text-red-600 font-medium mb-2">Một số giao dịch lưu lỗi — kiểm tra lại bên dưới:</p>
                )}
                <div className="space-y-2 mb-4">
                  {(batchSummary ? batchItems.filter(b => b.hasError) : batchItems).map(item => (
                    <BatchCard
                      key={item.id}
                      item={item}
                      categories={categories}
                      recipientLabels={recipientLabels}
                      huis={huis}
                      onUpdate={updates => updateBatchItem(item.id, updates)}
                      onRemove={() => setBatchItems(prev => prev.filter(b => b.id !== item.id))}
                    />
                  ))}
                </div>
                {!batchSummary && (
                  <button
                    onClick={handleBatchSubmit}
                    disabled={submitting || batchItems.filter(b => b.selected).length === 0}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${
                      submitting ? 'bg-gray-100 text-gray-400'
                      : batchItems.filter(b => b.selected).length > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? 'Đang lưu...' : `Lưu ${batchItems.filter(b => b.selected).length} giao dịch đã chọn`}
                  </button>
                )}
                {batchSummary && batchItems.some(b => b.hasError) && (
                  <button
                    onClick={handleBatchSubmit}
                    disabled={submitting || batchItems.filter(b => b.hasError && b.selected).length === 0}
                    className="w-full py-3 rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white transition"
                  >
                    {submitting ? 'Đang thử lại...' : 'Thử lại các mục lỗi'}
                  </button>
                )}
              </>
            )}

            {/* ── Batch save summary ── */}
            {batchSummary && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold text-emerald-700 text-base">Đã lưu {batchSummary.savedCount} giao dịch</p>
                {batchSummary.totalAmount > 0 && (
                  <p className="text-sm text-emerald-600 mt-1">
                    Tổng: {batchSummary.totalAmount.toLocaleString('vi-VN')} ₫
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amount confirm modal */}
      {showAmountModal && (result || debtResult || huiResult) && (
        <AmountConfirmModal
          raw={(result?.amountRaw || debtResult?.amountRaw || huiResult?.amountRaw) || text}
          suggested={(result?.amount ?? debtResult?.amount ?? huiResult?.amount) ?? 0}
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
