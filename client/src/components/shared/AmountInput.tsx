import { parseAmount, fmtVND } from '../../utils/amountParser'
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

  const parsed = isVND ? parseAmount(value) : parseFloat(value)
  const valid = parsed !== null && parsed > 0 && !isNaN(parsed as number)

  const preview = valid
    ? isVND
      ? fmtVND(parsed as number)
      : fmtCurrency(parsed as number, currency)
    : null

  return (
    <div>
      <input
        className={className ?? 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300'}
        placeholder={placeholder ?? (isVND ? 'Số tiền (vd: 45k, 1tr5, 500.000)' : `Số tiền (${currency})`)}
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode="decimal"
      />
      {chips.length > 0 && !valid && (
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
      {value.trim() && (
        <p className={`text-xs mt-1 px-1 ${valid ? 'text-emerald-600' : 'text-gray-400'}`}>
          {valid ? `= ${preview}` : 'Không nhận dạng — thử: 5tr, 500k, 1.500.000'}
        </p>
      )}
    </div>
  )
}
