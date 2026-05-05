import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

const db = prisma as any

function getPeriodKey(item: any, year: number, month: number): string {
  if (item.frequency === 'ONCE') {
    const d = new Date(item.dueDate)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (item.frequency === 'WEEKLY') {
    // ISO week number for the first occurrence in month
    const firstDay = new Date(year, month - 1, 1)
    const jan1 = new Date(year, 0, 1)
    const week = Math.ceil(((firstDay.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
    return `${year}-W${String(week).padStart(2, '0')}`
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function getDueDateInMonth(item: any, year: number, month: number): Date | null {
  if (item.frequency === 'ONCE') {
    return item.dueDate ? new Date(item.dueDate) : null
  }
  if (item.frequency === 'MONTHLY' && item.dueDay) {
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(item.dueDay, lastDay))
  }
  if (item.frequency === 'WEEKLY' && item.dueDay !== null) {
    // Next occurrence of dueDay in this month
    const d = new Date(year, month - 1, 1)
    const target = item.dueDay // 0=Sun
    const diff = (target - d.getDay() + 7) % 7
    const result = new Date(d)
    result.setDate(1 + diff)
    if (result.getMonth() !== month - 1) return null
    return result
  }
  return null
}

export async function getPlanItems(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { month } = req.query // "2025-05"
    const [year, mon] = (month as string || '').split('-').map(Number)
    if (!year || !mon) return res.status(400).json({ error: 'Thiếu tháng (vd: 2025-05)' })

    const monthStart = new Date(year, mon - 1, 1)
    const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999)

    const items = await db.planItem.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { frequency: { in: ['MONTHLY', 'WEEKLY'] } },
          { frequency: 'ONCE', dueDate: { gte: monthStart, lte: monthEnd } },
        ],
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        completions: { where: { periodKey: { startsWith: month as string } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const today = new Date()
    const result = items.map((item: any) => {
      const dueDate = getDueDateInMonth(item, year, mon)
      const periodKey = getPeriodKey(item, year, mon)
      const completion = item.completions[0] ?? null
      const isDone = completion?.isDone ?? false

      let isDueSoon = false
      if (!isDone && dueDate) {
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)
        isDueSoon = diffDays >= 0 && diffDays <= item.remindDays
      }

      return {
        ...item,
        completions: undefined,
        dueDate: dueDate?.toISOString() ?? null,
        periodKey,
        isDone,
        doneAt: completion?.doneAt ?? null,
        isDueSoon,
      }
    })

    res.json(result)
  } catch (err) {
    console.error('[getPlanItems]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createPlanItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { title, amount, type, categoryId, note, frequency, dueDay, dueDate, remindDays } = req.body

    if (!title?.trim()) return res.status(400).json({ error: 'Nhập tên khoản' })
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    if (!['INCOME', 'EXPENSE'].includes(type)) return res.status(400).json({ error: 'Loại không hợp lệ' })
    if (!['ONCE', 'MONTHLY', 'WEEKLY'].includes(frequency)) return res.status(400).json({ error: 'Tần suất không hợp lệ' })

    const item = await db.planItem.create({
      data: {
        title: title.trim(),
        amount: parsed,
        type,
        categoryId: categoryId || null,
        note: note?.trim() || null,
        frequency,
        dueDay: dueDay != null ? parseInt(dueDay) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        remindDays: parseInt(remindDays ?? '3'),
        userId,
      },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    })
    res.json(item)
  } catch (err) {
    console.error('[createPlanItem]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updatePlanItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const existing = await db.planItem.findFirst({ where: { id, userId } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })

    const { title, amount, type, categoryId, note, frequency, dueDay, dueDate, remindDays, isActive } = req.body
    const parsed = amount != null ? parseFloat(amount) : existing.amount
    if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })

    const item = await db.planItem.update({
      where: { id },
      data: {
        title: title?.trim() ?? existing.title,
        amount: parsed,
        type: type ?? existing.type,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        note: note !== undefined ? (note?.trim() || null) : existing.note,
        frequency: frequency ?? existing.frequency,
        dueDay: dueDay !== undefined ? (dueDay != null ? parseInt(dueDay) : null) : existing.dueDay,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        remindDays: remindDays != null ? parseInt(remindDays) : existing.remindDays,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        updatedAt: new Date(),
      },
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    })
    res.json(item)
  } catch (err) {
    console.error('[updatePlanItem]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deletePlanItem(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const existing = await db.planItem.findFirst({ where: { id, userId } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })
    await db.planItem.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function toggleCompletion(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params // planItem id
    const { periodKey, isDone } = req.body

    const item = await db.planItem.findFirst({ where: { id, userId } })
    if (!item) return res.status(404).json({ error: 'Không tìm thấy' })

    const completion = await db.planCompletion.upsert({
      where: { planItemId_periodKey: { planItemId: id, periodKey } },
      update: { isDone, doneAt: isDone ? new Date() : null },
      create: { planItemId: id, periodKey, isDone, doneAt: isDone ? new Date() : null },
    })
    res.json(completion)
  } catch (err) {
    console.error('[toggleCompletion]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getUpcomingReminders(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1

    const items = await db.planItem.findMany({
      where: { userId, isActive: true },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        completions: { where: { periodKey: { startsWith: `${year}-${String(month).padStart(2, '0')}` } } },
      },
    })

    const reminders: any[] = []
    for (const item of items) {
      const dueDate = getDueDateInMonth(item, year, month)
      if (!dueDate) continue
      const isDone = item.completions[0]?.isDone ?? false
      if (isDone) continue
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)
      if (diffDays >= 0 && diffDays <= item.remindDays) {
        reminders.push({ ...item, completions: undefined, dueDate: dueDate.toISOString(), diffDays })
      }
    }

    reminders.sort((a, b) => a.diffDays - b.diffDays)
    res.json(reminders)
  } catch (err) {
    console.error('[getUpcomingReminders]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
