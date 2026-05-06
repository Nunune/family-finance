import { Category } from '../types'
import { subDays } from 'date-fns'

export type Confidence = 'high' | 'low' | 'none'

export interface ParseResult {
  amount: number | null
  amountConfidence: Confidence
  amountRaw: string
  type: 'INCOME' | 'EXPENSE'
  typeConfidence: Confidence
  categoryId: string | null
  categoryName: string | null
  categoryConfidence: Confidence
  date: Date
  dateConfidence: Confidence
  note: string
  overallReady: boolean // true chỉ khi amount + category đều high confidence
}

// ─── Amount ────────────────────────────────────────────────────────────────

/**
 * Chuẩn hoá chuỗi số VN:
 *   "1.500.000" | "1,500,000"  → 1500000  (dấu ngàn lặp lại)
 *   "150.000"   | "150,000"    → 150000   (dấu ngàn 1 lần, sau là đúng 3 chữ số)
 *   "1.5"       | "1,5"        → 1.5      (thập phân, sau là 1-2 chữ số)
 *   "150000"                   → 150000   (số nguyên thuần)
 */
function normalizeVNNumber(s: string): number | null {
  s = s.trim()
  // Dấu ngàn lặp: 1.500.000 hoặc 1,500,000
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''))
  // Dấu ngàn đơn: 150.000 hoặc 150,000
  if (/^\d+[.,]\d{3}$/.test(s)) return parseInt(s.replace(/[.,]/g, ''))
  // Thập phân: 1.5 hoặc 1,5
  if (/^\d+[.,]\d{1,2}$/.test(s)) return parseFloat(s.replace(',', '.'))
  // Số nguyên
  if (/^\d+$/.test(s)) return parseInt(s)
  return null
}

// Gộp số tách ngàn bằng dấu cách: "50 000" → "50000", "1 500 000" → "1500000"
function normalizeSpaces(s: string): string {
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(/(\d+)\s+(\d{3})(?!\d)/g, '$1$2')
  }
  return s
}

// Pattern số trong văn bản (có thể chứa dấu chấm/phẩy ngàn)
const NUM = /(\d[\d.,]*)/

const AMOUNT_PATTERNS: { re: RegExp; mul: number }[] = [
  { re: new RegExp(`${NUM.source}\\s*(?:triệu|tr)\\b`, 'i'), mul: 1_000_000 },
  { re: new RegExp(`${NUM.source}\\s*(?:củ|lít)\\b`, 'i'),   mul: 1_000_000 },
  { re: new RegExp(`${NUM.source}\\s*(?:nghìn|ngàn)\\b`, 'i'), mul: 1_000 },
  { re: new RegExp(`${NUM.source}\\s*k\\b`, 'i'),             mul: 1_000 },
]

function parseAmount(text: string): { amount: number | null; confidence: Confidence; raw: string } {
  // Chuẩn hoá khoảng trắng ngàn: "50 000" → "50000"
  const t = normalizeSpaces(text)

  // Ưu tiên "Xtr rưỡi" / "Xk rưỡi" — phải check trước khi match đơn vị thông thường
  const ruoiTr = t.match(/(\d[\d.,]*)\s*(?:triệu|tr|củ)\s+rưỡi/i)
  if (ruoiTr) {
    const base = normalizeVNNumber(ruoiTr[1])
    if (base !== null) return { amount: Math.round((base + 0.5) * 1_000_000), confidence: 'high', raw: ruoiTr[0] }
  }
  const ruoiK = t.match(/(\d[\d.,]*)\s*(?:nghìn|ngàn|k)\s+rưỡi/i)
  if (ruoiK) {
    const base = normalizeVNNumber(ruoiK[1])
    if (base !== null) return { amount: Math.round((base + 0.5) * 1_000), confidence: 'high', raw: ruoiK[0] }
  }

  // Compact notation: "1tr5" = 1.5tr = 1,500,000; "2k3" = 2,300
  const compactTr = t.match(/(\d+)\s*(?:triệu|tr|củ|lít)\s*([1-9])(?!\d)/i)
  if (compactTr) {
    const base = parseInt(compactTr[1])
    const suffix = parseInt(compactTr[2])
    return { amount: base * 1_000_000 + suffix * 100_000, confidence: 'high', raw: compactTr[0] }
  }
  const compactK = t.match(/(\d+)\s*(?:nghìn|ngàn|k)\s*([1-9])(?!\d)/i)
  if (compactK) {
    const base = parseInt(compactK[1])
    const suffix = parseInt(compactK[2])
    return { amount: base * 1_000 + suffix * 100, confidence: 'high', raw: compactK[0] }
  }

  // Pattern có đơn vị rõ ràng
  for (const { re, mul } of AMOUNT_PATTERNS) {
    const m = t.match(re)
    if (m) {
      const num = normalizeVNNumber(m[1])
      if (num !== null) return { amount: Math.round(num * mul), confidence: 'high', raw: m[0] }
    }
  }

  // Currency prefix: $50, A$50, S$50, €100, £30, ¥500 → plain number, high confidence
  const currencyMatch = t.match(/(?:A\$|S\$|[€£¥\$])\s*(\d[\d.,]*)/)
  if (currencyMatch) {
    const num = normalizeVNNumber(currencyMatch[1])
    if (num !== null) return { amount: num, confidence: 'high', raw: currencyMatch[0] }
  }

  // Số lớn không đơn vị — thử normalise trước, nếu >= 4 chữ số sau loại dấu ngàn
  const rawNum = t.match(/(\d[\d.,]*)/)
  if (rawNum) {
    const num = normalizeVNNumber(rawNum[1])
    if (num !== null) {
      if (num >= 1_000) return { amount: num, confidence: 'high', raw: rawNum[0] }
      // Số nhỏ (< 1000) không đơn vị → yêu cầu xác nhận
      return { amount: num * 1_000, confidence: 'low', raw: rawNum[0] }
    }
  }

  return { amount: null, confidence: 'none', raw: '' }
}

// ─── Type ──────────────────────────────────────────────────────────────────

const INCOME_KEYWORDS = [
  // nhận tiền
  'nhận được', 'nhận trúng', 'nhận lại', 'nhận', 'được chuyển', 'được trả', 'được thưởng',
  // kiếm / thu
  'kiếm được', 'kiếm', 'thu nhập', 'thu được', 'thu về', 'tiền về',
  // trúng
  'trúng số', 'trúng thưởng', 'trúng giải', 'trúng',
  // từ công việc
  'lương', 'thưởng', 'bonus', 'freelance', 'làm thêm', 'part time',
  // hoàn tiền / bán / cho vay
  'hoàn tiền', 'hoàn lại', 'hoàn', 'bán được', 'bán', 'cho vay', 'cho thuê',
  // tài chính
  'lãi', 'cổ tức', 'đầu tư về',
  // "được" đứng độc lập — chỉ bắt khi không có context chi tiêu
  'được',
]
const EXPENSE_KEYWORDS = ['mua', 'trả', 'đóng', 'nạp', 'thuê', 'chi', 'tiêu', 'phí', 'tiền', 'góp', 'ăn', 'uống', 'đổ xăng']

function parseType(text: string): { type: 'INCOME' | 'EXPENSE'; confidence: Confidence } {
  const lower = text.toLowerCase()
  const hasExpense = EXPENSE_KEYWORDS.some(kw => lower.includes(kw))

  for (const kw of INCOME_KEYWORDS) {
    if (!lower.includes(kw)) continue
    // "được" đứng độc lập nhưng có từ chi tiêu đi kèm → vẫn là chi (vd: "mua được")
    if (kw === 'được' && hasExpense) continue
    return { type: 'INCOME', confidence: 'high' }
  }
  if (hasExpense) return { type: 'EXPENSE', confidence: 'high' }
  return { type: 'EXPENSE', confidence: 'low' }
}

// ─── Category ──────────────────────────────────────────────────────────────

// Keyword → category name (map theo tên danh mục trong seed)
const CATEGORY_KEYWORDS: { keywords: string[]; category: string; type: 'INCOME' | 'EXPENSE' | 'BOTH' }[] = [
  { keywords: ['ăn', 'cơm', 'bún', 'phở', 'bánh', 'cafe', 'cà phê', 'cà fe', 'coffee', 'cf', 'trà sữa', 'trà đá', 'grab food', 'grabfood', 'baemin', 'shopeefood', 'đồ ăn', 'ăn sáng', 'ăn trưa', 'ăn tối', 'ăn vặt', 'snack'], category: 'Ăn uống', type: 'EXPENSE' },
  { keywords: ['grab', 'xăng', 'đổ xăng', 'gửi xe', 'taxi', 'xe buýt', 'bus', 'gojek', 'be ', 'vé xe', 'vé tàu', 'vé máy bay', 'đi lại'], category: 'Di chuyển', type: 'EXPENSE' },
  { keywords: ['điện', 'tiền điện', 'nước', 'tiền nước', 'internet', 'wifi', 'điện thoại', 'bill', 'hóa đơn', 'thuê nhà', 'tiền nhà', 'tiền phòng', 'tiền trọ'], category: 'Hóa đơn', type: 'EXPENSE' },
  { keywords: ['mua', 'shopping', 'quần áo', 'giày', 'shopee', 'lazada', 'tiki', 'siêu thị', 'chợ'], category: 'Mua sắm', type: 'EXPENSE' },
  { keywords: ['học', 'học phí', 'sách', 'khóa học', 'gia sư', 'trường', 'học thêm'], category: 'Giáo dục', type: 'EXPENSE' },
  { keywords: ['thuốc', 'bác sĩ', 'khám', 'bệnh viện', 'phòng khám', 'y tế'], category: 'Sức khỏe', type: 'EXPENSE' },
  { keywords: ['phim', 'game', 'netflix', 'spotify', 'youtube premium', 'du lịch', 'giải trí', 'sinh nhật', 'quà', 'tặng'], category: 'Giải trí', type: 'EXPENSE' },
  { keywords: ['lương', 'lương tháng', 'freelance', 'làm thêm', 'part time', 'thu nhập'], category: 'Lương', type: 'INCOME' },
  { keywords: ['thưởng', 'bonus', 'thưởng tết', 'trúng số', 'trúng thưởng', 'trúng giải', 'trúng'], category: 'Thưởng', type: 'INCOME' },
  { keywords: ['đầu tư', 'cổ tức', 'lãi', 'lãi suất', 'chứng khoán', 'crypto'], category: 'Đầu tư', type: 'INCOME' },
  { keywords: ['bán được', 'bán', 'cho thuê'], category: 'Khác (thu)', type: 'INCOME' },
]

function parseCategory(
  text: string,
  transactionType: 'INCOME' | 'EXPENSE',
  categories: Category[],
  userPatterns: UserPattern[]
): { categoryId: string | null; categoryName: string | null; confidence: Confidence } {
  const lower = text.toLowerCase()

  // 1. Ưu tiên user pattern (đã học từ thói quen)
  const phraseMatch = userPatterns
    .filter(p => p.type === transactionType)
    .sort((a, b) => b.count - a.count)
    .find(p => lower.includes(p.keyword.toLowerCase()))

  if (phraseMatch) {
    const cat = categories.find(c => c.id === phraseMatch.categoryId)
    if (cat) return { categoryId: cat.id, categoryName: cat.name, confidence: 'high' }
  }

  // 2. Keyword map tĩnh — ưu tiên match theo phrase (dài hơn = chính xác hơn)
  const sorted = [...CATEGORY_KEYWORDS].sort((a, b) => {
    const aMax = Math.max(...a.keywords.map(k => k.length))
    const bMax = Math.max(...b.keywords.map(k => k.length))
    return bMax - aMax
  })

  for (const entry of sorted) {
    if (entry.type !== 'BOTH' && entry.type !== transactionType) continue
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        const cat = categories.find(c => c.name === entry.category)
        if (cat) return { categoryId: cat.id, categoryName: cat.name, confidence: 'high' }
      }
    }
  }

  // 3. Không tìm được → trả về none, không đoán mò
  return { categoryId: null, categoryName: null, confidence: 'none' }
}

// ─── Date ──────────────────────────────────────────────────────────────────

function parseDate(text: string): { date: Date; confidence: Confidence } {
  const lower = text.toLowerCase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (lower.includes('hôm qua') || lower.includes('tối qua') || lower.includes('sáng qua')) {
    return { date: subDays(today, 1), confidence: 'high' }
  }
  if (lower.includes('hôm kia')) return { date: subDays(today, 2), confidence: 'high' }
  if (lower.includes('hôm nay') || lower.includes('sáng nay') || lower.includes('tối nay') || lower.includes('trưa nay')) {
    return { date: today, confidence: 'high' }
  }

  const dayMatch = lower.match(/ngày\s+(\d{1,2})(?:\/(\d{1,2}))?/)
  if (dayMatch) {
    const day = parseInt(dayMatch[1])
    const month = dayMatch[2] ? parseInt(dayMatch[2]) - 1 : today.getMonth()
    const d = new Date(today.getFullYear(), month, day)
    return { date: d, confidence: 'high' }
  }

  return { date: today, confidence: 'low' }
}

// ─── Note ──────────────────────────────────────────────────────────────────

function extractNote(text: string, amountRaw: string): string {
  let note = text
  if (amountRaw) note = note.replace(amountRaw, '')
  // Bỏ các từ khóa đã parse
  const stopWords = ['hôm nay', 'hôm qua', 'hôm kia', 'sáng nay', 'tối qua', 'tối nay', 'trưa nay']
  stopWords.forEach(w => { note = note.replace(new RegExp(w, 'gi'), '') })
  return note.replace(/\s+/g, ' ').trim()
}

// ─── UserPattern ───────────────────────────────────────────────────────────

export interface UserPattern {
  keyword: string
  categoryId: string
  type: 'INCOME' | 'EXPENSE'
  count: number
}

const PATTERNS_KEY = 'ff_user_patterns'

export function loadUserPatterns(): UserPattern[] {
  try { return JSON.parse(localStorage.getItem(PATTERNS_KEY) || '[]') }
  catch { return [] }
}

export function learnPattern(keyword: string, categoryId: string, type: 'INCOME' | 'EXPENSE') {
  const patterns = loadUserPatterns()
  const existing = patterns.find(p => p.keyword === keyword && p.type === type)
  if (existing) {
    existing.categoryId = categoryId
    existing.count++
  } else {
    patterns.push({ keyword, categoryId, type, count: 1 })
  }
  localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns))
}

export function clearPatterns() {
  localStorage.removeItem(PATTERNS_KEY)
}

// ─── Debt detection ────────────────────────────────────────────────────────

export interface DebtParseResult {
  debtType: 'BORROWED' | 'LENT'
  amount: number | null
  amountConfidence: Confidence
  amountRaw: string
  counterparty: string
}

// Từ khoá LENT — ưu tiên compound trước, bare keyword sau
const DEBT_LENT_KW = [
  // cho vay / cho mượn
  'đã cho vay', 'có cho vay', 'đã cho mượn', 'cho mượn', 'cho vay',
  // giùm / dùm / giúp — trả/mua/đóng hộ người khác
  'thanh toán giùm', 'thanh toán dùm',
  'trả giùm', 'trả dùm', 'mua giùm', 'mua dùm',
  'đóng giùm', 'đóng dùm', 'nộp giùm', 'nộp dùm',
  'chuyển giùm', 'chuyển dùm', 'nạp giùm', 'nạp dùm',
  'giùm', 'dùm', 'giúp',
]
const DEBT_BORROWED_KW = ['đang mượn', 'đang vay', 'mới vay', 'mới mượn', 'vay từ', 'mượn từ', 'vay', 'mượn']

// Động từ hành động đứng trước giùm/dùm — strip khi trích xuất counterparty
const ACTION_WORDS = ['thanh toán', 'trả', 'mua', 'đóng', 'nộp', 'chuyển', 'nạp', 'đi', 'làm', 'giúp']

export function parseDebt(text: string): DebtParseResult | null {
  const normalized = normalizeSpaces(text)
  const lower = normalized.toLowerCase().trim()

  let debtType: 'BORROWED' | 'LENT' | null = null
  let matchedKw = ''

  for (const kw of DEBT_LENT_KW) {
    if (lower.includes(kw)) { debtType = 'LENT'; matchedKw = kw; break }
  }
  if (!debtType) {
    for (const kw of DEBT_BORROWED_KW) {
      if (lower.includes(kw)) { debtType = 'BORROWED'; matchedKw = kw; break }
    }
  }
  if (!debtType) return null

  const { amount, confidence, raw: amountRaw } = parseAmount(normalized)

  // Bỏ keyword và chuỗi số/đơn vị → phần còn lại là tên người
  let remaining = normalized
  const kwIdx = lower.indexOf(matchedKw)
  remaining = remaining.slice(0, kwIdx) + remaining.slice(kwIdx + matchedKw.length)
  if (amountRaw) remaining = remaining.replace(amountRaw, '')
  remaining = remaining
    .replace(/\b(triệu|tr|củ|nghìn|ngàn|k)\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Strip action words ở đầu chuỗi (vd: "trả Hoa" → "Hoa")
  const lowerRemaining = remaining.toLowerCase()
  for (const action of ACTION_WORDS) {
    if (lowerRemaining.startsWith(action + ' ') || lowerRemaining === action) {
      remaining = remaining.slice(action.length).trim()
      break
    }
  }

  return { debtType, amount, amountConfidence: confidence, amountRaw, counterparty: remaining }
}

// ─── Main parse ────────────────────────────────────────────────────────────

export function parseInput(text: string, categories: Category[]): ParseResult {
  const patterns = loadUserPatterns()
  const t = normalizeSpaces(text)
  const { amount, confidence: amountConf, raw: amountRaw } = parseAmount(t)
  const { type, confidence: typeConf } = parseType(t)
  const { categoryId, categoryName, confidence: catConf } = parseCategory(t, type, categories, patterns)
  const { date, confidence: dateConf } = parseDate(t)
  const note = extractNote(t, amountRaw)

  const overallReady = amountConf === 'high' && catConf === 'high'

  return {
    amount, amountConfidence: amountConf, amountRaw,
    type, typeConfidence: typeConf,
    categoryId, categoryName, categoryConfidence: catConf,
    date, dateConfidence: dateConf,
    note,
    overallReady,
  }
}
