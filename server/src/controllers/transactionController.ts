import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { Server } from 'socket.io'
import prisma from '../lib/prisma'

function getIO(req: AuthRequest): Server | null {
  return (req as any).io || null
}

export async function getTransactions(req: AuthRequest, res: Response) {
  try {
    const { walletType, startDate, endDate, categoryId, page, limit } = req.query
    const userId = req.userId!
    const pageNum = Math.max(0, parseInt(page as string) || 0)
    const pageSize = Math.min(200, Math.max(1, parseInt(limit as string) || 50))

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

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: includeObj as any,
        orderBy: { date: 'desc' },
        skip: pageNum * pageSize,
        take: pageSize + 1,
      }),
      prisma.transaction.count({ where }),
    ])

    const hasMore = transactions.length > pageSize
    if (hasMore) transactions.pop()

    res.json({ transactions, hasMore, total })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

function pocketDelta(amount: number, type: string) {
  return type === 'INCOME' ? amount : -amount
}

export async function createTransaction(req: AuthRequest, res: Response) {
  try {
    const { amount, type, date, note, categoryId, walletType, pocketId } = req.body
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

    // Validate pocketId belongs to this wallet (personal only)
    let resolvedPocketId: string | null = null
    if (pocketId && walletType !== 'SHARED') {
      const pocket = await (prisma as any).walletPocket.findFirst({ where: { id: pocketId, walletId } })
      if (pocket) resolvedPocketId = pocketId
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: parsedAmount,
        type,
        date: parsedDate,
        note: note?.trim() || null,
        walletId,
        categoryId,
        userId,
        pocketId: resolvedPocketId,
        logs: {
          create: {
            action: 'created',
            byUserId: userId,
            byUserName: actor?.name ?? '',
            snapshot: '{}',
          },
        },
      } as any,
      include: {
        category: true,
        user: { select: { id: true, name: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (resolvedPocketId) {
      await (prisma as any).walletPocket.update({
        where: { id: resolvedPocketId },
        data: { balance: { increment: pocketDelta(parsedAmount, type) } },
      })
    }

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
    const { amount, type, date, note, categoryId, pocketId } = req.body
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
      const existing = await (tx as any).transaction.findUnique({ where: { id }, include: { wallet: true } })
      if (!existing || existing.deletedAt) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy giao dịch' })

      isPersonal = existing.wallet.type === 'PERSONAL'
      if (isPersonal && existing.userId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      if (!isPersonal && existing.wallet.familyId !== req.familyId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      // Adjust pocket balances: reverse old, apply new
      const oldPocketId: string | null = existing.pocketId ?? null
      const newPocketId: string | null = isPersonal && pocketId ? pocketId : null

      if (oldPocketId) {
        await (tx as any).walletPocket.update({
          where: { id: oldPocketId },
          data: { balance: { increment: -pocketDelta(existing.amount, existing.type) } },
        })
      }
      if (newPocketId) {
        await (tx as any).walletPocket.update({
          where: { id: newPocketId },
          data: { balance: { increment: pocketDelta(parsedAmount, type) } },
        })
      }

      return (tx as any).transaction.update({
        where: { id },
        data: {
          amount: parsedAmount, type, date: parsedDate, note: note?.trim() || null, categoryId,
          pocketId: newPocketId,
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
      const existing = await (tx as any).transaction.findUnique({ where: { id }, include: { wallet: true } })
      if (!existing || existing.deletedAt) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy giao dịch' })

      isPersonal = existing.wallet.type === 'PERSONAL'
      if (isPersonal && existing.userId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      if (!isPersonal && existing.wallet.familyId !== req.familyId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      // Reverse pocket balance before soft-delete
      if (existing.pocketId) {
        await (tx as any).walletPocket.update({
          where: { id: existing.pocketId },
          data: { balance: { increment: -pocketDelta(existing.amount, existing.type) } },
        })
      }

      await (tx as any).transaction.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          pocketId: null,
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

export async function exportTransactions(req: AuthRequest, res: Response) {
  try {
    const { walletType, startDate, endDate } = req.query
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

    if (!walletId) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      return res.send('﻿Ngày,Loại,Danh mục,Số tiền,Ghi chú\n')
    }

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

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    })

    const escape = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`

    const rows = transactions.map(t => {
      const d = new Date(t.date.getTime() + VN_OFFSET)
      const day = String(d.getUTCDate()).padStart(2, '0')
      const mon = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yr = d.getUTCFullYear()
      const dateStr = `${day}/${mon}/${yr}`
      const typeStr = t.type === 'INCOME' ? 'Thu' : 'Chi'
      return [dateStr, typeStr, escape(t.category.name), t.amount, escape(t.note ?? '')].join(',')
    })

    const month = startDate ? new Date(startDate as string).getMonth() + 1 : new Date().getMonth() + 1
    const year = startDate ? new Date(startDate as string).getFullYear() : new Date().getFullYear()
    const filename = `giao-dich-${walletType === 'SHARED' ? 'quy-chung' : 'ca-nhan'}-${month}-${year}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('﻿' + 'Ngày,Loại,Danh mục,Số tiền,Ghi chú\n' + rows.join('\n'))
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getCategories(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const categories = await (prisma.category as any).findMany({
      where: { OR: [{ isDefault: true }, { userId }] },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
    res.json(categories)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { name, icon, color, type } = req.body

    if (!name?.trim()) return res.status(400).json({ error: 'Cần nhập tên danh mục' })
    if (!icon?.trim()) return res.status(400).json({ error: 'Cần chọn icon' })
    if (!color?.trim()) return res.status(400).json({ error: 'Cần chọn màu' })
    if (!['INCOME', 'EXPENSE'].includes(type)) return res.status(400).json({ error: 'Loại không hợp lệ' })

    const exists = await (prisma.category as any).findFirst({ where: { name: name.trim(), userId } })
    if (exists) return res.status(400).json({ error: 'Danh mục này đã tồn tại' })

    const category = await (prisma.category as any).create({
      data: { name: name.trim(), icon: icon.trim(), color: color.trim(), type, userId },
    })
    res.status(201).json(category)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { name, icon, color } = req.body

    const existing = await (prisma.category as any).findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (existing.isDefault) return res.status(403).json({ error: 'Không thể sửa danh mục mặc định' })
    if (existing.userId !== userId) return res.status(403).json({ error: 'Không có quyền' })

    if (name?.trim() && name.trim() !== existing.name) {
      const dup = await (prisma.category as any).findFirst({ where: { name: name.trim(), userId } })
      if (dup) return res.status(400).json({ error: 'Tên danh mục đã tồn tại' })
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(icon?.trim() && { icon: icon.trim() }),
        ...(color?.trim() && { color: color.trim() }),
      },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    const existing = await (prisma.category as any).findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (existing.isDefault) return res.status(403).json({ error: 'Không thể xóa danh mục mặc định' })
    if (existing.userId !== userId) return res.status(403).json({ error: 'Không có quyền' })

    const txCount = await prisma.transaction.count({ where: { categoryId: id, deletedAt: null } })
    if (txCount > 0) return res.status(400).json({ error: `Không thể xóa — đang dùng bởi ${txCount} giao dịch` })

    await prisma.category.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getWeeklySummary(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const walletType = (req.query.walletType as string) || 'PERSONAL'

    let walletId: string | undefined
    if (walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      walletId = wallet?.id
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { userId } })
      walletId = wallet?.id
    }
    if (!walletId) return res.json({ weeks: [], thisWeek: 0, avgExpense: 0, ratio: 1, alert: null, topCategories: [] })

    // Tuần bắt đầu từ thứ Hai
    const now = new Date()
    const todayDay = now.getDay() // 0=CN, 1=T2...6=T7
    const daysFromMonday = todayDay === 0 ? 6 : todayDay - 1

    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - daysFromMonday)
    thisWeekStart.setHours(0, 0, 0, 0)

    // Lấy data 4 tuần = 28 ngày từ đầu tuần hiện tại trở về trước
    const queryStart = new Date(thisWeekStart)
    queryStart.setDate(queryStart.getDate() - 21)

    const transactions = await prisma.transaction.findMany({
      where: { walletId, date: { gte: queryStart, lte: now }, deletedAt: null, type: 'EXPENSE' },
      include: { category: { select: { name: true, icon: true } } },
    })

    // Xây dựng 4 tuần theo thứ tự thời gian (cũ → mới)
    const weeks: Array<{
      weeksAgo: number; label: string; startDate: string; endDate: string; expense: number
    }> = []

    for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
      const weekStart = new Date(thisWeekStart)
      weekStart.setDate(thisWeekStart.getDate() - weeksAgo * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const weekExpense = transactions
        .filter(tx => new Date(tx.date) >= weekStart && new Date(tx.date) <= weekEnd)
        .reduce((s, tx) => s + tx.amount, 0)

      weeks.push({
        weeksAgo,
        label: weeksAgo === 0 ? 'Tuần này' : weeksAgo === 1 ? 'Tuần trước' : `${weeksAgo}T trước`,
        startDate: weekStart.toISOString().slice(0, 10),
        endDate: weekEnd.toISOString().slice(0, 10),
        expense: weekExpense,
      })
    }

    // weeks[3] = tuần này, weeks[0..2] = 3 tuần trước
    const thisWeekExpense = weeks[3].expense
    const pastWeeksAvg = (weeks[0].expense + weeks[1].expense + weeks[2].expense) / 3

    const ratio = pastWeeksAvg > 0
      ? thisWeekExpense / pastWeeksAvg
      : thisWeekExpense > 0 ? 9 : 1 // nếu chưa có lịch sử → tỉ lệ cao

    let alert: 'HIGH' | 'MODERATE' | 'NORMAL' | 'GOOD' | null = null
    if (thisWeekExpense > 0 || pastWeeksAvg > 0) {
      if (ratio >= 1.5) alert = 'HIGH'
      else if (ratio >= 1.2) alert = 'MODERATE'
      else if (pastWeeksAvg > 0 && ratio <= 0.7) alert = 'GOOD'
      else alert = 'NORMAL'
    }

    // Top 3 danh mục tuần này
    const catMap = new Map<string, { name: string; icon: string; amount: number }>()
    transactions
      .filter(tx => new Date(tx.date) >= thisWeekStart)
      .forEach(tx => {
        const cat = (tx as any).category
        const key = tx.categoryId
        const entry = catMap.get(key)
        if (entry) entry.amount += tx.amount
        else catMap.set(key, { name: cat?.name ?? '', icon: cat?.icon ?? '💰', amount: tx.amount })
      })

    const topCategories = Array.from(catMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)

    // Ước tính chi tiêu cả tuần dựa trên tốc độ hiện tại
    const daysElapsed = daysFromMonday + 1 // số ngày đã trôi qua trong tuần (bao gồm hôm nay)
    const projectedWeek = daysElapsed > 0 ? Math.round((thisWeekExpense / daysElapsed) * 7) : 0

    res.json({
      weeks,
      thisWeek: thisWeekExpense,
      avgExpense: Math.round(pastWeeksAvg),
      ratio: Math.round(ratio * 100) / 100,
      alert,
      topCategories,
      projectedWeek,
      daysElapsed,
    })
  } catch (err) {
    console.error('[getWeeklySummary]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
