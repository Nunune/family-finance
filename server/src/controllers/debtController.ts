import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

// Find or create a default debt-related category (no userId = system-wide)
async function debtCategory(tx: any, name: string, type: string, icon: string, color: string) {
  let cat = await tx.category.findFirst({ where: { name, userId: null } })
  if (!cat) {
    cat = await (tx as any).category.create({
      data: { name, type, icon, color, isDefault: true, userId: null },
    })
  }
  return cat
}

// Create a wallet transaction linked to a debt operation
async function createDebtTx(tx: any, opts: {
  walletId: string
  amount: number
  txType: 'INCOME' | 'EXPENSE'
  date: Date
  note: string
  userId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
}) {
  const cat = await debtCategory(tx, opts.categoryName, opts.txType, opts.categoryIcon, opts.categoryColor)
  return tx.transaction.create({
    data: {
      amount: opts.amount,
      type: opts.txType,
      date: opts.date,
      note: opts.note,
      walletId: opts.walletId,
      categoryId: cat.id,
      userId: opts.userId,
    },
  })
}

// Soft-delete a wallet transaction by id (no-op if id is null/undefined)
async function softDeleteTx(tx: any, transactionId: string | null | undefined) {
  if (!transactionId) return
  await tx.transaction.updateMany({
    where: { id: transactionId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
}

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
    const {
      title, type, scope, originalAmount, counterparty, note, dueDate,
      lenderUserId, borrowerUserId,
      linkToWallet = true,   // default: cập nhật số dư ví
    } = req.body

    if (!title?.trim() || !type || !scope || !originalAmount || !counterparty?.trim()) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    const parsedAmount = parseFloat(originalAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000_000) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (!['BORROWED', 'LENT'].includes(type)) return res.status(400).json({ error: 'Loại nợ không hợp lệ' })
    if (!['PERSONAL', 'SHARED', 'INTERNAL'].includes(scope)) return res.status(400).json({ error: 'Phạm vi không hợp lệ' })

    let walletId: string | undefined
    let familyId: string | undefined

    if (scope === 'PERSONAL') {
      const wallet = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
      walletId = wallet?.id
    } else if (scope === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      walletId = wallet?.id
      familyId = req.familyId
    } else if (scope === 'INTERNAL') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      if (!lenderUserId || !borrowerUserId) return res.status(400).json({ error: 'Cần chỉ định người cho vay và người vay' })
      familyId = req.familyId
    }

    const debt = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).debt.create({
        data: {
          title: title.trim(), type, scope,
          originalAmount: parsedAmount, remainingAmount: parsedAmount,
          counterparty: counterparty.trim(),
          note: note?.trim() || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          ownerId: userId,
          lenderUserId: scope === 'INTERNAL' ? lenderUserId : null,
          borrowerUserId: scope === 'INTERNAL' ? borrowerUserId : null,
          walletId, familyId,
        },
        include: {
          owner: { select: { id: true, name: true } },
          viewers: { include: { user: { select: { id: true, name: true } } } },
          payments: { include: { paidBy: { select: { id: true, name: true } } } },
        },
      })

      // Cập nhật ví nếu user chọn (INTERNAL không hỗ trợ — phức tạp 2 ví)
      if (linkToWallet && walletId && scope !== 'INTERNAL') {
        const isBorrowed = type === 'BORROWED'
        const walletTx = await createDebtTx(tx, {
          walletId,
          amount: parsedAmount,
          txType: isBorrowed ? 'INCOME' : 'EXPENSE',
          date: new Date(),
          note: isBorrowed ? `Vay tiền: ${counterparty.trim()}` : `Cho vay: ${counterparty.trim()}`,
          userId,
          categoryName: isBorrowed ? 'Vay tiền' : 'Cho vay',
          categoryIcon: isBorrowed ? '💸' : '🤝',
          categoryColor: isBorrowed ? '#3B82F6' : '#F59E0B',
        })
        // Lưu link để có thể undo khi xóa debt
        await (tx as any).debt.update({
          where: { id: created.id },
          data: { walletTransactionId: walletTx.id },
        })
        created.walletTransactionId = walletTx.id
      }

      return created
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
      const existing = await (tx as any).debt.findUnique({
        where: { id },
        include: { payments: true },
      })
      if (!existing) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy khoản nợ' })
      if (existing.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      // Xóa transaction ví liên kết của từng payment và của debt
      for (const p of existing.payments ?? []) {
        await softDeleteTx(tx, (p as any).walletTransactionId)
      }
      await softDeleteTx(tx, existing.walletTransactionId)
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
    if (date) {
      const payDate = new Date(date)
      payDate.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (payDate > today) {
        return res.status(400).json({ error: 'Ngày trả nợ không được ở tương lai' })
      }
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

      const payDate = date ? new Date(date) : new Date()

      const p = await (tx as any).debtPayment.create({
        data: {
          debtId: id,
          amount: parsedAmount,
          date: payDate,
          note: note?.trim() || null,
          paidByUserId: userId,
        },
        include: { paidBy: { select: { id: true, name: true } } },
      })
      await tx.debt.update({ where: { id }, data: { remainingAmount: { decrement: parsedAmount } } })

      // Cập nhật ví: BORROWED trả = chi ra, LENT thu về = thu vào
      if (debt.walletId && debt.scope !== 'INTERNAL') {
        const isBorrowed = debt.type === 'BORROWED'
        const walletTx = await createDebtTx(tx, {
          walletId: debt.walletId,
          amount: parsedAmount,
          txType: isBorrowed ? 'EXPENSE' : 'INCOME',
          date: payDate,
          note: isBorrowed ? `Trả nợ: ${debt.counterparty}` : `Thu hồi: ${debt.counterparty}`,
          userId,
          categoryName: isBorrowed ? 'Trả nợ' : 'Thu hồi nợ',
          categoryIcon: isBorrowed ? '💳' : '💰',
          categoryColor: isBorrowed ? '#EF4444' : '#10B981',
        })
        await (tx as any).debtPayment.update({
          where: { id: p.id },
          data: { walletTransactionId: walletTx.id },
        })
        p.walletTransactionId = walletTx.id
      }

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

    const canDelete =
      debt.ownerId === userId ||
      payment.paidByUserId === userId ||
      (debt.scope === 'SHARED' && debt.familyId === req.familyId) ||
      (debt.scope === 'INTERNAL' && (debt.lenderUserId === userId || debt.borrowerUserId === userId))
    if (!canDelete) return res.status(403).json({ error: 'Không có quyền' })

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.debtPayment.deleteMany({ where: { id: paymentId } })
      if (claimed.count === 0) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy thanh toán' })
      await tx.debt.update({ where: { id }, data: { remainingAmount: { increment: payment.amount } } })
      // Xóa transaction ví liên kết (soft-delete)
      await softDeleteTx(tx, (payment as any).walletTransactionId)
    })

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function bulkPayDebts(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { debtIds, totalAmount, date, note } = req.body

    if (!Array.isArray(debtIds) || debtIds.length === 0) {
      return res.status(400).json({ error: 'Chưa chọn khoản nợ' })
    }
    const parsedTotal = parseFloat(totalAmount)
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (d > today) return res.status(400).json({ error: 'Ngày trả không được ở tương lai' })
    }

    const payDate = date ? new Date(date) : new Date()

    const result = await prisma.$transaction(async (tx) => {
      const debts = await tx.debt.findMany({
        where: { id: { in: debtIds }, remainingAmount: { gt: 0 } },
      })

      const ordered = debtIds
        .map(id => debts.find(d => d.id === id))
        .filter(Boolean) as typeof debts

      let leftover = parsedTotal
      const updatedDebts = []

      for (const debt of ordered) {
        if (leftover <= 0) break

        const canPay =
          debt.ownerId === userId ||
          (debt.scope === 'SHARED' && debt.familyId === req.familyId) ||
          (debt.scope === 'INTERNAL' && (debt.lenderUserId === userId || debt.borrowerUserId === userId))
        if (!canPay) continue

        const payAmount = Math.min(debt.remainingAmount, leftover)
        leftover -= payAmount

        const payment = await (tx as any).debtPayment.create({
          data: {
            debtId: debt.id,
            amount: payAmount,
            date: payDate,
            note: note?.trim() || null,
            paidByUserId: userId,
          },
        })

        const updated = await tx.debt.update({
          where: { id: debt.id },
          data: { remainingAmount: { decrement: payAmount } },
          include: {
            owner: { select: { id: true, name: true } },
            viewers: { include: { user: { select: { id: true, name: true } } } },
            payments: {
              include: { paidBy: { select: { id: true, name: true } } },
              orderBy: { date: 'desc' },
            },
          },
        })

        if (debt.walletId && debt.scope !== 'INTERNAL') {
          const isBorrowed = debt.type === 'BORROWED'
          const walletTx = await createDebtTx(tx, {
            walletId: debt.walletId,
            amount: payAmount,
            txType: isBorrowed ? 'EXPENSE' : 'INCOME',
            date: payDate,
            note: isBorrowed ? `Trả nợ: ${debt.counterparty}` : `Thu hồi: ${debt.counterparty}`,
            userId,
            categoryName: isBorrowed ? 'Trả nợ' : 'Thu hồi nợ',
            categoryIcon: isBorrowed ? '💳' : '💰',
            categoryColor: isBorrowed ? '#EF4444' : '#10B981',
          })
          await (tx as any).debtPayment.update({
            where: { id: payment.id },
            data: { walletTransactionId: walletTx.id },
          })
        }

        updatedDebts.push(updated)
      }

      return { updatedDebts, totalPaid: parsedTotal - leftover }
    })

    res.json(result)
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
