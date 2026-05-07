// Shared amount parser — used in TransactionForm, DebtForm, DebtPaymentForm
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '')
  if (!s) return null

  // Compact: 1tr5=1.5M | 1tr50=1.05M | 2tr630=2.63M | 2k3=2.3k | 2k30=2.03k
  const ctr = s.match(/^(\d+)\s*(?:tr|triệu|củ)\s*([1-9]\d{0,2})$/i)
  if (ctr) {
    const suffix = parseInt(ctr[2])
    const mul = ctr[2].length === 1 ? 100_000 : ctr[2].length === 2 ? 10_000 : 1_000
    return parseInt(ctr[1]) * 1_000_000 + suffix * mul
  }

  const ck = s.match(/^(\d+)\s*k\s*([1-9]\d{0,2})$/i)
  if (ck) {
    const suffix = parseInt(ck[2])
    const mul = ck[2].length === 1 ? 100 : ck[2].length === 2 ? 10 : 1
    return parseInt(ck[1]) * 1_000 + suffix * mul
  }

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
