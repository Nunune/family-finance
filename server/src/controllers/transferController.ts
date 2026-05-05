import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'
import { v4 as uuid } from 'uuid'

function getIO(req: AuthRequest) { return (req as any).io || null }

type WType = 'PERSONAL' | 'SHARED' | 'SUBFUND'

async function resolveWalletId(userId: string, familyId: string | undefined, walletType: WType, subFundId?: string): Promise<string | null> {
  if (walletType === 'PERSONAL') {
    const w = await prisma.wallet.findFirst({ where: { userId } })
    return w?.id ?? null
  }
  if (walletType === 'SHARED' && familyId) {
    const w = await prisma.wallet.findFirst({ where: { familyId } })
    return w?.id ?? null
  }
  if (walletType === 'SUBFUND' && subFundId) {
    const w = await (prisma as any).wallet.findFirst({ where: { subFundId } })
    return w?.id ?? null
  }
  return null
}

async function getDefaultCategory(userId: string): Promise<string | null> {
  const cat = await (prisma as any).category.findFirst({
    where: { OR: [{ isDefault: true }, { userId }] },
    orderBy: { isDefault: 'desc' },
    select: { id: true },
  })
  return cat?.id ?? null
}

export async function getTransferWallets(req: AuthRequest, res: Response) {
  const userId = req.userId!
  const familyId = req.familyId

  const wallets: { key: string; label: string; walletType: WType; subFundId?: string }[] = []

  const personal = await prisma.wallet.findFirst({ where: { userId }, select: { id: true } })
  if (personal) wallets.push({ key: 'PERSONAL', label: 'Ví cá nhân', walletType: 'PERSONAL' })

  if (familyId) {
    const shared = await prisma.wallet.findFirst({ where: { familyId }, select: { id: true } })
    if (shared) wallets.push({ key: 'SHARED', label: 'Quỹ chung', walletType: 'SHARED' })

    const subFunds = await (prisma as any).subFund.findMany({
      where: {
        familyId,
        members: { some: { userId } },
      },
      include: { wallet: { select: { id: true } } },
    })
    for (const sf of subFunds) {
      if (sf.wallet) {
        wallets.push({ key: `SUBFUND:${sf.id}`, label: `${sf.icon} ${sf.name}`, walletType: 'SUBFUND', subFundId: sf.id })
      }
    }
  }

  res.json(wallets)
}

export async function createTransfer(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const familyId = req.familyId
    const { fromWalletType, fromSubFundId, toWalletType, toSubFundId, amount, date, note } = req.body

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' })
    if (fromWalletType === toWalletType && fromSubFundId === toSubFundId) {
      return res.status(400).json({ error: 'Ví nguồn và ví đích không được trùng nhau' })
    }

    const [fromWalletId, toWalletId] = await Promise.all([
      resolveWalletId(userId, familyId, fromWalletType, fromSubFundId),
      resolveWalletId(userId, familyId, toWalletType, toSubFundId),
    ])
    if (!fromWalletId) return res.status(400).json({ error: 'Không tìm thấy ví nguồn' })
    if (!toWalletId) return res.status(400).json({ error: 'Không tìm thấy ví đích' })

    const categoryId = await getDefaultCategory(userId)
    if (!categoryId) return res.status(400).json({ error: 'Không tìm thấy danh mục' })

    const transferGroupId = uuid()
    const txDate = new Date(date ?? Date.now())
    const transferNote = note || 'Chuyển khoản'

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    await prisma.$transaction(async (tx) => {
      // Expense side: money leaves source wallet
      await (tx as any).transaction.create({
        data: {
          amount,
          type: 'EXPENSE',
          date: txDate,
          note: transferNote,
          walletId: fromWalletId,
          categoryId,
          userId,
          transferGroupId,
          logs: { create: { action: 'created', byUserId: userId, byUserName: actor?.name ?? '', snapshot: '{}' } },
        },
      })
      // Income side: money arrives at destination wallet
      await (tx as any).transaction.create({
        data: {
          amount,
          type: 'INCOME',
          date: txDate,
          note: transferNote,
          walletId: toWalletId,
          categoryId,
          userId,
          transferGroupId,
          logs: { create: { action: 'created', byUserId: userId, byUserName: actor?.name ?? '', snapshot: '{}' } },
        },
      })
    })

    if (familyId) {
      getIO(req)?.to(`family:${familyId}`).emit('transaction:created', {})
    }

    res.json({ success: true, transferGroupId })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
