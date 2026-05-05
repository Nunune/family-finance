export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MEMBER'
  familyId: string | null
}

export interface Family {
  id: string
  name: string
  members: FamilyMember[]
}

export interface FamilyMember {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MEMBER'
  createdAt: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'INCOME' | 'EXPENSE' | 'BOTH'
  isDefault: boolean
  userId?: string | null
}

export interface TransactionLog {
  id: string
  action: 'created' | 'updated' | 'deleted'
  byUserId: string
  byUserName: string
  snapshot: string
  createdAt: string
}

export interface Transaction {
  id: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  date: string
  note?: string
  categoryId: string
  category: Category
  userId: string
  user: { id: string; name: string }
  walletId: string
  pocketId?: string | null
  pocket?: WalletPocket | null
  transferGroupId?: string | null
  logs?: TransactionLog[]
  createdAt: string
}

// ─── Transfer ───────────────────────────────────────────────────────────────

export interface TransferWallet {
  key: string
  label: string
  walletType: 'PERSONAL' | 'SHARED' | 'SUBFUND'
  subFundId?: string
}

export interface Summary {
  totalIncome: number
  totalExpense: number
  balance: number
  walletBalance: number
  initialBalance: number
  byDay: { date: string; income: number; expense: number }[]
  byCategory: { name: string; color: string; icon: string; total: number }[]
}

export type WalletType = 'PERSONAL' | 'SHARED' | 'SUBFUND'

export interface WalletPocket {
  id: string
  walletId: string
  name: string
  icon: string
  color: string
  balance: number
  isHidden: boolean
  order: number
  createdAt: string
}

// ─── Debt & Loans ───────────────────────────────────────────────────────────

export interface DebtPayment {
  id: string
  debtId: string
  amount: number
  date: string
  note?: string
  paidByUserId: string
  paidBy?: { id: string; name: string }
  createdAt: string
}

export interface DebtViewer {
  id: string
  debtId: string
  userId: string
  user?: { id: string; name: string }
}

export interface Debt {
  id: string
  title: string
  type: 'BORROWED' | 'LENT'
  scope: 'PERSONAL' | 'SHARED' | 'INTERNAL'
  originalAmount: number
  remainingAmount: number
  counterparty: string
  note?: string
  dueDate?: string
  ownerId: string
  lenderUserId?: string
  borrowerUserId?: string
  walletId?: string
  familyId?: string
  owner?: { id: string; name: string }
  viewers?: DebtViewer[]
  payments?: DebtPayment[]
  createdAt: string
  updatedAt: string
}

// ─── Recurring Transactions ─────────────────────────────────────────────────

export interface RecurringTransaction {
  id: string
  title: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId: string
  category?: Category
  walletType: 'PERSONAL' | 'SHARED'
  frequency: 'MONTHLY' | 'WEEKLY'
  dayOfMonth?: number
  dayOfWeek?: number
  remindDays: number
  ownerId: string
  familyId?: string
  isActive: boolean
  nextDue: string
  createdAt: string
}

// ─── Savings Goals ──────────────────────────────────────────────────────────

export interface SavingsContribution {
  id: string
  goalId: string
  userId: string
  amount: number
  type: 'DEPOSIT' | 'WITHDRAWAL'
  note?: string
  date: string
  user?: { id: string; name: string }
  createdAt: string
}

export interface SavingsWithdrawalApproval {
  id: string
  requestId: string
  userId: string
  user: { id: string; name: string }
  approved: boolean
  createdAt: string
}

export interface SavingsWithdrawalRequest {
  id: string
  goalId: string
  requestedById: string
  requestedBy: { id: string; name: string }
  amount: number
  note: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  processedAt: string | null
  createdAt: string
  approvals: SavingsWithdrawalApproval[]
}

export interface SavingsGoal {
  id: string
  name: string
  icon: string
  targetAmount: number
  targetDate: string
  savedAmount: number
  ownerId: string
  familyId?: string | null
  isShared: boolean
  isCompleted: boolean
  contributions: SavingsContribution[]
  withdrawalRequests: SavingsWithdrawalRequest[]
  createdAt: string
  updatedAt: string
}

// ─── Sub Funds (Quỹ phụ) ────────────────────────────────────────────────────

export interface SubFundMember {
  id: string
  subFundId: string
  userId: string
  role: 'ADMIN' | 'MEMBER'
  user: { id: string; name: string; role: string }
  createdAt: string
}

export interface SubFund {
  id: string
  name: string
  icon: string
  description?: string | null
  familyId: string
  wallet: { id: string; initialBalance: number } | null
  members: SubFundMember[]
  balance: number
  createdAt: string
  updatedAt: string
}

// ─── Plan Items (Dự thu / Dự chi) ───────────────────────────────────────────

export type PlanFrequency = 'ONCE' | 'MONTHLY' | 'WEEKLY'

export interface PlanItem {
  id: string
  title: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId?: string | null
  category?: Category | null
  note?: string | null
  frequency: PlanFrequency
  dueDay?: number | null
  dueDate?: string | null
  remindDays: number
  isActive: boolean
  userId: string
  // enriched by API for a given month:
  periodKey?: string
  isDone?: boolean
  doneAt?: string | null
  isDueSoon?: boolean
  createdAt: string
  updatedAt: string
}

// ─── Weekly Budgets ─────────────────────────────────────────────────────────

export interface WeeklyBudget {
  id: string
  userId: string
  categoryId: string
  limitAmount: number
  alertPct: number
  category: Category
  createdAt: string
  updatedAt: string
}

export type BudgetStatus = 'EXCEEDED' | 'WARNING' | 'OK'

export interface WeeklyCategorySummary {
  categoryId: string
  name: string
  icon: string
  color: string
  amount: number
  budget: { limitAmount: number; alertPct: number } | null
  usedPct: number | null
  budgetStatus: BudgetStatus | null
}

export interface WeeklySummary {
  weeks: { weeksAgo: number; label: string; startDate: string; endDate: string; expense: number }[]
  thisWeek: number
  avgExpense: number
  ratio: number
  alert: 'HIGH' | 'MODERATE' | 'NORMAL' | 'GOOD' | null
  topCategories: WeeklyCategorySummary[]
  projectedWeek: number
  daysElapsed: number
}

// ─── Hụi ────────────────────────────────────────────────────────────────────

export interface HuiRound {
  id: string
  huiId: string
  roundNo: number
  ownerName?: string | null
  bidAmount?: number | null  // giá kêu; null = không ai kêu → đóng giá gốc
  dueDate: string
  isPaid: boolean
  isReceived: boolean
  paidAt?: string | null
  createdAt: string
}

export interface Hui {
  id: string
  name: string
  amount: number
  totalRounds: number
  myRound: number
  startDate: string
  frequency: 'MONTHLY' | 'WEEKLY'
  status: 'ACTIVE' | 'COMPLETED'
  organizerFee?: number | null
  userId: string
  rounds: HuiRound[]
  createdAt: string
  updatedAt: string
}

// ─── Family Report ───────────────────────────────────────────────────────────

export interface FamilyReport {
  month: string
  members: { userId: string; name: string; personalIncome: number; personalExpense: number }[]
  shared: { income: number; expense: number }
  subFunds: { id: string; name: string; icon: string; income: number; expense: number }[]
  grandTotal: { income: number; expense: number; net: number }
  categoryBreakdown: { name: string; icon: string; color: string; amount: number }[]
}

export interface TransactionProposal {
  id: string
  recurringId: string
  amount: number
  type: 'INCOME' | 'EXPENSE'
  categoryId: string
  walletType: 'PERSONAL' | 'SHARED'
  scheduledDate: string
  confirmationCode: string
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED'
  expiresAt: string
  confirmedAt?: string
  recurring?: RecurringTransaction
  createdAt: string
}
