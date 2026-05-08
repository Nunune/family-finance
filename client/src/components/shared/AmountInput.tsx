import { parseAmount, parseExpression, hasOperator, fmtVND } from '../../utils/amountParser'
import { fmtCurrency } from '../../utils/currency'

const VND_CHIPS = ['20k', '50k', '100k', '200k', '500k', '1tr', '2tr', '5tr']

interface Props {
  value: string
  onChange: (val: string) => void
  currency?: string
  placeholder?: string
  className?: string
  chipSet?: string[]
}

export default function AmountInput({
  value,
  onChange,
  currency = 'VND',
  placeholder,
  className,
  chipSet,
}: Props) {
  const isVND = currency === 'VND'
  const chips = chipSet ?? (isVND ? VND_CHIPS : [])

  const isExpr = isVND && hasOperator(value)
  const parsed = isVND
    ? (isExpr ? parseExpression(value) : parseAmount(value))
    : parseFloat(value)
  const valid = parsed !== null && parsed > 0 && !isNaN(parsed as number)

  // Khi rời ô: tự giải biểu thức → số thuần
  function handleBlur() {
    if (isExpr && valid && parsed !== null) {
      onChange(String(Math.round(parsed as number)))
    }
  }

  const preview = (() => {
    if (!value.trim()) return null
    if (!valid) return { text: 'Không nhận dạng — thử: 5tr, 500k, 1.500.000', ok: false }
    const fmt = isVND ? fmtVND(parsed as number) : fmtCurrency(parsed as number, currency)
    if (isExpr) return { text: `${value.trim()} = ${fmt}`, ok: true }
    return { text: `= ${fmt}`, ok: true }
  })()

  return (
    <div>
      <input
        className={className ?? 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300'}
        placeholder={placeholder ?? (isVND ? 'Số tiền (vd: 45k, 1tr5, 500.000)' : `Số tiền (${currency})`)}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={handleBlur}
        inputMode={isVND ? 'text' : 'decimal'}
      />
      {chips.length > 0 && !valid && !isExpr && (
        <div className="flex gap-1.5 flex-wrap mt-1.5">
          {chips.map(chip => (
            <button key={chip} type="button"
              onClick={() => onChange(chip)}
              className="px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition">
              {chip}
            </button>
          ))}
        </div>
      )}
      {preview && (
        <p className={`text-xs mt-1 px-1 ${preview.ok ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
          {preview.text}
        </p>
      )}
    </div>
  )
}
