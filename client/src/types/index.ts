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
  logs?: TransactionLog[]
  createdAt: string
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

export type WalletType = 'PERSONAL' | 'SHARED'

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
