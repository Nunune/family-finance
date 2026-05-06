export const CURRENCIES: { code: string; label: string; symbol: string; locale: string }[] = [
  { code: 'VND', label: 'VND — Đồng Việt Nam', symbol: '₫', locale: 'vi-VN' },
  { code: 'AUD', label: 'AUD — Đô la Úc', symbol: 'A$', locale: 'en-AU' },
  { code: 'USD', label: 'USD — Đô la Mỹ', symbol: '$', locale: 'en-US' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€', locale: 'de-DE' },
  { code: 'SGD', label: 'SGD — Đô la Singapore', symbol: 'S$', locale: 'en-SG' },
  { code: 'JPY', label: 'JPY — Yên Nhật', symbol: '¥', locale: 'ja-JP' },
  { code: 'GBP', label: 'GBP — Bảng Anh', symbol: '£', locale: 'en-GB' },
  { code: 'CNY', label: 'CNY — Nhân dân tệ', symbol: '¥', locale: 'zh-CN' },
]

export function getCurrency(code: string) {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]
}

export function fmtCurrency(amount: number, currency = 'VND'): string {
  const c = getCurrency(currency)
  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫'
  }
  return c.symbol + new Intl.NumberFormat(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function currencySymbol(currency = 'VND'): string {
  return getCurrency(currency).symbol
}
