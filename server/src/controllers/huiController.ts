import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

function addPeriods(date: Date, n: number, frequency: string): Date {
  const d = new Date(date)
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + n * 7)
  else d.setMonth(d.getMonth() + n)
  return d
}

export async function getHuis(req: AuthRequest, res: Response) {
  const huis = await (prisma as any).hui.findMany({
    where: { userId: req.userId! },
    include: { rounds: { orderBy: { roundNo: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(huis)
}

export async function createHui(req: AuthRequest, res: Response) {
  try {
    const { name, amount, totalRounds, myRound, startDate, frequency, roundOwners } = req.body
    // roundOwners: optional array of { roundNo, ownerName }
    const ownerMap: Record<number, string> = {}
    if (Array.isArray(roundOwners)) {
      roundOwners.forEach((r: { roundNo: number; ownerName: string }) => { ownerMap[r.roundNo] = r.ownerName })
    }

    const hui = await (prisma as any).hui.create({
      data: {
        name,
        amount,
        totalRounds,
        myRound,
        startDate: new Date(startDate),
        frequency: frequency ?? 'MONTHLY',
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
    res.json(hui)
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

    const { name, status } = req.body
    const hui = await (prisma as any).hui.update({
      where: { id },
      data: { name, status },
      include: { rounds: { orderBy: { roundNo: 'asc' } } },
    })
    res.json(hui)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function deleteHui(req: AuthRequest, res: Response) {
  const { id } = req.params
  const existing = await (prisma as any).hui.findFirst({ where: { id, userId: req.userId! } })
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' })
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

    const isMyRound = hui.myRound === parseInt(roundNo)

    if (isMyRound) {
      // Toggle isReceived
      const updated = await (prisma as any).huiRound.update({
        where: { id: round.id },
        data: {
          isReceived: !round.isReceived,
          paidAt: !round.isReceived ? new Date() : null,
        },
      })
      res.json(updated)
    } else {
      // Toggle isPaid
      const updated = await (prisma as any).huiRound.update({
        where: { id: round.id },
        data: {
          isPaid: !round.isPaid,
          paidAt: !round.isPaid ? new Date() : null,
        },
      })
      res.json(updated)
    }
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
