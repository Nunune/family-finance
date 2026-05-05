import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable must be set`)
  return value
}
const JWT_SECRET = requireEnv('JWT_SECRET')

export function setupSocket(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) return next(new Error('Unauthorized'))
    try {
      const payload = jwt.verify(token, JWT_SECRET) as {
        userId: string
        familyId?: string
        tokenVersion?: number
      }

      if (payload.tokenVersion !== undefined) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { tokenVersion: true },
        })
        if (!user || user.tokenVersion !== payload.tokenVersion) {
          return next(new Error('Session revoked'))
        }
      }

      socket.data.userId = payload.userId
      socket.data.familyId = payload.familyId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const { userId, familyId } = socket.data
    socket.join(`user:${userId}`)
    if (familyId) socket.join(`family:${familyId}`)

    socket.on('disconnect', () => {})
  })
}
