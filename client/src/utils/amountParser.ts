// Shared amount parser — used in TransactionForm, DebtForm, DebtPaymentForm
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '')
  if (!s) return null

  // Compact: 1tr5 = 1,500,000 | 2k3 = 2,300
  const ctr = s.match(/^(\d+)\s*(?:tr|triệu|củ)\s*([1-9])$/i)
  if (ctr) return parseInt(ctr[1]) * 1_000_000 + parseInt(ctr[2]) * 100_000

  const ck = s.match(/^(\d+)\s*k\s*([1-9])$/i)
  if (ck) return parseInt(ck[1]) * 1_000 + parseInt(ck[2]) * 100

  // With unit suffix
  const tr = s.match(/^([\d.,]+)\s*(?:tr|triệu|củ)$/i)
  if (tr) return Math.round(parseFloat(tr[1].replace(',', '.')) * 1_000_000)

  const k = s.match(/^([\d.,]+)\s*(?:k|nghìn|ngàn)$/i)
  if (k) return Math.round(parseFloat(k[1].replace(',', '.')) * 1_000)

  // Thousands-separated: 1.500.000 | 1,500,000
  const withSep = s.match(/^\d{1,3}([.,]\d{3})+$/)
  if (withSep) return parseInt(s.replace(/[.,]/g, ''))

  // Plain integer
  const plain = parseFloat(s.replace(',', '.'))
  if (!isNaN(plain) && plain > 0) return plain
  return null
}

export function fmtVND(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫'
}
