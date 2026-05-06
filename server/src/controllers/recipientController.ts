import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getRecipients(req: AuthRequest, res: Response) {
  const labels = await (prisma as any).recipientLabel.findMany({
    where: { userId: req.userId! },
    orderBy: { name: 'asc' },
  })
  res.json(labels)
}

export async function createRecipient(req: AuthRequest, res: Response) {
  try {
    const { name, icon, color } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Tên không được để trống' })
    const label = await (prisma as any).recipientLabel.create({
      data: { name: name.trim(), icon: icon ?? '👤', color: color ?? '#6B7280', userId: req.userId! },
    })
    res.json(label)
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Nhãn đã tồn tại' })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateRecipient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const existing = await (prisma as any).recipientLabel.findFirst({ where: { id, userId: req.userId! } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })
    const { name, icon, color } = req.body
    const label = await (prisma as any).recipientLabel.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
      },
    })
    res.json(label)
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Tên nhãn đã tồn tại' })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteRecipient(req: AuthRequest, res: Response) {
  const { id } = req.params
  const existing = await (prisma as any).recipientLabel.findFirst({ where: { id, userId: req.userId! } })
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })
  await (prisma as any).recipientLabel.delete({ where: { id } })
  res.json({ success: true })
}
