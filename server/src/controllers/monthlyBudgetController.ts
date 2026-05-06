import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
}

const includeItems = {
  items: {
    include: {
      category: { select: { id: true, name: true, icon: true, color: true } },
      recipientLabel: { select: { id: true, name: true, icon: true, color: true } },
    },
  },
}

export async function getMonthlyBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month phải có dạng YYYY-MM' })
    }

    let budget = await (prisma as any).monthlyBudget.findUnique({
      where: { userId_month: { userId, month } },
      include: includeItems,
    })

    // Auto-copy from previous month
    if (!budget) {
      const prev = prevMonth(month)
      const prevBudget = await (prisma as any).monthlyBudget.findUnique({
        where: { userId_month: { userId, month: prev } },
        include: { items: true },
      })
      if (prevBudget) {
        budget = await (prisma as any).monthlyBudget.create({
          data: {
            userId,
            month,
            amount: prevBudget.amount,
            items: {
              create: prevBudget.items.map((item: any) => ({
                categoryId: item.categoryId,
                recipientLabelId: item.recipientLabelId,
                amount: item.amount,
              })),
            },
          },
          include: includeItems,
        })
      }
    }

    // Compute spending for the month
    const { start, end } = monthRange(month)
    const txns = await prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: start, lt: end }, deletedAt: null },
      select: { amount: true, categoryId: true, recipientLabelId: true },
    })

    const totalSpent = txns.reduce((s, t) => s + t.amount, 0)
    const categorySpent: Record<string, number> = {}
    const recipientSpent: Record<string, number> = {}

    txns.forEach(t => {
      if (t.categoryId) categorySpent[t.categoryId] = (categorySpent[t.categoryId] || 0) + t.amount
      if (t.recipientLabelId) recipientSpent[t.recipientLabelId] = (recipientSpent[t.recipientLabelId] || 0) + t.amount
    })

    res.json({ budget, totalSpent, categorySpent, recipientSpent })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function upsertMonthlyBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { month, amount, items } = req.body

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month phải có dạng YYYY-MM' })
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }

    const existing = await (prisma as any).monthlyBudget.findUnique({
      where: { userId_month: { userId, month } },
    })

    let budget
    if (existing) {
      await (prisma as any).monthlyBudgetItem.deleteMany({ where: { budgetId: existing.id } })
      budget = await (prisma as any).monthlyBudget.update({
        where: { id: existing.id },
        data: {
          amount: parsedAmount,
          items: {
            create: (items || []).map((item: any) => ({
              categoryId: item.categoryId || null,
              recipientLabelId: item.recipientLabelId || null,
              amount: parseFloat(item.amount),
            })),
          },
        },
        include: includeItems,
      })
    } else {
      budget = await (prisma as any).monthlyBudget.create({
        data: {
          userId,
          month,
          amount: parsedAmount,
          items: {
            create: (items || []).map((item: any) => ({
              categoryId: item.categoryId || null,
              recipientLabelId: item.recipientLabelId || null,
              amount: parseFloat(item.amount),
            })),
          },
        },
        include: includeItems,
      })
    }

    res.json(budget)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteMonthlyBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { month } = req.params
    await (prisma as any).monthlyBudget.deleteMany({ where: { userId, month } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
