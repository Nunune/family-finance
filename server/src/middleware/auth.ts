import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable must be set`)
  return value
}
const JWT_SECRET = requireEnv('JWT_SECRET')

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
  isAppAdmin?: boolean
  familyId?: string
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' })

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string
      role: string
      familyId?: string
      tokenVersion?: number
    }

    // Always read role + familyId from DB so promotions/changes take effect without re-login
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, isAppAdmin: true, familyId: true, tokenVersion: true },
    })
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' })

    // Validate tokenVersion — catches logoutAll revocations
    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' })
    }

    req.userId = payload.userId
    req.userRole = user.role
    req.isAppAdmin = user.isAppAdmin
    req.familyId = user.familyId ?? payload.familyId
    next()
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' })
  }
}

export function generateToken(userId: string, role: string, familyId?: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, familyId, tokenVersion }, JWT_SECRET, { expiresIn: '7d' })
}
