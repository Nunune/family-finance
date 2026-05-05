import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

const WITHDRAWAL_REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, name: true } },
  approvals: { include: { user: { select: { id: true, name: true } } } },
} as const

export async function getGoals(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })

    const goals = await prisma.savingsGoal.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { isShared: true, familyId: user?.familyId ?? undefined },
        ],
      },
      include: {
        contributions: {
          orderBy: { date: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
        withdrawalRequests: {
          where: { status: 'PENDING' },
          include: WITHDRAWAL_REQUEST_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json(goals)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createGoal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { name, icon, targetAmount, targetDate, isShared } = req.body

    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ error: 'Thiếu thông tin quỹ' })
    }
    if (Number(targetAmount) <= 0) {
      return res.status(400).json({ error: 'Số tiền mục tiêu phải lớn hơn 0' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })

    const goal = await prisma.savingsGoal.create({
      data: {
        name,
        icon: icon || '🎯',
        targetAmount: Number(targetAmount),
        targetDate: new Date(targetDate),
        ownerId: userId,
        familyId: isShared ? (user?.familyId ?? null) : null,
        isShared: !!isShared && !!user?.familyId,
      },
      include: { contributions: true, withdrawalRequests: { where: { status: 'PENDING' } } },
    })

    res.status(201).json(goal)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateGoal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { name, icon, targetAmount, targetDate, isShared } = req.body

    const updated = await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findUnique({ where: { id } })
      if (!goal) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy quỹ' })
      if (goal.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      const user = await tx.user.findUnique({ where: { id: userId }, select: { familyId: true } })
      return tx.savingsGoal.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(icon && { icon }),
          ...(targetAmount && { targetAmount: Number(targetAmount) }),
          ...(targetDate && { targetDate: new Date(targetDate) }),
          ...(isShared !== undefined && {
            isShared: !!isShared && !!user?.familyId,
            familyId: isShared ? (user?.familyId ?? null) : null,
          }),
        },
        include: {
          contributions: { include: { user: { select: { id: true, name: true } } } },
          withdrawalRequests: { where: { status: 'PENDING' }, include: WITHDRAWAL_REQUEST_INCLUDE },
        },
      })
    })

    res.json(updated)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteGoal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findUnique({ where: { id } })
      if (!goal) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy quỹ' })
      if (goal.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      await tx.savingsGoal.delete({ where: { id } })
    })

    res.json({ ok: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function addContribution(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { amount, type = 'DEPOSIT', note, date } = req.body

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }

    const amt = Number(amount)
    const goal = await prisma.savingsGoal.findUnique({ where: { id } })
    if (!goal) return res.status(404).json({ error: 'Không tìm thấy quỹ' })

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })
    const canAccess = goal.ownerId === userId || (goal.isShared && goal.familyId === user?.familyId)
    if (!canAccess) return res.status(403).json({ error: 'Không có quyền' })

    // Rút quỹ chung → tạo withdrawal request thay vì rút trực tiếp
    if (type === 'WITHDRAWAL' && goal.isShared && goal.familyId) {
      const otherCount = await prisma.user.count({
        where: { familyId: goal.familyId, id: { not: userId } },
      })

      if (otherCount > 0) {
        if (goal.savedAmount < amt) {
          return res.status(400).json({ error: 'Số dư quỹ không đủ để rút' })
        }
        const existing = await prisma.savingsWithdrawalRequest.findFirst({
          where: { goalId: id, status: 'PENDING' },
        })
        if (existing) {
          return res.status(400).json({ error: 'Đã có yêu cầu rút đang chờ duyệt' })
        }

        const request = await prisma.savingsWithdrawalRequest.create({
          data: { goalId: id, requestedById: userId, amount: amt, note: note || null },
          include: WITHDRAWAL_REQUEST_INCLUDE,
        })
        return res.status(201).json({ withdrawalRequest: request })
      }
    }

    // DEPOSIT hoặc rút quỹ cá nhân/người duy nhất → xử lý trực tiếp
    const contrib = await prisma.$transaction(async (tx) => {
      const fresh = await tx.savingsGoal.findUnique({ where: { id } })
      if (!fresh) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy quỹ' })

      if (type === 'WITHDRAWAL' && fresh.savedAmount < amt) {
        throw Object.assign(new Error(), { status: 400, msg: 'Số dư quỹ không đủ để rút' })
      }

      const newSaved = fresh.savedAmount + (type === 'WITHDRAWAL' ? -amt : amt)

      const c = await tx.savingsContribution.create({
        data: { goalId: id, userId, amount: amt, type, note: note || null, date: new Date(date || Date.now()) },
        include: { user: { select: { id: true, name: true } } },
      })
      await tx.savingsGoal.update({
        where: { id },
        data: { savedAmount: newSaved, isCompleted: newSaved >= fresh.targetAmount },
      })
      return c
    })

    res.status(201).json(contrib)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteContribution(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id, cid } = req.params

    const contrib = await prisma.savingsContribution.findUnique({
      where: { id: cid },
      include: { goal: true },
    })
    if (!contrib || contrib.goalId !== id) return res.status(404).json({ error: 'Không tìm thấy' })

    const isGoalOwner = contrib.goal.ownerId === userId
    const isContribOwner = contrib.userId === userId
    if (!isGoalOwner && !isContribOwner) {
      return res.status(403).json({ error: 'Không có quyền' })
    }

    // Với quỹ chung: xác minh user vẫn còn thuộc gia đình đó
    if (contrib.goal.isShared && contrib.goal.familyId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })
      if (user?.familyId !== contrib.goal.familyId) {
        return res.status(403).json({ error: 'Không có quyền' })
      }
    }

    const delta = contrib.type === 'WITHDRAWAL' ? contrib.amount : -contrib.amount

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.savingsContribution.deleteMany({ where: { id: cid } })
      if (claimed.count === 0) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy' })
      const fresh = await tx.savingsGoal.findUnique({ where: { id } })
      if (fresh) {
        const newSaved = fresh.savedAmount + delta
        await tx.savingsGoal.update({
          where: { id },
          data: { savedAmount: newSaved, isCompleted: newSaved >= fresh.targetAmount },
        })
      }
    })

    res.json({ ok: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// ─── Withdrawal request ────────────────────────────────────────────────────

export async function respondWithdrawal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id, rid } = req.params
    const { approved } = req.body

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Thiếu trường approved (boolean)' })
    }

    const request = await prisma.savingsWithdrawalRequest.findUnique({
      where: { id: rid },
      include: { goal: true },
    })
    if (!request || request.goalId !== id) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' })
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Yêu cầu đã được xử lý' })
    if (request.requestedById === userId) return res.status(400).json({ error: 'Không thể tự duyệt yêu cầu của mình' })

    const voter = await prisma.user.findUnique({ where: { id: userId }, select: { familyId: true } })
    if (voter?.familyId !== request.goal.familyId) return res.status(403).json({ error: 'Không có quyền' })

    if (!approved) {
      await prisma.savingsWithdrawalRequest.update({
        where: { id: rid },
        data: { status: 'REJECTED', processedAt: new Date() },
      })
      return res.json({ status: 'REJECTED' })
    }

    await prisma.savingsWithdrawalApproval.upsert({
      where: { requestId_userId: { requestId: rid, userId } },
      update: { approved: true },
      create: { requestId: rid, userId, approved: true },
    })

    // Kiểm tra tất cả thành viên còn lại đã duyệt chưa
    const otherMembers = await prisma.user.findMany({
      where: { familyId: request.goal.familyId!, id: { not: request.requestedById } },
      select: { id: true },
    })
    const approvalCount = await prisma.savingsWithdrawalApproval.count({
      where: { requestId: rid, approved: true },
    })

    if (approvalCount >= otherMembers.length) {
      // Tất cả đã duyệt → thực hiện rút quỹ trong transaction
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.savingsGoal.findUnique({ where: { id } })
        if (!fresh || fresh.savedAmount < request.amount) {
          throw Object.assign(new Error(), { status: 400, msg: 'Số dư quỹ không đủ' })
        }
        const newSaved = fresh.savedAmount - request.amount
        await tx.savingsContribution.create({
          data: {
            goalId: id,
            userId: request.requestedById,
            amount: request.amount,
            type: 'WITHDRAWAL',
            note: request.note,
            date: new Date(),
          },
        })
        await tx.savingsGoal.update({
          where: { id },
          data: { savedAmount: newSaved, isCompleted: newSaved >= fresh.targetAmount },
        })
        await tx.savingsWithdrawalRequest.update({
          where: { id: rid },
          data: { status: 'APPROVED', processedAt: new Date() },
        })
      })
      return res.json({ status: 'APPROVED', processed: true })
    }

    res.json({ status: 'PENDING', approvalCount, required: otherMembers.length })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function cancelWithdrawal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id, rid } = req.params

    const request = await prisma.savingsWithdrawalRequest.findUnique({ where: { id: rid } })
    if (!request || request.goalId !== id) return res.status(404).json({ error: 'Không tìm thấy' })
    if (request.requestedById !== userId) return res.status(403).json({ error: 'Không có quyền' })

    const result = await prisma.savingsWithdrawalRequest.updateMany({
      where: { id: rid, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    if (result.count === 0) return res.status(400).json({ error: 'Không thể huỷ' })

    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
