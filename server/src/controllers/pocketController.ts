import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

const wp = (tx?: any) => ((tx ?? prisma) as any).walletPocket
const pe = (tx?: any) => ((tx ?? prisma) as any).pocketEntry

// Startup check
console.log('[Pocket] walletPocket:', typeof (prisma as any).walletPocket)
console.log('[Pocket] pocketEntry:', typeof (prisma as any).pocketEntry)

export async function getPockets(req: AuthRequest, res: Response) {
  try {
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.userId!, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (!wallet) return res.json([])
    const pockets = await wp().findMany({
      where: { walletId: wallet.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(pockets)
  } catch (e: any) {
    console.error('[getPockets]', e?.message ?? e)
    res.status(500).json({ error: e?.message ?? 'Lỗi server' })
  }
}

export async function createPocket(req: AuthRequest, res: Response) {
  try {
    const { name, icon, color, balance, isHidden } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Cần nhập tên ví' })
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.userId!, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy ví' })
    const count = await wp().count({ where: { walletId: wallet.id } })
    const pocket = await wp().create({
      data: {
        walletId: wallet.id,
        name: name.trim(),
        icon: icon?.trim() || '💰',
        color: color || '#6B7280',
        balance: parseFloat(balance) || 0,
        isHidden: isHidden ?? false,
        order: count,
      },
    })
    res.status(201).json(pocket)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updatePocket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.userId!, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    const pocket = await wp().findUnique({ where: { id } })
    if (!pocket || !wallet || pocket.walletId !== wallet.id)
      return res.status(404).json({ error: 'Không tìm thấy ví' })
    const { name, icon, color, balance, isHidden } = req.body
    const updated = await wp().update({
      where: { id },
      data: {
        ...(name?.trim() !== undefined && { name: name.trim() }),
        ...(icon?.trim() !== undefined && { icon: icon.trim() }),
        ...(color !== undefined && { color }),
        ...(balance !== undefined && { balance: parseFloat(balance) || 0 }),
        ...(isHidden !== undefined && { isHidden }),
      },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deletePocket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const wallet = await prisma.wallet.findFirst({ where: { userId: req.userId!, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    const pocket = await wp().findUnique({ where: { id } })
    if (!pocket || !wallet || pocket.walletId !== wallet.id)
      return res.status(404).json({ error: 'Không tìm thấy ví' })
    await wp().delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// ─── Pocket Entries ──────────────────────────────────────────────────────────

async function verifyPocketOwner(userId: string, pocketId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
  if (!wallet) return null
  const pocket = await wp().findUnique({ where: { id: pocketId } })
  if (!pocket || pocket.walletId !== wallet.id) return null
  return pocket
}

export async function getEntries(req: AuthRequest, res: Response) {
  console.log('[getEntries] pocketId:', req.params.id)
  try {
    const pocket = await verifyPocketOwner(req.userId!, req.params.id)
    if (!pocket) return res.status(404).json({ error: 'Không tìm thấy ví' })

    const entries = await pe().findMany({
      where: { pocketId: pocket.id },
      orderBy: { date: 'desc' },
    })

    // Group by month
    const grouped: Record<string, { month: string; entries: any[]; totalDeposit: number; totalWithdrawal: number }> = {}
    let runningBalance = 0
    const byDate = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const balanceMap: Record<string, number> = {}
    byDate.forEach(e => {
      runningBalance += e.type === 'DEPOSIT' ? e.amount : -e.amount
      balanceMap[e.id] = runningBalance
    })

    entries.forEach((e: any) => {
      const key = e.date.toISOString().slice(0, 7)
      if (!grouped[key]) grouped[key] = { month: key, entries: [], totalDeposit: 0, totalWithdrawal: 0 }
      grouped[key].entries.push({ ...e, balanceAfter: balanceMap[e.id] })
      if (e.type === 'DEPOSIT') grouped[key].totalDeposit += e.amount
      else grouped[key].totalWithdrawal += e.amount
    })

    res.json({ pocket, months: Object.values(grouped).sort((a, b) => b.month.localeCompare(a.month)) })
  } catch (e: any) {
    console.error('[getEntries]', e?.message ?? e)
    res.status(500).json({ error: e?.message ?? 'Lỗi server' })
  }
}

export async function addEntry(req: AuthRequest, res: Response) {
  console.log('[addEntry] pocketId:', req.params.id, 'body:', JSON.stringify(req.body))
  try {
    const pocket = await verifyPocketOwner(req.userId!, req.params.id)
    if (!pocket) return res.status(404).json({ error: 'Không tìm thấy ví' })

    const { amount, type, note, date } = req.body
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) return res.status(400).json({ error: 'Loại không hợp lệ' })
    const parsedDate = new Date(date || new Date())
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'Ngày không hợp lệ' })

    const delta = type === 'DEPOSIT' ? parsed : -parsed
    const [entry] = await prisma.$transaction([
      pe(prisma).create({ data: { pocketId: pocket.id, amount: parsed, type, note: note?.trim() || null, date: parsedDate } }),
      wp(prisma).update({ where: { id: pocket.id }, data: { balance: { increment: delta } } }),
    ])
    res.status(201).json(entry)
  } catch (e: any) {
    console.error('addEntry error:', e?.message ?? e)
    res.status(500).json({ error: e?.message ?? 'Lỗi server' })
  }
}

export async function deleteEntry(req: AuthRequest, res: Response) {
  try {
    const pocket = await verifyPocketOwner(req.userId!, req.params.id)
    if (!pocket) return res.status(404).json({ error: 'Không tìm thấy ví' })

    const entry = await pe().findUnique({ where: { id: req.params.entryId } })
    if (!entry || entry.pocketId !== pocket.id) return res.status(404).json({ error: 'Không tìm thấy' })

    const delta = entry.type === 'DEPOSIT' ? -entry.amount : entry.amount
    await prisma.$transaction([
      pe(prisma).delete({ where: { id: entry.id } }),
      wp(prisma).update({ where: { id: pocket.id }, data: { balance: { increment: delta } } }),
    ])
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function transferToMain(req: AuthRequest, res: Response) {
  try {
    const pocket = await verifyPocketOwner(req.userId!, req.params.id)
    if (!pocket) return res.status(404).json({ error: 'Không tìm thấy ví' })

    const { amount, note, date } = req.body
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    if (parsed > pocket.balance) return res.status(400).json({ error: 'Số dư không đủ' })

    const parsedDate = new Date(date || new Date())
    const userId = req.userId!

    // Get the transfer category (Chuyển khoản) or use the first income category
    const categories = await prisma.category.findMany({
      where: { OR: [{ isDefault: true }, { userId }], type: { in: ['INCOME', 'BOTH'] } },
      orderBy: { isDefault: 'desc' },
      take: 1,
    })
    const categoryId = categories[0]?.id
    if (!categoryId) return res.status(400).json({ error: 'Không tìm thấy danh mục' })

    const mainWallet = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (!mainWallet) return res.status(404).json({ error: 'Không tìm thấy ví chính' })

    await prisma.$transaction([
      // Withdraw from pocket
      pe(prisma).create({ data: { pocketId: pocket.id, amount: parsed, type: 'WITHDRAWAL', note: note?.trim() || 'Chuyển về ví chính', date: parsedDate } }),
      wp(prisma).update({ where: { id: pocket.id }, data: { balance: { decrement: parsed } } }),
      // Add income to main wallet
      prisma.transaction.create({ data: { amount: parsed, type: 'INCOME', date: parsedDate, note: note?.trim() || `Từ ${pocket.name}`, walletId: mainWallet.id, categoryId, userId } }),
    ])

    const updated = await wp().findUnique({ where: { id: pocket.id } })
    res.json({ success: true, pocket: updated })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
