import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getDebts(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const familyId = req.familyId

    const orConditions: any[] = [
      { ownerId: userId },
      { viewers: { some: { userId } } },
    ]
    if (familyId) {
      orConditions.push({ scope: 'SHARED', familyId })
      orConditions.push({ scope: 'INTERNAL', lenderUserId: userId })
      orConditions.push({ scope: 'INTERNAL', borrowerUserId: userId })
    }

    const debts = await prisma.debt.findMany({
      where: { OR: orConditions },
      include: {
        owner: { select: { id: true, name: true } },
        viewers: { include: { user: { select: { id: true, name: true } } } },
        payments: {
          include: { paidBy: { select: { id: true, name: true } } },
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(debts)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createDebt(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { title, type, scope, originalAmount, counterparty, note, dueDate, lenderUserId, borrowerUserId } = req.body

    if (!title?.trim() || !type || !scope || !originalAmount || !counterparty?.trim()) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    const parsedAmount = parseFloat(originalAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000_000) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (!['BORROWED', 'LENT'].includes(type)) {
      return res.status(400).json({ error: 'Loại nợ không hợp lệ' })
    }
    if (!['PERSONAL', 'SHARED', 'INTERNAL'].includes(scope)) {
      return res.status(400).json({ error: 'Phạm vi không hợp lệ' })
    }

    let walletId: string | undefined
    let familyId: string | undefined

    if (scope === 'PERSONAL') {
      const wallet = await prisma.wallet.findUnique({ where: { userId } })
      walletId = wallet?.id
    } else if (scope === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      walletId = wallet?.id
      familyId = req.familyId
    } else if (scope === 'INTERNAL') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      if (!lenderUserId || !borrowerUserId) {
        return res.status(400).json({ error: 'Cần chỉ định người cho vay và người vay' })
      }
      familyId = req.familyId
    }

    const debt = await prisma.debt.create({
      data: {
        title: title.trim(),
        type,
        scope,
        originalAmount: parsedAmount,
        remainingAmount: parsedAmount,
        counterparty: counterparty.trim(),
        note: note?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        ownerId: userId,
        lenderUserId: scope === 'INTERNAL' ? lenderUserId : null,
        borrowerUserId: scope === 'INTERNAL' ? borrowerUserId : null,
        walletId,
        familyId,
      },
      include: {
        owner: { select: { id: true, name: true } },
        viewers: { include: { user: { select: { id: true, name: true } } } },
        payments: { include: { paidBy: { select: { id: true, name: true } } } },
      },
    })

    res.json(debt)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateDebt(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { title, counterparty, note, dueDate } = req.body

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.debt.findUnique({ where: { id } })
      if (!existing) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy khoản nợ' })
      if (existing.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      return tx.debt.update({
        where: { id },
        data: {
          title: title?.trim() || existing.title,
          counterparty: counterparty?.trim() || existing.counterparty,
          note: note?.trim() || null,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
        include: {
          owner: { select: { id: true, name: true } },
          viewers: { include: { user: { select: { id: true, name: true } } } },
          payments: { include: { paidBy: { select: { id: true, name: true } } }, orderBy: { date: 'desc' } },
        },
      })
    })

    res.json(updated)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteDebt(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const existing = await tx.debt.findUnique({ where: { id } })
      if (!existing) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy khoản nợ' })
      if (existing.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      await tx.debt.delete({ where: { id } })
    })

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function addPayment(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { amount, date, note } = req.body

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }

    const payment = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id } })
      if (!debt) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy khoản nợ' })

      const canPay =
        debt.ownerId === userId ||
        (debt.scope === 'SHARED' && debt.familyId === req.familyId) ||
        (debt.scope === 'INTERNAL' && (debt.lenderUserId === userId || debt.borrowerUserId === userId))
      if (!canPay) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      if (parsedAmount > debt.remainingAmount) {
        throw Object.assign(new Error(), { status: 400, msg: 'Số tiền thanh toán vượt quá số dư còn lại' })
      }

      const p = await tx.debtPayment.create({
        data: {
          debtId: id,
          amount: parsedAmount,
          date: date ? new Date(date) : new Date(),
          note: note?.trim() || null,
          paidByUserId: userId,
        },
        include: { paidBy: { select: { id: true, name: true } } },
      })
      await tx.debt.update({ where: { id }, data: { remainingAmount: { decrement: parsedAmount } } })
      return p
    })

    res.json(payment)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deletePayment(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id, paymentId } = req.params

    const debt = await prisma.debt.findUnique({ where: { id } })
    if (!debt) return res.status(404).json({ error: 'Không tìm thấy khoản nợ' })

    const payment = await prisma.debtPayment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.debtId !== id) return res.status(404).json({ error: 'Không tìm thấy thanh toán' })

    if (debt.ownerId !== userId && payment.paidByUserId !== userId) {
      return res.status(403).json({ error: 'Không có quyền' })
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.debtPayment.deleteMany({ where: { id: paymentId } })
      if (claimed.count === 0) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy thanh toán' })
      await tx.debt.update({ where: { id }, data: { remainingAmount: { increment: payment.amount } } })
    })

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function addViewer(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { viewerUserId } = req.body

    const debt = await prisma.debt.findUnique({ where: { id } })
    if (!debt) return res.status(404).json({ error: 'Không tìm thấy khoản nợ' })
    if (debt.ownerId !== userId) return res.status(403).json({ error: 'Không có quyền' })
    if (debt.scope !== 'PERSONAL') return res.status(400).json({ error: 'Chỉ khoản nợ cá nhân mới có phân quyền xem' })
    if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })

    const viewer = await prisma.user.findUnique({ where: { id: viewerUserId } })
    if (!viewer || viewer.familyId !== req.familyId) {
      return res.status(400).json({ error: 'Người dùng không thuộc gia đình' })
    }

    const result = await prisma.debtViewer.upsert({
      where: { debtId_userId: { debtId: id, userId: viewerUserId } },
      update: {},
      create: { debtId: id, userId: viewerUserId },
      include: { user: { select: { id: true, name: true } } },
    })

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function removeViewer(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id, viewerUserId } = req.params

    const debt = await prisma.debt.findUnique({ where: { id } })
    if (!debt) return res.status(404).json({ error: 'Không tìm thấy khoản nợ' })
    if (debt.ownerId !== userId) return res.status(403).json({ error: 'Không có quyền' })

    await prisma.debtViewer.deleteMany({ where: { debtId: id, userId: viewerUserId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
