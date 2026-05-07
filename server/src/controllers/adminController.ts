import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { runBackupForUser } from '../jobs/backupJob'

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

export async function resetMyData(req: AuthRequest, res: Response) {
  try {
    if (!req.isAppAdmin) return res.status(403).json({ error: 'Forbidden' })
    const userId = req.userId!

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const wallets = await prisma.wallet.findMany({ where: { userId, type: 'PERSONAL' } })
    const walletIds = wallets.map((w: any) => w.id)

    const debts = await prisma.debt.findMany({ where: { ownerId: userId } })
    const debtIds = debts.map((d: any) => d.id)

    const huis = await prisma.hui.findMany({ where: { userId } })
    const huiIds = huis.map((h: any) => h.id)

    const goals = await prisma.savingsGoal.findMany({ where: { ownerId: userId } })
    const goalIds = goals.map((g: any) => g.id)

    const recurrings = await prisma.recurringTransaction.findMany({ where: { ownerId: userId } })
    const recurringIds = recurrings.map((r: any) => r.id)

    await prisma.$transaction(async (tx: any) => {
      // Pockets
      if (walletIds.length) {
        const pockets = await tx.walletPocket.findMany({ where: { walletId: { in: walletIds } } })
        const pocketIds = pockets.map((p: any) => p.id)
        if (pocketIds.length) {
          await tx.pocketEntry.deleteMany({ where: { pocketId: { in: pocketIds } } })
          await tx.walletPocket.deleteMany({ where: { id: { in: pocketIds } } })
        }
        // Delete transaction logs first (RESTRICT FK)
        await tx.transactionLog.deleteMany({ where: { transaction: { walletId: { in: walletIds } } } })
        // All transactions (hard delete for fresh start)
        await tx.transaction.deleteMany({ where: { walletId: { in: walletIds } } })
        // Reset balance
        await tx.wallet.updateMany({ where: { id: { in: walletIds } }, data: { initialBalance: 0, closedAt: null } })
      }

      // Debts
      if (debtIds.length) {
        await tx.debtPayment.deleteMany({ where: { debtId: { in: debtIds } } })
        await tx.debtViewer.deleteMany({ where: { debtId: { in: debtIds } } })
        await tx.debt.deleteMany({ where: { id: { in: debtIds } } })
      }

      // Recurring
      if (recurringIds.length) {
        await tx.transactionProposal.deleteMany({ where: { recurringId: { in: recurringIds } } })
        await tx.recurringTransaction.deleteMany({ where: { id: { in: recurringIds } } })
      }

      // Savings
      if (goalIds.length) {
        const requests = await tx.savingsWithdrawalRequest.findMany({ where: { goalId: { in: goalIds } } })
        const reqIds = requests.map((r: any) => r.id)
        if (reqIds.length) {
          await tx.savingsWithdrawalApproval.deleteMany({ where: { requestId: { in: reqIds } } })
          await tx.savingsWithdrawalRequest.deleteMany({ where: { id: { in: reqIds } } })
        }
        await tx.savingsContribution.deleteMany({ where: { goalId: { in: goalIds } } })
        await tx.savingsGoal.deleteMany({ where: { id: { in: goalIds } } })
      }

      // Plan items, hui, exchange rates, labels, categories, budgets
      await tx.planItem.deleteMany({ where: { userId } })
      if (huiIds.length) {
        await tx.huiRound.deleteMany({ where: { huiId: { in: huiIds } } })
        await tx.hui.deleteMany({ where: { id: { in: huiIds } } })
      }
      await tx.exchangeRate.deleteMany({ where: { userId } })
      await tx.recipientLabel.deleteMany({ where: { userId } })
      await tx.category.deleteMany({ where: { userId } })
      await tx.weeklyBudget.deleteMany({ where: { userId } })
      const budgets = await tx.monthlyBudget.findMany({ where: { userId } })
      if (budgets.length) {
        await tx.monthlyBudgetItem.deleteMany({ where: { budgetId: { in: budgets.map((b: any) => b.id) } } })
        await tx.monthlyBudget.deleteMany({ where: { userId } })
      }
      await tx.subFundMember.deleteMany({ where: { userId } })

      // Delete foreign currency wallets, keep primary
      if (wallets.length > 1) {
        const foreignIds = wallets.slice(1).map((w: any) => w.id)
        await tx.wallet.deleteMany({ where: { id: { in: foreignIds } } })
      }

      // Leave family
      if (user.familyId) {
        const memberCount = await tx.user.count({ where: { familyId: user.familyId } })
        if (memberCount === 1) {
          const sharedWallet = await tx.wallet.findUnique({ where: { familyId: user.familyId } })
          if (sharedWallet) {
            await tx.transactionLog.deleteMany({ where: { transaction: { walletId: sharedWallet.id } } })
            await tx.transaction.deleteMany({ where: { walletId: sharedWallet.id } })
            await tx.wallet.delete({ where: { id: sharedWallet.id } })
          }
          await tx.familyInvite.deleteMany({ where: { familyId: user.familyId } })
          await tx.family.delete({ where: { id: user.familyId } })
        }
        await tx.user.update({ where: { id: userId }, data: { familyId: null, role: 'MEMBER' } })
      }
    })

    res.json({ success: true, message: 'Đã reset toàn bộ dữ liệu. Tài khoản sạch!' })
  } catch (err) {
    console.error('[resetMyData]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
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

export async function triggerBackup(req: AuthRequest, res: Response) {
  const { secret, email } = req.body
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || secret !== adminSecret) return res.status(403).json({ error: 'Invalid secret' })
  if (!email) return res.status(400).json({ error: 'email required' })
  try {
    await runBackupForUser(email)
    res.json({ success: true, message: `Sent to ${email}` })
  } catch (err: any) {
    console.error('[triggerBackup]', err)
    res.status(500).json({ error: err.message ?? 'Lỗi server' })
  }
}

export async function sendBackupNow(req: AuthRequest, res: Response) {
  if (!req.isAppAdmin) return res.status(403).json({ error: 'Forbidden' })
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(503).json({ error: 'Chưa cấu hình Gmail — cần GMAIL_USER, GMAIL_APP_PASSWORD' })
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    await runBackupForUser(user.email)
    res.json({ success: true, message: `Đã gửi backup tới ${user.email}` })
  } catch (err: any) {
    console.error('[sendBackupNow]', err)
    res.status(500).json({ error: err.message ?? 'Lỗi server' })
  }
}
