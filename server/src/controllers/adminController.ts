import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getStats(req: AuthRequest, res: Response) {
  if (!req.isAppAdmin) return res.status(403).json({ error: 'Forbidden' })

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(startOfToday)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)

  const [
    totalUsers,
    newThisWeek,
    newThisMonth,
    totalFamilies,
    walletCounts,
    totalSubFunds,
    recentUsers,
    dailySignups,
    activeUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.family.count(),
    (prisma as any).wallet.groupBy({ by: ['type'], _count: { id: true } }),
    (prisma as any).subFund.count(),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, email: true, familyId: true, role: true, isAppAdmin: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Active = had at least one transaction in last 30 days
    prisma.transaction.groupBy({
      by: ['userId'],
      where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
  ])

  // Build daily signup map for last 30 days
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo)
    d.setDate(d.getDate() + i)
    dailyMap[d.toISOString().slice(0, 10)] = 0
  }
  dailySignups.forEach((u: { createdAt: Date }) => {
    const key = u.createdAt.toISOString().slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  })
  const growth = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  const walletBreakdown: Record<string, number> = {}
  ;(walletCounts as { type: string; _count: { id: number } }[]).forEach(w => {
    walletBreakdown[w.type] = w._count.id
  })

  res.json({
    summary: {
      totalUsers,
      newThisWeek,
      newThisMonth,
      totalFamilies,
      totalSubFunds,
      wallets: walletBreakdown,
      activeUsersLast30d: activeUsers.length,
    },
    growth,
    recentUsers,
  })
}

export async function promoteUser(req: AuthRequest, res: Response) {
  const { email, secret } = req.body
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || secret !== adminSecret) {
    return res.status(403).json({ error: 'Invalid secret' })
  }
  const user = await prisma.user.update({
    where: { email },
    data: { isAppAdmin: true },
    select: { id: true, name: true, email: true, role: true, isAppAdmin: true },
  })
  res.json({ success: true, user })
}

export async function exportBackup(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!

    if (!req.isAppAdmin) {
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
