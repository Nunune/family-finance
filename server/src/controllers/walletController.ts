import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function listWallets(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const wallets = await prisma.wallet.findMany({
      where: { userId, type: 'PERSONAL' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, currency: true, name: true, initialBalance: true, createdAt: true },
    })

    // Compute current balance from transactions in one query
    const txSums = await prisma.transaction.groupBy({
      by: ['walletId', 'type'],
      where: { walletId: { in: wallets.map(w => w.id) }, deletedAt: null },
      _sum: { amount: true },
    })

    const result = wallets.map(w => {
      const income = txSums.find(t => t.walletId === w.id && t.type === 'INCOME')?._sum.amount ?? 0
      const expense = txSums.find(t => t.walletId === w.id && t.type === 'EXPENSE')?._sum.amount ?? 0
      return { ...w, balance: w.initialBalance + income - expense }
    })

    res.json(result)
  } catch (e: any) {
    console.error('[listWallets]', e?.message ?? e)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { currency, name } = req.body
    if (!currency || !['AUD', 'USD', 'EUR', 'JPY', 'SGD', 'GBP', 'CNY'].includes(currency)) {
      return res.status(400).json({ error: 'Loại tiền không hợp lệ' })
    }
    const existing = await prisma.wallet.findFirst({ where: { userId, currency, type: 'PERSONAL' } })
    if (existing) return res.status(409).json({ error: `Đã có ví ${currency}` })

    const wallet = await prisma.wallet.create({
      data: { type: 'PERSONAL', userId, currency, name: name?.trim() || null },
      select: { id: true, currency: true, name: true, initialBalance: true, createdAt: true },
    })
    res.json(wallet)
  } catch (e: any) {
    console.error('[createWallet]', e?.message ?? e)
    res.status(500).json({ error: e?.message ?? 'Lỗi server' })
  }
}

export async function deleteWallet(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { id } = req.params
    const wallet = await prisma.wallet.findFirst({ where: { id, userId, type: 'PERSONAL' } })
    if (!wallet) return res.status(404).json({ error: 'Không tìm thấy' })

    // Prevent deleting the primary (VND) wallet
    const primary = await prisma.wallet.findFirst({ where: { userId, type: 'PERSONAL' }, orderBy: { createdAt: 'asc' } })
    if (primary?.id === id) return res.status(400).json({ error: 'Không thể xoá ví chính' })

    const txCount = await prisma.transaction.count({ where: { walletId: id, deletedAt: null } })
    if (txCount > 0) return res.status(400).json({ error: `Ví còn ${txCount} giao dịch, hãy xoá hoặc chuyển trước` })

    await prisma.wallet.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
