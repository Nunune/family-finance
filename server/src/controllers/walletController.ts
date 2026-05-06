import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listWallets(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    type WalletRow = { id: string; currency: string; name: string | null; initialBalance: number; createdAt: Date }
    const wallets: WalletRow[] = await (prisma.wallet as any).findMany({
      where: { userId, type: 'PERSONAL', closedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, currency: true, name: true, initialBalance: true, createdAt: true },
    })

    // Compute current balance from transactions in one query
    const txSums = await prisma.transaction.groupBy({
      by: ['walletId', 'type'],
      where: { walletId: { in: wallets.map(w => w.id) }, deletedAt: null },
      _sum: { amount: true },
    })

    const result = wallets.map(w => {
      const income = txSums.find(t => t.walletId === w.id && t.type === 'INCOME')?._sum.amount ?? 0
      const expense = txSums.find(t => t.walletId === w.id && t.type === 'EXPENSE')?._sum.amount ?? 0
      return { ...w, balance: w.initialBalance + income - expense }
    })

    res.json(result)
  } catch (e: any) {
    console.error('[listWallets]', e?.message ?? e)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { currency, name } = req.body
    if (!currency || !['AUD', 'USD', 'EUR', 'JPY', 'SGD', 'GBP', 'CNY'].includes(currency)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' })
    }
    const existing = await prisma.wallet.findFirst({ where: { userId, currency, type: 'PERSONAL' } })
    if (existing) return res.status(409).json({ error: `Đã có ví ${currency}` })

    const wallet = await prisma.wallet.create({
      data: { type: 'PERSONAL', userId, currency, name: name?.trim() || null },
      select: { id: true, currency: true, name: true, initialBalance: true, createdAt: true },
    })
    res.json(wallet)
  } catch (e: any) {
    console.error('[createWallet]', e?.message ?? e)
    res.status(500).json({ error: e?.message ?? 'Lỗi server' })
  }
}

export async function getWalletMonthly(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const monthCount = Math.min(parseInt(req.query.months as string) || 6, 12)

    type WalletMonthlyRow = { id: string; currency: string; name: string | null }
    const wallets: WalletMonthlyRow[] = await (prisma.wallet as any).findMany({
      where: { userId, type: 'PERSONAL', closedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, currency: true, name: true },
    })

    // Build month list oldest → newest
    const now = new Date()
    const monthList: string[] = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const startDate = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const txs = await prisma.transaction.findMany({
      where: {
        walletId: { in: wallets.map(w => w.id) },
        date: { gte: startDate, lt: endDate },
        deletedAt: null,
      } as any,
      select: { walletId: true, type: true, amount: true, date: true, transferGroupId: true },
    })

    const result = wallets.map(w => {
      const wTxs = txs.filter((t: any) => t.walletId === w.id && !t.transferGroupId)
      const data = monthList.map(month => {
        const [y, m] = month.split('-').map(Number)
        const mTxs = wTxs.filter((t: any) => {
          const d = new Date(t.date)
          return d.getFullYear() === y && (d.getMonth() + 1) === m
        })
        const income = mTxs.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0)
        const expense = mTxs.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0)
        return { month, income, expense }
      })
      return { id: w.id, currency: w.currency, name: w.name, data }
    })

    res.json({ months: monthList, wallets: result })
  } catch (e: any) {
    console.error('[getWalletMonthly]', e?.message ?? e)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function closeWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    const wallet = await prisma.wallet.findFirst({ where: { id, userId, type: 'PERSONAL' } })
    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví' })

    const primary = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (primary?.id === id) return res.status(400).json({ error: 'Không thể đóng ví chính' })

    const txSums = await prisma.transaction.groupBy({
      by: ['type'],
      where: { walletId: id, deletedAt: null },
      _sum: { amount: true },
    })
    const income = txSums.find(t => t.type === 'INCOME')?._sum.amount ?? 0
    const expense = txSums.find(t => t.type === 'EXPENSE')?._sum.amount ?? 0
    const balance = wallet.initialBalance + income - expense

    if (Math.abs(balance) > 0.005) {
      return res.status(400).json({ error: `Số dư ví còn ${balance} — cần về 0 trước khi đóng` })
    }

    await (prisma.wallet as any).update({ where: { id }, data: { closedAt: new Date() } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const wallet = await prisma.wallet.findFirst({ where: { id, userId, type: 'PERSONAL' } })
    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy' })

    // Prevent deleting the primary (VND) wallet
    const primary = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (primary?.id === id) return res.status(400).json({ error: 'Không thể xoá ví chính' })

    const txCount = await prisma.transaction.count({ where: { walletId: id, deletedAt: null } })
    if (txCount > 0) return res.status(400).json({ error: `Ví còn ${txCount} giao dịch, hãy xoá hoặc chuyển trước` })

    await prisma.wallet.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getBalanceHistory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const month = parseInt(req.query.month as string)
    const year = parseInt(req.query.year as string)
    const walletType = (req.query.walletType as string) || 'PERSONAL'

    if (!month || !year) return res.status(400).json({ error: 'Thiếu tháng/năm' })

    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 1))

    let wallets: any[]
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      if (!wallet) return res.json([])
      wallets = [wallet]
    } else {
      wallets = await prisma.wallet.findMany({
        where: { userId, type: 'PERSONAL' },
        orderBy: { createdAt: 'asc' },
      })
    }
    if (!wallets.length) return res.json([])

    const walletIds = wallets.map((w: any) => w.id)

    // All non-transfer transactions up to end of month
    const allTxs = await (prisma.transaction as any).findMany({
      where: {
        walletId: { in: walletIds },
        date: { lt: monthEnd },
        deletedAt: null,
        transferGroupId: null,
      },
      select: { walletId: true, pocketId: true, type: true, amount: true, date: true },
    })

    // Pockets of the first (primary) wallet only
    const pockets = walletType === 'PERSONAL'
      ? await (prisma as any).walletPocket.findMany({
          where: { walletId: wallets[0].id },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })
      : []

    // Pocket entries (DEPOSIT/WITHDRAWAL) — the actual source of pocket balance data
    const pocketIds: string[] = pockets.map((p: any) => p.id)
    const allPocketEntries = pocketIds.length > 0
      ? await (prisma as any).pocketEntry.findMany({
          where: { pocketId: { in: pocketIds }, date: { lt: monthEnd } },
          select: { pocketId: true, amount: true, type: true, date: true },
        })
      : []

    const result = wallets.map((wallet: any) => {
      const wTxs: any[] = allTxs.filter((t: any) => t.walletId === wallet.id)
      const before = wTxs.filter((t: any) => new Date(t.date) < monthStart)
      const inMonth = wTxs.filter((t: any) => new Date(t.date) >= monthStart)

      const sum = (arr: any[], type: string) =>
        arr.filter((t: any) => t.type === type).reduce((s: number, t: any) => s + t.amount, 0)

      const openingBalance = wallet.initialBalance + sum(before, 'INCOME') - sum(before, 'EXPENSE')
      const income = sum(inMonth, 'INCOME')
      const expense = sum(inMonth, 'EXPENSE')

      const pocketRows = pockets
        .filter((p: any) => p.walletId === wallet.id)
        .map((pocket: any) => {
          const pEntries: any[] = allPocketEntries.filter((e: any) => e.pocketId === pocket.id)
          const pBefore = pEntries.filter((e: any) => new Date(e.date) < monthStart)
          const pIn = pEntries.filter((e: any) => new Date(e.date) >= monthStart)
          const sumE = (arr: any[], type: string) =>
            arr.filter((e: any) => e.type === type).reduce((s: number, e: any) => s + e.amount, 0)
          const pOpening = (pocket.initialBalance ?? 0) + sumE(pBefore, 'DEPOSIT') - sumE(pBefore, 'WITHDRAWAL')
          const pIncome = sumE(pIn, 'DEPOSIT')
          const pExpense = sumE(pIn, 'WITHDRAWAL')
          return {
            id: pocket.id,
            name: pocket.name,
            icon: pocket.icon,
            color: pocket.color,
            initialBalance: pocket.initialBalance ?? 0,
            openingBalance: pOpening,
            income: pIncome,
            expense: pExpense,
            closingBalance: pOpening + pIncome - pExpense,
          }
        })

      return {
        id: wallet.id,
        name: wallet.name,
        currency: wallet.currency,
        initialBalance: wallet.initialBalance,
        openingBalance,
        income,
        expense,
        closingBalance: openingBalance + income - expense,
        pockets: pocketRows,
      }
    })

    res.json(result)
  } catch (e: any) {
    console.error('[getBalanceHistory]', e?.message ?? e)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
