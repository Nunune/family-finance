import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import prisma from '../lib/prisma'
const TTL_MS = 24 * 60 * 60 * 1000

// Dọn expired keys mỗi giờ
setInterval(async () => {
  await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
}, 60 * 60 * 1000)

export async function idempotency(req: AuthRequest, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'] as string | undefined
  if (!key || req.method !== 'POST') return next()

  const storeKey = `${req.userId}:${key}`

  try {
    const cached = await prisma.idempotencyKey.findUnique({ where: { key: storeKey } })

    if (cached) {
      // Đã xử lý — trả lại kết quả cũ, không insert lại
      return res.status(409).json({ idempotent: true, cached: JSON.parse(cached.response) })
    }

    // Monkey-patch res.json để capture response và lưu vào DB
    const originalJson = res.json.bind(res)
    res.json = (body: unknown) => {
      prisma.idempotencyKey.create({
        data: {
          key: storeKey,
          response: JSON.stringify(body),
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      }).catch(() => {}) // non-blocking, failure không ảnh hưởng response
      return originalJson(body)
    }

    next()
  } catch {
    // Nếu DB lỗi → cho qua, không block request
    next()
  }
}
