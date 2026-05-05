import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

function nextOccurrence(current: Date, frequency: string, dayOfMonth?: number | null, dayOfWeek?: number | null): Date {
  const next = new Date(current)
  next.setHours(0, 0, 0, 0)

  if (frequency === 'MONTHLY' && dayOfMonth) {
    // Tính năm/tháng tiếp theo trước, rồi mới tính lastDay — tránh setMonth overflow
    // (vd: Jan 31 + setMonth(1) → JS overflow sang Mar 3, lastDay tính sai tháng)
    const year = next.getFullYear()
    const nextMonth = next.getMonth() + 1  // 12 = Jan năm sau, Date tự xử lý
    const lastDay = new Date(year, nextMonth + 1, 0).getDate()
    next.setFullYear(year, nextMonth, Math.min(dayOfMonth, lastDay))
  } else if (frequency === 'WEEKLY' && dayOfWeek !== null && dayOfWeek !== undefined) {
    const daysAhead = ((dayOfWeek - next.getDay()) + 7) % 7 || 7
    next.setDate(next.getDate() + daysAhead)
  }

  return next
}

// Mutex đơn giản — Node.js single-threaded nhưng async overlap vẫn xảy ra
let schedulerRunning = false

export async function runRecurringScheduler() {
  if (schedulerRunning) return
  schedulerRunning = true
  try {
    const now = new Date()
    // Ngưỡng stale: period quá 30 ngày trong quá khứ → bỏ qua, không tạo proposal
    const staleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const recurrings = await prisma.recurringTransaction.findMany({ where: { isActive: true } })

    for (const r of recurrings) {
      let current = new Date(r.nextDue)
      const MAX_ITERATIONS = 24 // tối đa 24 kỳ catch-up (2 năm MONTHLY / 24 tuần WEEKLY)

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const reminderDate = new Date(current)
        reminderDate.setDate(reminderDate.getDate() - r.remindDays)
        if (reminderDate > now) break // chưa đến hạn nhắc → dừng

        const next = nextOccurrence(current, r.frequency, r.dayOfMonth, r.dayOfWeek)

        if (current >= staleCutoff) {
          // Kỳ còn trong phạm vi → tạo proposal, đồng thời advance nextDue trong 1 transaction
          const code = Math.floor(1000 + Math.random() * 9000).toString()
          const expiresAt = new Date(current)
          expiresAt.setDate(expiresAt.getDate() + 14)

          try {
            await prisma.$transaction([
              prisma.transactionProposal.create({
                data: {
                  recurringId: r.id,
                  amount: r.amount,
                  type: r.type,
                  categoryId: r.categoryId,
                  walletType: r.walletType,
                  scheduledDate: current,
                  confirmationCode: code,
                  status: 'PENDING',
                  expiresAt,
                },
              }),
              prisma.recurringTransaction.update({
                where: { id: r.id },
                data: { nextDue: next },
              }),
            ])
          } catch (e: any) {
            if (e?.code === 'P2002') {
              // Unique constraint: proposal đã tồn tại (run trước tạo rồi) — chỉ advance nextDue
              await prisma.recurringTransaction.update({
                where: { id: r.id },
                data: { nextDue: next },
              })
            } else {
              throw e
            }
          }
        } else {
          // Kỳ quá cũ (> 30 ngày) → advance không tạo proposal, tránh spam
          await prisma.recurringTransaction.update({
            where: { id: r.id },
            data: { nextDue: next },
          })
        }

        current = next
      }
    }
  } catch (err) {
    console.error('[Recurring scheduler]', err)
  } finally {
    schedulerRunning = false
  }
}

export async function getRecurrings(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const familyId = req.familyId

    const orConditions: any[] = [{ ownerId: userId }]
    if (familyId) orConditions.push({ familyId })

    const recurrings = await prisma.recurringTransaction.findMany({
      where: { OR: orConditions },
      include: { category: true },
      orderBy: { nextDue: 'asc' },
    })

    res.json(recurrings)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createRecurring(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { title, amount, type, categoryId, walletType, frequency, dayOfMonth, dayOfWeek, remindDays, startDate } = req.body

    if (!title?.trim() || !amount || !type || !categoryId || !walletType || !frequency) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    }
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' })
    }
    if (!['MONTHLY', 'WEEKLY'].includes(frequency)) {
      return res.status(400).json({ error: 'Tần suất không hợp lệ' })
    }
    if (frequency === 'MONTHLY' && dayOfMonth !== undefined) {
      const d = parseInt(dayOfMonth)
      if (isNaN(d) || d < 1 || d > 31) return res.status(400).json({ error: 'Ngày trong tháng phải từ 1–31' })
    }
    if (frequency === 'WEEKLY' && dayOfWeek !== undefined) {
      const d = parseInt(dayOfWeek)
      if (isNaN(d) || d < 0 || d > 6) return res.status(400).json({ error: 'Ngày trong tuần phải từ 0–6' })
    }
    if (walletType === 'SHARED' && !req.familyId) {
      return res.status(400).json({ error: 'Chưa vào gia đình' })
    }

    const categoryExists = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!categoryExists) return res.status(400).json({ error: 'Danh mục không hợp lệ' })

    let nextDue: Date
    if (startDate) {
      nextDue = new Date(startDate)
      nextDue.setHours(0, 0, 0, 0)
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (frequency === 'MONTHLY' && dayOfMonth) {
        const day = parseInt(dayOfMonth)
        const y = today.getFullYear()
        const m = today.getMonth()
        const lastDayCur = new Date(y, m + 1, 0).getDate()
        nextDue = new Date(y, m, Math.min(day, lastDayCur))
        if (nextDue <= today) {
          const nm = m + 1
          const lastDayNext = new Date(y, nm + 1, 0).getDate()
          nextDue = new Date(y, nm, Math.min(day, lastDayNext))
        }
      } else if (frequency === 'WEEKLY' && dayOfWeek !== undefined) {
        const daysAhead = ((parseInt(dayOfWeek) - today.getDay()) + 7) % 7 || 7
        nextDue = new Date(today)
        nextDue.setDate(today.getDate() + daysAhead)
      } else {
        nextDue = new Date(today)
        nextDue.setDate(today.getDate() + 7)
      }
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        title: title.trim(),
        amount: parsedAmount,
        type,
        categoryId,
        walletType,
        frequency,
        dayOfMonth: dayOfMonth !== undefined ? parseInt(dayOfMonth) : null,
        dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
        remindDays: remindDays ? parseInt(remindDays) : 3,
        ownerId: userId,
        familyId: walletType === 'SHARED' ? req.familyId : null,
        nextDue,
      },
      include: { category: true },
    })

    // Tạo proposal ngay nếu đã trong cửa sổ nhắc (không chờ scheduler hàng giờ)
    runRecurringScheduler().catch(console.error)

    res.json(recurring)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateRecurring(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { title, amount, remindDays, isActive } = req.body

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.recurringTransaction.findUnique({ where: { id } })
      if (!existing) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy' })
      if (existing.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })

      const data: Record<string, unknown> = {}
      if (title?.trim()) data.title = title.trim()
      if (amount !== undefined) {
        const p = parseFloat(amount)
        if (!isNaN(p) && p > 0) data.amount = p
      }
      if (remindDays !== undefined) data.remindDays = parseInt(remindDays)
      if (isActive !== undefined) data.isActive = Boolean(isActive)

      return tx.recurringTransaction.update({ where: { id }, data, include: { category: true } })
    })

    res.json(updated)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteRecurring(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    await prisma.$transaction(async (tx) => {
      const existing = await tx.recurringTransaction.findUnique({ where: { id } })
      if (!existing) throw Object.assign(new Error(), { status: 404, msg: 'Không tìm thấy' })
      if (existing.ownerId !== userId) throw Object.assign(new Error(), { status: 403, msg: 'Không có quyền' })
      await tx.transactionProposal.deleteMany({ where: { recurringId: id, status: 'PENDING' } })
      await tx.recurringTransaction.delete({ where: { id } })
    })

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getProposals(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const familyId = req.familyId

    const orConditions: any[] = [{ recurring: { ownerId: userId } }]
    if (familyId) orConditions.push({ recurring: { familyId } })

    const proposals = await prisma.transactionProposal.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        OR: orConditions,
      },
      include: { recurring: { include: { category: true } } },
      orderBy: { scheduledDate: 'asc' },
    })

    res.json(proposals)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function confirmProposal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { code } = req.body

    const proposal = await prisma.transactionProposal.findUnique({
      where: { id },
      include: { recurring: true },
    })

    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy đề xuất' })

    // Authorization: chỉ owner hoặc thành viên cùng gia đình (cho SHARED) mới được confirm
    const { recurring } = proposal
    const isOwner = recurring.ownerId === userId
    const isSharedMember = recurring.walletType === 'SHARED' && recurring.familyId === req.familyId
    if (!isOwner && !isSharedMember) return res.status(403).json({ error: 'Không có quyền' })

    if (proposal.status !== 'PENDING') return res.status(400).json({ error: 'Đề xuất đã được xử lý' })
    if (proposal.expiresAt < new Date()) return res.status(400).json({ error: 'Đề xuất đã hết hạn' })
    if (proposal.confirmationCode !== code) return res.status(400).json({ error: 'Mã xác nhận không đúng' })
    let walletId: string | undefined

    if (recurring.walletType === 'SHARED') {
      if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
      const wallet = await prisma.wallet.findUnique({ where: { familyId: req.familyId } })
      walletId = wallet?.id
    } else {
      const wallet = await prisma.wallet.findUnique({ where: { userId } })
      walletId = wallet?.id
    }

    if (!walletId) return res.status(400).json({ error: 'Không tìm thấy ví' })

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    const transaction = await prisma.$transaction(async (tx) => {
      // Atomic claim: chỉ 1 request thắng, request còn lại nhận count = 0
      const claimed = await tx.transactionProposal.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      })
      if (claimed.count === 0) {
        throw Object.assign(new Error(), { status: 400, msg: 'Đề xuất đã được xử lý' })
      }

      return tx.transaction.create({
        data: {
          amount: proposal.amount,
          type: proposal.type,
          date: proposal.scheduledDate,
          note: `[Định kỳ] ${recurring.title}`,
          walletId,
          categoryId: proposal.categoryId,
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
        },
      })
    })

    const io = (req as any).io
    const room = recurring.familyId ? `family:${recurring.familyId}` : `user:${userId}`
    io?.to(room).emit('proposals:changed')

    res.json(transaction)
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function dismissProposal(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params

    const proposal = await prisma.transactionProposal.findUnique({
      where: { id },
      include: { recurring: true },
    })

    if (!proposal) return res.status(404).json({ error: 'Không tìm thấy đề xuất' })
    if (proposal.recurring.ownerId !== userId) return res.status(403).json({ error: 'Không có quyền' })

    const result = await prisma.transactionProposal.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'DISMISSED' },
    })
    if (result.count === 0) return res.status(400).json({ error: 'Đề xuất đã được xử lý' })

    const io = (req as any).io
    const room = proposal.recurring.familyId ? `family:${proposal.recurring.familyId}` : `user:${userId}`
    io?.to(room).emit('proposals:changed')

    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
