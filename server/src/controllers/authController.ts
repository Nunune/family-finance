import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateToken, AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

// Tạo recovery code dạng XXXX-XXXX-XXXX (dễ đọc, dễ ghi lại)
function generateRecoveryCode(): string {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${seg()}-${seg()}-${seg()}`
}

// ─── Auth cơ bản ───────────────────────────────────────────────────────────

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'Thiếu thông tin' })
    if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' })

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return res.status(400).json({ error: 'Email đã tồn tại' })

    const recoveryCode = generateRecoveryCode()
    const [hashedPassword, hashedRecovery] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(recoveryCode, 10),
    ])

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, recoveryCodeHash: hashedRecovery },
    })
    await prisma.wallet.create({ data: { type: 'PERSONAL', userId: user.id } })

    const token = generateToken(user.id, user.role)
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, familyId: user.familyId },
      // Trả về plain text 1 lần duy nhất — client hiển thị modal bắt user lưu lại
      recoveryCode,
    })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Email hoặc mật khẩu không đúng' })

    const token = generateToken(user.id, user.role, user.familyId ?? undefined, user.tokenVersion)
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, isAppAdmin: user.isAppAdmin, familyId: user.familyId } })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, role: true, isAppAdmin: true, familyId: true, createdAt: true, receiveBackupEmail: true },
    })
    res.json(user)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// ─── Quên mật khẩu — dùng recovery code ───────────────────────────────────

export async function verifyRecoveryCode(req: Request, res: Response) {
  try {
    const { email, recoveryCode } = req.body
    if (!email || !recoveryCode) return res.status(400).json({ error: 'Thiếu thông tin' })

    const user = await prisma.user.findUnique({ where: { email } })
    // Trả lời giống nhau dù email tồn tại hay không — tránh user enumeration
    if (!user || !user.recoveryCodeHash) {
      return res.status(400).json({ error: 'Email hoặc mã khôi phục không đúng' })
    }

    const valid = await bcrypt.compare(recoveryCode.trim().toUpperCase(), user.recoveryCodeHash)
    if (!valid) return res.status(400).json({ error: 'Email hoặc mã khôi phục không đúng' })

    const resetToken = uuidv4()
    const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiresAt },
    })

    res.json({ resetToken, message: 'Xác thực thành công, đặt mật khẩu mới trong 15 phút' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' })

    const user = await prisma.user.findFirst({
      where: { resetToken, resetTokenExpiresAt: { gt: new Date() } },
    })
    if (!user) return res.status(400).json({ error: 'Phiên đặt lại mật khẩu đã hết hạn' })

    const newRecoveryCode = generateRecoveryCode()
    const [hashedPassword, hashedRecovery] = await Promise.all([
      bcrypt.hash(newPassword, 10),
      bcrypt.hash(newRecoveryCode, 10),
    ])

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        recoveryCodeHash: hashedRecovery,
        resetToken: null,
        resetTokenExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    })

    res.json({ newRecoveryCode, message: 'Đặt lại mật khẩu thành công' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// ─── Gia đình & Invite ─────────────────────────────────────────────────────

export async function createFamily(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Thiếu tên gia đình' })

    const family = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.userId } })
      if (user?.familyId) throw Object.assign(new Error(), { status: 400, msg: 'Bạn đã thuộc một gia đình' })

      const f = await tx.family.create({ data: { name: name.trim() } })
      await tx.wallet.create({ data: { type: 'SHARED', familyId: f.id } })
      await tx.user.update({ where: { id: req.userId }, data: { familyId: f.id, role: 'ADMIN' } })
      return f
    })

    const token = generateToken(req.userId!, 'ADMIN', family.id)
    res.json({ family, token })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function createInvite(req: AuthRequest, res: Response) {
  try {
    if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin mới tạo được mời' })
    if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })

    const { personalCode, hint } = req.body
    if (!personalCode?.trim()) return res.status(400).json({ error: 'Cần nhập mã cá nhân' })
    if (!hint?.trim()) return res.status(400).json({ error: 'Cần nhập gợi ý cho mã cá nhân' })

    const memberCount = await prisma.user.count({ where: { familyId: req.familyId } })
    if (memberCount >= 5) return res.status(400).json({ error: 'Gia đình đã đủ 5 thành viên' })

    // Vô hiệu hoá invite cũ chưa dùng (tránh tích luỹ)
    await prisma.familyInvite.deleteMany({
      where: { familyId: req.familyId, usedAt: null, expiresAt: { gt: new Date() } },
    })

    const inviteCode = uuidv4().slice(0, 8).toUpperCase()
    const personalCodeHash = await bcrypt.hash(personalCode.trim(), 10)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 ngày

    const invite = await prisma.familyInvite.create({
      data: {
        familyId: req.familyId,
        inviteCode,
        personalCodeHash,
        hint: hint.trim(),
        createdByUserId: req.userId!,
        expiresAt,
      },
    })

    res.json({ inviteCode: invite.inviteCode, hint: invite.hint, expiresAt: invite.expiresAt })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function revokeInvite(req: AuthRequest, res: Response) {
  try {
    if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin mới thu hồi được mời' })
    const { inviteCode } = req.params
    await prisma.familyInvite.deleteMany({
      where: { inviteCode, familyId: req.familyId! },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getInvites(req: AuthRequest, res: Response) {
  try {
    if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin' })
    const invites = await prisma.familyInvite.findMany({
      where: { familyId: req.familyId!, usedAt: null, expiresAt: { gt: new Date() } },
      select: { inviteCode: true, hint: true, expiresAt: true, createdAt: true },
    })
    res.json(invites)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function joinFamily(req: AuthRequest, res: Response) {
  try {
    const { inviteCode, personalCode } = req.body
    if (!inviteCode || !personalCode) return res.status(400).json({ error: 'Thiếu mã mời hoặc mã cá nhân' })

    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    if (user?.familyId) return res.status(400).json({ error: 'Bạn đã thuộc một gia đình' })

    const invite = await prisma.familyInvite.findUnique({ where: { inviteCode: inviteCode.toUpperCase() } })

    // Thông báo lỗi chung — không tiết lộ mã nào sai
    const invalidMsg = 'Mã mời hoặc mã cá nhân không đúng'
    if (!invite) return res.status(400).json({ error: invalidMsg })
    if (invite.usedAt) return res.status(400).json({ error: 'Mã mời đã được sử dụng' })
    if (invite.expiresAt < new Date()) return res.status(400).json({ error: 'Mã mời đã hết hạn' })

    const validPersonalCode = await bcrypt.compare(personalCode.trim(), invite.personalCodeHash)
    if (!validPersonalCode) return res.status(400).json({ error: invalidMsg })

    await prisma.$transaction(async (tx) => {
      const freshInvite = await tx.familyInvite.findUnique({ where: { inviteCode: inviteCode.toUpperCase() } })
      if (!freshInvite || freshInvite.usedAt) {
        throw Object.assign(new Error(), { status: 400, msg: 'Mã mời đã được sử dụng' })
      }
      const memberCount = await tx.user.count({ where: { familyId: invite.familyId } })
      if (memberCount >= 5) {
        throw Object.assign(new Error(), { status: 400, msg: 'Gia đình đã đủ 5 thành viên' })
      }
      await tx.familyInvite.update({
        where: { inviteCode: invite.inviteCode },
        data: { usedAt: new Date(), usedByUserId: req.userId },
      })
      await tx.user.update({
        where: { id: req.userId },
        data: { familyId: invite.familyId, role: 'MEMBER' },
      })
    })

    const family = await prisma.family.findUnique({ where: { id: invite.familyId } })
    const token = generateToken(req.userId!, 'MEMBER', invite.familyId)
    ;(req as any).io?.to(`family:${invite.familyId}`).emit('family:member_joined')
    res.json({ family, token })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function leaveFamily(req: AuthRequest, res: Response) {
  try {
    if (!req.familyId) return res.status(400).json({ error: 'Bạn chưa thuộc gia đình nào' })

    if (req.userRole === 'ADMIN') {
      const memberCount = await prisma.user.count({ where: { familyId: req.familyId } })
      if (memberCount > 1) {
        return res.status(400).json({ error: 'Bạn là Admin — hãy chuyển quyền cho thành viên khác trước khi rời' })
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { familyId: null, role: 'MEMBER', tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    const token = generateToken(req.userId!, 'MEMBER', undefined, updated.tokenVersion)
    ;(req as any).io?.to(`family:${req.familyId}`).emit('family:member_left')
    res.json({ token })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function transferAdmin(req: AuthRequest, res: Response) {
  try {
    if (!req.familyId) return res.status(400).json({ error: 'Bạn chưa thuộc gia đình nào' })
    if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Chỉ Admin mới chuyển quyền được' })

    const { targetUserId } = req.body
    if (!targetUserId) return res.status(400).json({ error: 'Thiếu targetUserId' })
    if (targetUserId === req.userId) return res.status(400).json({ error: 'Không thể chuyển cho chính mình' })

    const target = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target || target.familyId !== req.familyId) {
      return res.status(400).json({ error: 'Người dùng không thuộc gia đình này' })
    }

    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: targetUserId } })
      if (!target || target.familyId !== req.familyId) {
        throw Object.assign(new Error(), { status: 400, msg: 'Người dùng không thuộc gia đình này' })
      }
      await tx.user.update({ where: { id: targetUserId }, data: { role: 'ADMIN' } })
      await tx.user.update({ where: { id: req.userId }, data: { role: 'MEMBER' } })
    })

    res.json({ success: true })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { name, email, currentPassword } = req.body

    if (!currentPassword) return res.status(400).json({ error: 'Cần xác nhận mật khẩu hiện tại' })
    if (!name?.trim() && !email?.trim()) return res.status(400).json({ error: 'Không có gì để cập nhật' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ error: 'Mật khẩu không đúng' })

    const newEmail = email?.trim()
    const isEmailChanging = newEmail && newEmail !== user.email
    if (isEmailChanging) {
      const exists = await prisma.user.findUnique({ where: { email: newEmail } })
      if (exists) return res.status(400).json({ error: 'Email đã được sử dụng' })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        ...(isEmailChanging && { email: newEmail, tokenVersion: { increment: 1 } }),
      },
      select: { id: true, name: true, email: true, role: true, isAppAdmin: true, familyId: true, tokenVersion: true },
    })

    if (isEmailChanging) {
      const token = generateToken(userId, updated.role, updated.familyId ?? undefined, updated.tokenVersion)
      return res.json({ user: updated, token })
    }

    res.json({ user: updated })
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ error: err.msg })
    if (err?.code === 'P2002') return res.status(400).json({ error: 'Email đã được sử dụng' })
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' })

    const isSame = await bcrypt.compare(newPassword, user.password)
    if (isSame) return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu cũ' })

    const hashed = await bcrypt.hash(newPassword, 10)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    const token = generateToken(userId, user.role, user.familyId ?? undefined, updated.tokenVersion)
    res.json({ token, message: 'Đổi mật khẩu thành công' })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function logoutAll(req: AuthRequest, res: Response) {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { tokenVersion: { increment: 1 } },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getFamilyInfo(req: AuthRequest, res: Response) {
  try {
    if (!req.familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })
    const family = await prisma.family.findUnique({
      where: { id: req.familyId },
      include: {
        members: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      },
    })
    res.json(family)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function getFamilyReport(req: AuthRequest, res: Response) {
  try {
    if (!req.familyId) return res.status(403).json({ error: 'Cần có gia đình' })

    const monthParam = (req.query.month as string) ?? new Date().toISOString().slice(0, 7) // "2026-05"
    const [y, m] = monthParam.split('-').map(Number)
    const startDate = new Date(y, m - 1, 1)
    const endDate = new Date(y, m, 1)

    // Family members
    const family = await prisma.family.findUnique({
      where: { id: req.familyId },
      include: { members: { select: { id: true, name: true } } },
    })
    if (!family) return res.status(404).json({ error: 'Không tìm thấy gia đình' })

    // Personal wallets for each member (all currencies)
    const memberWallets = await prisma.wallet.findMany({
      where: { userId: { in: family.members.map(m => m.id) }, type: 'PERSONAL' },
      select: { id: true, userId: true },
    })
    const walletUserMap: Record<string, string> = {}
    memberWallets.forEach(w => { if (w.userId) walletUserMap[w.id] = w.userId })

    // Shared wallet
    const sharedWallet = await prisma.wallet.findFirst({ where: { familyId: req.familyId }, select: { id: true } })

    // Sub-fund wallets
    const subFunds = await (prisma as any).subFund.findMany({
      where: { familyId: req.familyId },
      include: { wallet: { select: { id: true } } },
    })

    const allWalletIds = [
      ...memberWallets.map(w => w.id),
      ...(sharedWallet ? [sharedWallet.id] : []),
      ...subFunds.filter((s: any) => s.wallet).map((s: any) => s.wallet.id),
    ]

    // All transactions for the month across all wallets
    const txs = await prisma.transaction.findMany({
      where: {
        walletId: { in: allWalletIds },
        date: { gte: startDate, lt: endDate },
        deletedAt: null,
      },
      include: { category: { select: { name: true, icon: true, color: true } } },
    })

    // Per-member personal stats (all wallets, exclude inter-wallet transfers)
    const memberStats = family.members.map(member => {
      const memberWalletIds = memberWallets.filter(w => w.userId === member.id).map(w => w.id)
      const memberTxs = txs.filter(t => memberWalletIds.includes(t.walletId) && !(t as any).transferGroupId)
      return {
        userId: member.id,
        name: member.name,
        personalIncome: memberTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
        personalExpense: memberTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
      }
    })

    // Shared wallet stats (exclude inter-wallet transfers)
    const sharedTxs = sharedWallet
      ? txs.filter(t => t.walletId === sharedWallet.id && !(t as any).transferGroupId)
      : []
    const shared = {
      income: sharedTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0),
      expense: sharedTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0),
    }

    // Sub-fund stats (exclude inter-wallet transfers)
    const subFundStats = subFunds.map((sf: any) => {
      const sfTxs = sf.wallet
        ? txs.filter((t: any) => t.walletId === sf.wallet.id && !t.transferGroupId)
        : []
      return {
        id: sf.id,
        name: sf.name,
        icon: sf.icon,
        income: sfTxs.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0),
        expense: sfTxs.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0),
      }
    })

    // Category breakdown (all wallets, exclude transfers)
    const catMap: Record<string, { name: string; icon: string; color: string; amount: number }> = {}
    txs.filter(t => t.type === 'EXPENSE' && !(t as any).transferGroupId).forEach(t => {
      const key = t.categoryId
      if (!catMap[key]) catMap[key] = { name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 }
      catMap[key].amount += t.amount
    })
    const categoryBreakdown = Object.values(catMap).sort((a, b) => b.amount - a.amount)

    const subFundIncome = subFundStats.reduce((s: number, sf: any) => s + sf.income, 0)
    const subFundExpense = subFundStats.reduce((s: number, sf: any) => s + sf.expense, 0)
    const totalIncome = memberStats.reduce((s, m) => s + m.personalIncome, 0) + shared.income + subFundIncome
    const totalExpense = memberStats.reduce((s, m) => s + m.personalExpense, 0) + shared.expense + subFundExpense

    res.json({
      month: monthParam,
      members: memberStats,
      shared,
      subFunds: subFundStats,
      grandTotal: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
      categoryBreakdown,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

export async function setBackupEmailPreference(req: AuthRequest, res: Response) {
  const { enabled } = req.body
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled phải là true/false' })
  await (prisma.user as any).update({
    where: { id: req.userId! },
    data: { receiveBackupEmail: enabled },
  })
  res.json({ success: true, receiveBackupEmail: enabled })
}

