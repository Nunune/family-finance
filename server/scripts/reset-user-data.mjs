/**
 * Reset all financial data for a user, keeping the account intact.
 *
 * Usage (from server/ directory):
 *   railway run node scripts/reset-user-data.mjs
 *   -- or locally with DATABASE_PUBLIC_URL set:
 *   DATABASE_PUBLIC_URL="postgres://..." node scripts/reset-user-data.mjs
 */

import { PrismaClient } from '@prisma/client'

const EMAIL = 'adw.ngocnhu@gmail.com'
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
})

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (!user) { console.error('User not found:', EMAIL); process.exit(1) }

  console.log(`\n>>> Resetting data for: ${user.name} (${user.email}) <<<\n`)

  // ── Collect IDs we'll need ────────────────────────────────────────────────
  const wallets = await prisma.wallet.findMany({ where: { userId: user.id, type: 'PERSONAL' } })
  const walletIds = wallets.map(w => w.id)
  console.log(`Found ${walletIds.length} personal wallet(s)`)

  const debts = await prisma.debt.findMany({ where: { ownerId: user.id } })
  const debtIds = debts.map(d => d.id)
  console.log(`Found ${debtIds.length} debt(s)`)

  const huis = await prisma.hui.findMany({ where: { userId: user.id } })
  const huiIds = huis.map(h => h.id)
  console.log(`Found ${huiIds.length} hui(s)`)

  const savingsGoals = await prisma.savingsGoal.findMany({ where: { ownerId: user.id } })
  const goalIds = savingsGoals.map(g => g.id)
  console.log(`Found ${goalIds.length} savings goal(s)`)

  const recurrings = await prisma.recurringTransaction.findMany({ where: { ownerId: user.id } })
  const recurringIds = recurrings.map(r => r.id)
  console.log(`Found ${recurringIds.length} recurring transaction(s)`)

  console.log('\nDeleting...')

  // ── Delete in dependency order ────────────────────────────────────────────

  // Pocket entries → pockets
  if (walletIds.length) {
    const pockets = await prisma.walletPocket.findMany({ where: { walletId: { in: walletIds } } })
    const pocketIds = pockets.map(p => p.id)
    if (pocketIds.length) {
      await prisma.pocketEntry.deleteMany({ where: { pocketId: { in: pocketIds } } })
      await prisma.walletPocket.deleteMany({ where: { id: { in: pocketIds } } })
      console.log(`  Deleted ${pocketIds.length} pocket(s) + entries`)
    }
  }

  // Transactions (hard delete — test data)
  if (walletIds.length) {
    const txCount = await prisma.transaction.count({ where: { walletId: { in: walletIds } } })
    await prisma.transaction.deleteMany({ where: { walletId: { in: walletIds } } })
    console.log(`  Deleted ${txCount} transaction(s)`)
  }

  // Reset wallet initialBalance to 0
  if (walletIds.length) {
    await prisma.wallet.updateMany({ where: { id: { in: walletIds } }, data: { initialBalance: 0 } })
    console.log(`  Reset ${walletIds.length} wallet balance(s) to 0`)
  }

  // Debt payments → debts
  if (debtIds.length) {
    await prisma.debtPayment.deleteMany({ where: { debtId: { in: debtIds } } })
    await prisma.debtViewer.deleteMany({ where: { debtId: { in: debtIds } } })
    await prisma.debt.deleteMany({ where: { id: { in: debtIds } } })
    console.log(`  Deleted ${debtIds.length} debt(s)`)
  }

  // Recurring transaction proposals → recurring
  if (recurringIds.length) {
    await prisma.transactionProposal.deleteMany({ where: { recurringId: { in: recurringIds } } })
    await prisma.recurringTransaction.deleteMany({ where: { id: { in: recurringIds } } })
    console.log(`  Deleted ${recurringIds.length} recurring transaction(s)`)
  }

  // Savings: approvals → withdrawal requests → contributions → goals
  if (goalIds.length) {
    const requests = await prisma.savingsWithdrawalRequest.findMany({ where: { goalId: { in: goalIds } } })
    const requestIds = requests.map(r => r.id)
    if (requestIds.length) {
      await prisma.savingsWithdrawalApproval.deleteMany({ where: { requestId: { in: requestIds } } })
      await prisma.savingsWithdrawalRequest.deleteMany({ where: { id: { in: requestIds } } })
    }
    await prisma.savingsContribution.deleteMany({ where: { goalId: { in: goalIds } } })
    await prisma.savingsGoal.deleteMany({ where: { id: { in: goalIds } } })
    console.log(`  Deleted ${goalIds.length} savings goal(s)`)
  }

  // Plan items
  const planCount = await prisma.planItem.count({ where: { userId: user.id } })
  await prisma.planItem.deleteMany({ where: { userId: user.id } })
  console.log(`  Deleted ${planCount} plan item(s)`)

  // Hui rounds → hui
  if (huiIds.length) {
    await prisma.huiRound.deleteMany({ where: { huiId: { in: huiIds } } })
    await prisma.hui.deleteMany({ where: { id: { in: huiIds } } })
    console.log(`  Deleted ${huiIds.length} hui(s)`)
  }

  // Exchange rates
  const rateCount = await prisma.exchangeRate.count({ where: { userId: user.id } })
  await prisma.exchangeRate.deleteMany({ where: { userId: user.id } })
  console.log(`  Deleted ${rateCount} exchange rate(s)`)

  // Recipient labels
  const labelCount = await prisma.recipientLabel.count({ where: { userId: user.id } })
  await prisma.recipientLabel.deleteMany({ where: { userId: user.id } })
  console.log(`  Deleted ${labelCount} recipient label(s)`)

  // User-created categories (not default system ones)
  const catCount = await prisma.category.count({ where: { userId: user.id } })
  await prisma.category.deleteMany({ where: { userId: user.id } })
  console.log(`  Deleted ${catCount} custom category(s)`)

  // Weekly budgets
  const wbCount = await prisma.weeklyBudget.count({ where: { userId: user.id } })
  await prisma.weeklyBudget.deleteMany({ where: { userId: user.id } })
  console.log(`  Deleted ${wbCount} weekly budget(s)`)

  // Monthly budgets
  const monthlyBudgets = await prisma.monthlyBudget.findMany({ where: { userId: user.id } })
  if (monthlyBudgets.length) {
    await prisma.monthlyBudgetItem.deleteMany({ where: { budgetId: { in: monthlyBudgets.map(b => b.id) } } })
    await prisma.monthlyBudget.deleteMany({ where: { userId: user.id } })
    console.log(`  Deleted ${monthlyBudgets.length} monthly budget(s)`)
  }

  // Sub-fund memberships
  const sfCount = await prisma.subFundMember.count({ where: { userId: user.id } })
  await prisma.subFundMember.deleteMany({ where: { userId: user.id } })
  console.log(`  Removed ${sfCount} sub-fund membership(s)`)

  // Family: leave if member, or handle admin case
  if (user.familyId) {
    if (user.role === 'ADMIN') {
      const memberCount = await prisma.user.count({ where: { familyId: user.familyId } })
      if (memberCount === 1) {
        // Only member — delete the family + shared wallet
        const sharedWallet = await prisma.wallet.findUnique({ where: { familyId: user.familyId } })
        if (sharedWallet) {
          await prisma.transaction.deleteMany({ where: { walletId: sharedWallet.id } })
          await prisma.wallet.delete({ where: { id: sharedWallet.id } })
        }
        await prisma.familyInvite.deleteMany({ where: { familyId: user.familyId } })
        await prisma.family.delete({ where: { id: user.familyId } })
        await prisma.user.update({ where: { id: user.id }, data: { familyId: null, role: 'MEMBER' } })
        console.log(`  Deleted family (solo admin)`)
      } else {
        console.log(`  ⚠ Bạn là ADMIN của gia đình có ${memberCount} thành viên — giữ nguyên gia đình`)
      }
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { familyId: null, role: 'MEMBER' } })
      console.log(`  Left family`)
    }
  }

  // Close any archived foreign wallets (re-open them by clearing closedAt)
  await prisma.wallet.updateMany({
    where: { userId: user.id, type: 'PERSONAL' },
    data: { closedAt: null },
  })

  // Delete foreign currency wallets (keep only primary VND wallet)
  const primaryWallet = wallets[0]
  if (primaryWallet && wallets.length > 1) {
    const foreignIds = wallets.slice(1).map(w => w.id)
    await prisma.wallet.deleteMany({ where: { id: { in: foreignIds } } })
    console.log(`  Deleted ${foreignIds.length} foreign currency wallet(s)`)
  }

  console.log('\n✅ Reset hoàn tất! Tài khoản sạch, sẵn sàng sử dụng thật.')
  console.log(`   Email: ${user.email}`)
  console.log(`   Mật khẩu: giữ nguyên như cũ`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
