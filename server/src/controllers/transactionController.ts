import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { Server } from 'socket.io'
import prisma from '../lib/prisma'

function getIO(req: AuthRequest): Server | null {
  return (req as any).io || null
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const { walletType, startDate, endDate, categoryId } = req.query
    const userId = req.userId!

    let walletId: string | undefined
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      walletId = wallet?.id
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { userId } })
      walletId = wallet?.id
    }

    if (!walletId) return res.json([])

    const where: any = { walletId, deletedAt: null }
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate as string)
      if (endDate) {
        const end = new Date(endDate as string)
        end.setUTCHours(23, 59, 59, 999)
        where.date.lte = end
      }
    }
    if (categoryId) where.categoryId = categoryId as string

    const includeObj: Record<string, unknown> = {
      category: true,
      user: { select: { id: true, name: true } },
    }
    if (walletType === 'SHARED') {
      includeObj.logs = { orderBy: { createdAt: 'desc' }, take: 3 }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: includeObj as any,
      orderBy: { date: 'desc' },
    })

    res.json(transactions)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const { amount, type, date, note, categoryId, walletType } = req.body
    const userId = req.userId!

    if (!amount || !type || !date || !categoryId || !walletType) {
      return res.status(400).json({ error: 'Thiếu thông tin giao dịch' })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000_000) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' })
    }
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Ngày không hợp lệ' })
    }
    const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!categoryExists) {
      return res.status(400).json({ error: 'Danh mục không hợp lệ' })
    }

    let walletId: string
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      if (!wallet) return res.status(404).json({ error: 'Không tìm thấy quỹ chung' })
      walletId = wallet.id
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { userId } })
      if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví cá nhân' })
      walletId = wallet.id
    }

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    const transaction = await prisma.transaction.create({
      data: {
        amount: parsedAmount,
        type,
        date: parsedDate,
        note: note?.trim() || null,
        walletId,
        categoryId,
        userId,
        logs: {
          create: {
            action: 'created',
            byUserId: userId,
            byUserName: actor?.name ?? '',
            snapshot: '{}',
          },
        },
      },
      include: {
        category: true,
        user: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (walletType === 'SHARED' && req.familyId) {
      const io = getIO(req)
      io?.to(`family:${req.familyId}`).emit('transaction:new', transaction)
    }

    res.json(transaction)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateTransaction(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const { amount, type, date, note, categoryId } = req.body
    const userId = req.userId!

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000_000) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' })
    }
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Ngày không hợp lệ' })
    }

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    let isPersonal = true
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id }, include: { wallet: true } })
      if (!existing || existing.deletedAt) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy giao dịch' })

      isPersonal = existing.wallet.type === 'PERSONAL'
      if (isPersonal && existing.userId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      if (!isPersonal && existing.wallet.familyId !== req.familyId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      return tx.transaction.update({
        where: { id },
        data: {
          amount: parsedAmount, type, date: parsedDate, note: note?.trim() || null, categoryId,
          logs: {
            create: {
              action: 'updated',
              byUserId: userId,
              byUserName: actor?.name ?? '',
              snapshot: JSON.stringify({
                amount: existing.amount,
                type: existing.type,
                date: existing.date,
                note: existing.note,
                categoryId: existing.categoryId,
              }),
            },
          },
        },
        include: {
          category: true,
          user: { select: { id: true, name: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      })
    })

    if (!isPersonal && req.familyId) {
      getIO(req)?.to(`family:${req.familyId}`).emit('transaction:updated', updated)
    }

    res.json(updated)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteTransaction(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const userId = req.userId!

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    let isPersonal = true
    await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id }, include: { wallet: true } })
      if (!existing || existing.deletedAt) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy giao dịch' })

      isPersonal = existing.wallet.type === 'PERSONAL'
      if (isPersonal && existing.userId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      if (!isPersonal && existing.wallet.familyId !== req.familyId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      await tx.transaction.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          logs: {
            create: {
              action: 'deleted',
              byUserId: userId,
              byUserName: actor?.name ?? '',
              snapshot: JSON.stringify({ amount: existing.amount, type: existing.type, date: existing.date }),
            },
          },
        },
      })
    })

    if (!isPersonal && req.familyId) {
      getIO(req)?.to(`family:${req.familyId}`).emit('transaction:deleted', { id })
    }

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

const VN_OFFSET = 7 * 60 * 60 * 1000 // UTC+7

export async function getSummary(req: AuthRequest, res: Response) {
  try {
    const { walletType, month, year } = req.query
    const userId = req.userId!

    const m = parseInt(month as string) || new Date().getUTCMonth() + 1
    const y = parseInt(year as string) || new Date().getUTCFullYear()

    // Date range in Vietnam timezone: month start/end in VN = UTC-7h
    const startDate = new Date(Date.UTC(y, m - 1, 1) - VN_OFFSET)
    const endDate = new Date(Date.UTC(y, m, 1) - VN_OFFSET - 1)

    let wallet: { id: string; initialBalance: number } | null = null
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId }, select: { id: true, initialBalance: true } })
    } else {
      wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true, initialBalance: true } })
    }

    if (!wallet) return res.json({ totalIncome: 0, totalExpense: 0, balance: 0, walletBalance: 0, initialBalance: 0, byDay: [], byCategory: [] })

    const [monthlyTx, allTimeTx] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id, deletedAt: null, date: { gte: startDate, lte: endDate } },
        include: { category: true },
      }),
      prisma.transaction.findMany({
        where: { walletId: wallet.id, deletedAt: null },
        select: { amount: true, type: true },
      }),
    ])

    const totalIncome = monthlyTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const totalExpense = monthlyTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)

    const allTimeIncome = allTimeTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const allTimeExpense = allTimeTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
    const initialBalance = wallet.initialBalance
    const walletBalance = initialBalance + allTimeIncome - allTimeExpense

    // Group by Vietnam date (UTC+7)
    const byDay: Record<string, { income: number; expense: number }> = {}
    monthlyTx.forEach(t => {
      const day = new Date(t.date.getTime() + VN_OFFSET).toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = { income: 0, expense: 0 }
      if (t.type === 'INCOME') byDay[day].income += t.amount
      else byDay[day].expense += t.amount
    })

    const byCategory: Record<string, { name: string; color: string; icon: string; total: number }> = {}
    monthlyTx.filter(t => t.type === 'EXPENSE').forEach(t => {
      const k = t.categoryId
      if (!byCategory[k]) byCategory[k] = { name: t.category.name, color: t.category.color, icon: t.category.icon, total: 0 }
      byCategory[k].total += t.amount
    })

    res.json({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      walletBalance,
      initialBalance,
      byDay: Object.entries(byDay).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function setInitialBalance(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { walletType, initialBalance } = req.body

    const parsed = parseFloat(initialBalance)
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'Số dư không hợp lệ (phải ≥ 0)' })
    }

    let wallet: { id: string } | null = null
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin mới được đặt số dư quỹ chung' })
      wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId }, select: { id: true } })
    } else {
      wallet = await prisma.wallet.findUnique({ where: { userId }, select: { id: true } })
    }

    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví' })

    await prisma.wallet.update({ where: { id: wallet.id }, data: { initialBalance: parsed } })
    res.json({ initialBalance: parsed })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getCategories(_req: AuthRequest, res: Response) {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    res.json(categories)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
