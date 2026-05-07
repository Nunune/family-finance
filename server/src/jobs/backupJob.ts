import cron from 'node-cron'
import prisma from '../lib/prisma'
import { sendBackupEmail } from '../lib/mailer'

// Every Monday 8:00 AM Vietnam time (UTC+7 → 01:00 UTC)
export function startBackupJob() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[BackupJob] Skipped — GMAIL_USER or GMAIL_APP_PASSWORD not set')
    return
  }

  cron.schedule('0 1 * * 1', async () => {
    console.log('[BackupJob] Starting weekly backup for all subscribers...')
    try {
      const subscribers = await (prisma.user as any).findMany({
        where: { receiveBackupEmail: true },
        select: { email: true },
      })
      console.log(`[BackupJob] Found ${subscribers.length} subscriber(s)`)
      for (const u of subscribers) {
        try {
          await runBackupForUser(u.email)
          console.log(`[BackupJob] Sent to ${u.email}`)
        } catch (err) {
          console.error(`[BackupJob] Failed for ${u.email}:`, err)
        }
      }
    } catch (err) {
      console.error('[BackupJob] Fatal:', err)
    }
  }, { timezone: 'UTC' })

  console.log('[BackupJob] Scheduled — every Monday 8:00 AM Vietnam time')
}

export async function runBackupForUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, familyId: true },
  })
  if (!user) throw new Error(`User not found: ${email}`)

  const familyId = user.familyId ?? null

  const [transactions, debts, savingsGoals, recurrings, familyInfo] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        OR: [
          { wallet: { userId: user.id } },
          ...(familyId ? [{ wallet: { familyId } }] : []),
        ],
      },
      include: {
        category: { select: { name: true, icon: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),

    prisma.debt.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          ...(familyId ? [{ scope: 'SHARED', familyId }] : []),
        ],
      },
      include: { payments: { include: { paidBy: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.savingsGoal.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          ...(familyId ? [{ isShared: true, familyId }] : []),
        ],
      },
      include: { contributions: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.recurringTransaction.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          ...(familyId ? [{ familyId }] : []),
        ],
      },
      include: { category: { select: { name: true, icon: true } } },
      orderBy: { createdAt: 'asc' },
    }),

    familyId
      ? prisma.family.findUnique({
          where: { id: familyId },
          include: { members: { select: { id: true, name: true, email: true, role: true } } },
        })
      : null,
  ])

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const filename = `backup-${dateStr}.json`

  const payload = JSON.stringify(
    { exportedAt: now.toISOString(), exportedBy: user.name, family: familyInfo, transactions, debts, savingsGoals, recurrings },
    null,
    2,
  )

  await sendBackupEmail(email, filename, payload)
}
