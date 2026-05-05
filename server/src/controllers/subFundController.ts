import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import prisma from '../lib/prisma'

const db = prisma as any

// Lấy danh sách quỹ phụ của gia đình, kèm số dư
export async function getSubFunds(req: AuthRequest, res: Response) {
  try {
    const { familyId } = req
    if (!familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })

    const funds = await db.subFund.findMany({
      where: { familyId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        wallet: { select: { id: true, initialBalance: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Tính số dư thực cho từng quỹ
    const result = await Promise.all(funds.map(async (fund: any) => {
      let balance = fund.wallet?.initialBalance ?? 0
      if (fund.wallet) {
        const agg = await prisma.transaction.aggregate({
          where: { walletId: fund.wallet.id, deletedAt: null },
          _sum: { amount: true },
        })
        // income tăng, expense giảm — Transaction.amount luôn dương, type phân biệt
        const txs = await prisma.transaction.findMany({
          where: { walletId: fund.wallet.id, deletedAt: null },
          select: { amount: true, type: true },
        })
        const net = txs.reduce((s: number, tx: any) => s + (tx.type === 'INCOME' ? tx.amount : -tx.amount), 0)
        balance = (fund.wallet.initialBalance ?? 0) + net
      }
      return { ...fund, balance }
    }))

    res.json(result)
  } catch (err) {
    console.error('[getSubFunds]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Tạo quỹ phụ mới (chỉ ADMIN gia đình)
export async function createSubFund(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    if (!familyId) return res.status(400).json({ error: 'Chưa vào gia đình' })

    const me = await prisma.user.findUnique({ where: { id: userId! } })
    if (me?.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ quản trị viên mới tạo được quỹ phụ' })

    const { name, icon, description } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Nhập tên quỹ' })

    // Tạo SubFund + Wallet cùng lúc
    const fund = await db.subFund.create({
      data: {
        name: name.trim(),
        icon: icon ?? '🏦',
        description: description?.trim() || null,
        familyId,
        wallet: {
          create: { type: 'SUBFUND', initialBalance: 0 },
        },
        members: {
          create: { userId: userId!, role: 'ADMIN' },
        },
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
        wallet: { select: { id: true, initialBalance: true } },
      },
    })

    res.json({ ...fund, balance: 0 })
  } catch (err) {
    console.error('[createSubFund]', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Sửa quỹ phụ
export async function updateSubFund(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    const { id } = req.params

    const fund = await db.subFund.findFirst({ where: { id, familyId } })
    if (!fund) return res.status(404).json({ error: 'Không tìm thấy quỹ' })

    const member = await db.subFundMember.findUnique({
      where: { subFundId_userId: { subFundId: id, userId: userId! } },
    })
    if (!member || member.role !== 'ADMIN') return res.status(403).json({ error: 'Không có quyền' })

    const { name, icon, description } = req.body
    const updated = await db.subFund.update({
      where: { id },
      data: {
        name: name?.trim() ?? fund.name,
        icon: icon ?? fund.icon,
        description: description !== undefined ? (description?.trim() || null) : fund.description,
        updatedAt: new Date(),
      },
      include: {
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
        wallet: { select: { id: true, initialBalance: true } },
      },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Xoá quỹ phụ
export async function deleteSubFund(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    const { id } = req.params

    const fund = await db.subFund.findFirst({ where: { id, familyId } })
    if (!fund) return res.status(404).json({ error: 'Không tìm thấy quỹ' })

    const me = await prisma.user.findUnique({ where: { id: userId! } })
    if (me?.role !== 'ADMIN') return res.status(403).json({ error: 'Chỉ quản trị viên mới xoá được' })

    await db.subFund.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Thêm thành viên vào quỹ phụ
export async function addMember(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    const { id } = req.params
    const { targetUserId, role } = req.body

    const fund = await db.subFund.findFirst({ where: { id, familyId } })
    if (!fund) return res.status(404).json({ error: 'Không tìm thấy quỹ' })

    const member = await db.subFundMember.findUnique({
      where: { subFundId_userId: { subFundId: id, userId: userId! } },
    })
    if (!member || member.role !== 'ADMIN') return res.status(403).json({ error: 'Không có quyền' })

    // Kiểm tra user là thành viên gia đình
    const target = await prisma.user.findFirst({ where: { id: targetUserId, familyId } })
    if (!target) return res.status(400).json({ error: 'Người dùng không thuộc gia đình này' })

    const newMember = await db.subFundMember.upsert({
      where: { subFundId_userId: { subFundId: id, userId: targetUserId } },
      update: { role: role ?? 'MEMBER' },
      create: { subFundId: id, userId: targetUserId, role: role ?? 'MEMBER' },
      include: { user: { select: { id: true, name: true, role: true } } },
    })
    res.json(newMember)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Xoá thành viên khỏi quỹ phụ
export async function removeMember(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    const { id, memberId } = req.params

    const fund = await db.subFund.findFirst({ where: { id, familyId } })
    if (!fund) return res.status(404).json({ error: 'Không tìm thấy quỹ' })

    const me = await db.subFundMember.findUnique({
      where: { subFundId_userId: { subFundId: id, userId: userId! } },
    })
    if (!me || me.role !== 'ADMIN') return res.status(403).json({ error: 'Không có quyền' })

    await db.subFundMember.deleteMany({ where: { subFundId: id, userId: memberId } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}

// Lấy walletId của quỹ phụ (để dùng trong transaction)
export async function getSubFundWallet(req: AuthRequest, res: Response) {
  try {
    const { familyId, userId } = req
    const { id } = req.params

    const fund = await db.subFund.findFirst({
      where: { id, familyId },
      include: { wallet: true, members: { where: { userId: userId! } } },
    })
    if (!fund) return res.status(404).json({ error: 'Không tìm thấy quỹ' })
    if (!fund.members.length) return res.status(403).json({ error: 'Bạn không phải thành viên quỹ này' })

    res.json(fund.wallet)
  } catch {
    res.status(500).json({ error: 'Lỗi server' })
  }
}
