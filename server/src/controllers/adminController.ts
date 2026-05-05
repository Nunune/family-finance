import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function exportBackup(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!

    if (req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Admin mới có thể xuất backup' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { familyId: true, name: true },
    })

    const familyId = user?.familyId ?? null

    const [
      transactions,
      debts,
      savingsGoals,
      recurrings,
      familyInfo,
    ] = await Promise.all([
      // Transactions: personal + shared
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          OR: [
            { wallet: { userId } },
            ...(familyId ? [{ wallet: { familyId } }] : []),
          ],
        },
        include: {
          category: { select: { name: true, icon: true } },
          user: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),

      // Debts
      prisma.debt.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(familyId ? [{ scope: 'SHARED', familyId }] : []),
          ],
        },
        include: {
          payments: { include: { paidBy: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Savings goals
      prisma.savingsGoal.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(familyId ? [{ isShared: true, familyId }] : []),
          ],
        },
        include: {
          contributions: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Recurring transactions
      prisma.recurringTransaction.findMany({
        where: {
          OR: [
            { ownerId: userId },
            ...(familyId ? [{ familyId }] : []),
          ],
        },
        include: { category: { select: { name: true, icon: true } } },
        orderBy: { createdAt: 'asc' },
      }),

      // Family members (if in a family)
      familyId
        ? prisma.family.findUnique({
            where: { id: familyId },
            include: {
              members: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
            },
          })
        : null,
    ])

    const exportedAt = new Date().toISOString()
    const payload = {
      exportedAt,
      exportedBy: user?.name,
      family: familyInfo,
      transactions,
      debts,
      savingsGoals,
      recurrings,
    }

    const now = new Date()
    const filename = `backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(payload)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
