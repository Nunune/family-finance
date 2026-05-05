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

    // Validate tokenVersion if present — catches logoutAll revocations
    if (payload.tokenVersion !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { tokenVersion: true },
      })
      if (!user || user.tokenVersion !== payload.tokenVersion) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' })
      }
    }

    req.userId = payload.userId
    req.userRole = payload.role
    req.familyId = payload.familyId
    next()
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ' })
  }
}

export function generateToken(userId: string, role: string, familyId?: string, tokenVersion = 0) {
  return jwt.sign({ userId, role, familyId, tokenVersion }, JWT_SECRET, { expiresIn: '7d' })
}
