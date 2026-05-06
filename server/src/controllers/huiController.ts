import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

function addPeriods(date: Date, n: number, frequency: string): Date {
  const d = new Date(date)
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + n * 7)
  else d.setMonth(d.getMonth() + n)
  return d
}

function parseMyRounds(raw: string, fallback?: number | null): number[] {
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length > 0) return arr
  } catch {}
  return fallback != null ? [fallback] : []
}

function transformHui(hui: any) {
  const { myRound, myRounds: myRoundsRaw, ...rest } = hui
  return { ...rest, myRounds: parseMyRounds(myRoundsRaw ?? '[]', myRound) }
}

async function findOrCreateHuiCategory(userId: string) {
  const existing = await (prisma as any).category.findFirst({
    where: { name: 'Hụi', userId },
  })
  if (existing) return existing
  return (prisma as any).category.create({
    data: { name: 'Hụi', icon: '🔄', color: '#6366f1', type: 'EXPENSE', userId },
  })
}

export async function getHuis(req: AuthRequest, res: Response) {
  const huis = await (prisma as any).hui.findMany({
    where: { userId: req.userId! },
    include: { rounds: { orderBy: { roundNo: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(huis.map(transformHui))
}

export async function createHui(req: AuthRequest, res: Response) {
  try {
    const { name, amount, totalRounds, myRounds: myRoundsRaw, myRound, startDate, frequency, roundOwners, organizerFee, walletId } = req.body
    const myRounds: number[] = Array.isArray(myRoundsRaw) ? myRoundsRaw : [parseInt(myRound)]
    if (myRounds.length === 0 || myRounds.some((r: number) => r < 1 || r > totalRounds)) {
      return res.status(400).json({ error: 'Kỳ hốt không hợp lệ' })
    }

    const ownerMap: Record<number, string> = {}
    if (Array.isArray(roundOwners)) {
      roundOwners.forEach((r: { roundNo: number; ownerName: string }) => { ownerMap[r.roundNo] = r.ownerName })
    }

    const hui = await (prisma as any).hui.create({
      data: {
        name,
        amount,
        totalRounds,
        myRounds: JSON.stringify(myRounds),
        startDate: new Date(startDate),
        frequency: frequency ?? 'MONTHLY',
        organizerFee: organizerFee != null ? parseFloat(organizerFee) : null,
        walletId: walletId ?? null,
        userId: req.userId!,
        rounds: {
          create: Array.from({ length: totalRounds }, (_, i) => ({
            roundNo: i + 1,
            ownerName: ownerMap[i + 1] ?? null,
            dueDate: addPeriods(new Date(startDate), i, frequency ?? 'MONTHLY'),
          })),
        },
      },
      include: { rounds: { orderBy: { roundNo: 'asc' } } },
    })
    res.json(transformHui(hui))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateHui(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params
    const existing = await (prisma as any).hui.findFirst({ where: { id, userId: req.userId! } })
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })

    const { name, status, organizerFee, myRounds, walletId } = req.body
    const hui = await (prisma as any).hui.update({
      where: { id },
      data: {
        name,
        status,
        ...(myRounds !== undefined && Array.isArray(myRounds) && { myRounds: JSON.stringify(myRounds) }),
        ...(organizerFee !== undefined && { organizerFee: organizerFee != null ? parseFloat(organizerFee) : null }),
        ...(walletId !== undefined && { walletId: walletId ?? null }),
      },
      include: { rounds: { orderBy: { roundNo: 'asc' } } },
    })
    res.json(transformHui(hui))
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteHui(req: AuthRequest, res: Response) {
  const { id } = req.params
  const existing = await (prisma as any).hui.findFirst({
    where: { id, userId: req.userId! },
    include: { rounds: { where: { walletTransactionId: { not: null } } } },
  })
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })

  // Hoàn tiền về ví: soft-delete tất cả transaction đã tạo
  const txnIds = existing.rounds
    .map((r: any) => r.walletTransactionId)
    .filter(Boolean) as string[]
  if (txnIds.length > 0) {
    await (prisma as any).transaction.updateMany({
      where: { id: { in: txnIds } },
      data: { deletedAt: new Date() },
    })
  }

  await (prisma as any).hui.delete({ where: { id } })
  res.json({ success: true })
}

export async function setBid(req: AuthRequest, res: Response) {
  try {
    const { id, roundNo } = req.params
    const hui = await (prisma as any).hui.findFirst({ where: { id, userId: req.userId! }, include: { rounds: true } })
    if (!hui) return res.status(404).json({ error: 'Không tìm thấy' })

    const round = hui.rounds.find((r: any) => r.roundNo === parseInt(roundNo))
    if (!round) return res.status(404).json({ error: 'Không tìm thấy kỳ' })

    const { bidAmount, ownerName } = req.body
    const updated = await (prisma as any).huiRound.update({
      where: { id: round.id },
      data: {
        bidAmount: bidAmount != null ? parseFloat(bidAmount) : null,
        ownerName: ownerName ?? round.ownerName,
      },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function toggleRound(req: AuthRequest, res: Response) {
  try {
    const { id, roundNo } = req.params
    const hui = await (prisma as any).hui.findFirst({ where: { id, userId: req.userId! }, include: { rounds: true } })
    if (!hui) return res.status(404).json({ error: 'Không tìm thấy' })

    const round = hui.rounds.find((r: any) => r.roundNo === parseInt(roundNo))
    if (!round) return res.status(404).json({ error: 'Không tìm thấy kỳ' })

    const myRounds = parseMyRounds(hui.myRounds ?? '[]', hui.myRound)
    const isMyRound = myRounds.includes(parseInt(roundNo))
    const walletId: string | null = hui.walletId ?? null

    if (isMyRound) {
      const willReceive = !round.isReceived
      let txnId: string | null = null

      if (willReceive && walletId) {
        const cat = await findOrCreateHuiCategory(req.userId!)
        const potAmount = hui.organizerFee != null && round.roundNo === 1
          ? hui.amount * hui.totalRounds - hui.organizerFee
          : hui.amount * hui.totalRounds
        const txn = await (prisma as any).transaction.create({
          data: {
            amount: potAmount,
            type: 'INCOME',
            date: new Date(),
            walletId,
            categoryId: cat.id,
            userId: req.userId!,
            note: `Thu hụi: ${hui.name} kỳ ${roundNo}`,
          },
        })
        txnId = txn.id
      } else if (!willReceive && round.walletTransactionId) {
        await (prisma as any).transaction.update({
          where: { id: round.walletTransactionId },
          data: { deletedAt: new Date() },
        })
      }

      const updated = await (prisma as any).huiRound.update({
        where: { id: round.id },
        data: {
          isReceived: willReceive,
          paidAt: willReceive ? new Date() : null,
          ...(willReceive ? { walletTransactionId: txnId } : { walletTransactionId: null }),
        },
      })
      res.json(updated)
    } else {
      const willPay = !round.isPaid
      let txnId: string | null = null

      if (willPay && walletId) {
        const cat = await findOrCreateHuiCategory(req.userId!)
        const live = myRounds.filter((mr: number) => mr > round.roundNo).length
        const dead = myRounds.filter((mr: number) => mr < round.roundNo).length
        const payAmount = live * (round.bidAmount ?? hui.amount) + dead * hui.amount
        const txn = await (prisma as any).transaction.create({
          data: {
            amount: payAmount,
            type: 'EXPENSE',
            date: new Date(),
            walletId,
            categoryId: cat.id,
            userId: req.userId!,
            note: `Đóng hụi: ${hui.name} kỳ ${roundNo}`,
          },
        })
        txnId = txn.id
      } else if (!willPay && round.walletTransactionId) {
        await (prisma as any).transaction.update({
          where: { id: round.walletTransactionId },
          data: { deletedAt: new Date() },
        })
      }

      const updated = await (prisma as any).huiRound.update({
        where: { id: round.id },
        data: {
          isPaid: willPay,
          paidAt: willPay ? new Date() : null,
          ...(willPay ? { walletTransactionId: txnId } : { walletTransactionId: null }),
        },
      })
      res.json(updated)
    }
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}
