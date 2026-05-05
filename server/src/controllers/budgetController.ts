import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getBudgets(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const budgets = await (prisma as any).weeklyBudget.findMany({
      where: { userId },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    })
    res.json(budgets)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function upsertBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { categoryId } = req.params
    const { limitAmount, alertPct } = req.body

    const parsed = parseFloat(limitAmount)
    if (isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    const pct = parseInt(alertPct ?? '80')
    if (isNaN(pct) || pct < 10 || pct > 100) {
      return res.status(400).json({ error: 'Ngưỡng cảnh báo phải từ 10–100%' })
    }

    const cat = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })

    const budget = await (prisma as any).weeklyBudget.upsert({
      where: { userId_categoryId: { userId, categoryId } },
      update: { limitAmount: parsed, alertPct: pct },
      create: { userId, categoryId, limitAmount: parsed, alertPct: pct },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    })

    res.json(budget)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteBudget(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { categoryId } = req.params
    await (prisma as any).weeklyBudget.deleteMany({ where: { userId, categoryId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
