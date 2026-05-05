import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

const wp = (tx?: any) => ((tx ?? prisma) as any).walletPocket

export async function getPockets(req: AuthRequest, res: Response) {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
    if (!wallet) return res.json([])
    const pockets = await wp().findMany({
      where: { walletId: wallet.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
    res.json(pockets)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createPocket(req: AuthRequest, res: Response) {
  try {
    const { name, icon, color, balance, isHidden } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Cần nhập tên ví' })
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
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
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
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
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } })
    const pocket = await wp().findUnique({ where: { id } })
    if (!pocket || !wallet || pocket.walletId !== wallet.id)
      return res.status(404).json({ error: 'Không tìm thấy ví' })
    await wp().delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
