import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

export async function getExchangeRates(req: AuthRequest, res: Response) {
  const rates = await prisma.exchangeRate.findMany({
    where: { userId: req.userId! },
  })
  res.json(rates)
}

export async function upsertExchangeRate(req: AuthRequest, res: Response) {
  try {
    const { fromCurrency, toCurrency, rate } = req.body
    const parsed = parseFloat(rate)
    if (!fromCurrency || !toCurrency || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'Dữ liệu không hợp lệ' })
    }
    const result = await prisma.exchangeRate.upsert({
      where: { userId_fromCurrency_toCurrency: { userId: req.userId!, fromCurrency, toCurrency } },
      update: { rate: parsed, updatedAt: new Date() },
      create: { userId: req.userId!, fromCurrency, toCurrency, rate: parsed },
    })
    res.json(result)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
