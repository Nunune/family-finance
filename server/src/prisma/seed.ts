import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  { name: 'Ăn uống', icon: '🍜', color: '#F97316', type: 'EXPENSE', isDefault: true },
  { name: 'Di chuyển', icon: '🚗', color: '#3B82F6', type: 'EXPENSE', isDefault: true },
  { name: 'Hóa đơn', icon: '💡', color: '#EAB308', type: 'EXPENSE', isDefault: true },
  { name: 'Mua sắm', icon: '🛍️', color: '#EC4899', type: 'EXPENSE', isDefault: true },
  { name: 'Giáo dục', icon: '📚', color: '#8B5CF6', type: 'EXPENSE', isDefault: true },
  { name: 'Sức khỏe', icon: '🏥', color: '#10B981', type: 'EXPENSE', isDefault: true },
  { name: 'Giải trí', icon: '🎮', color: '#6366F1', type: 'EXPENSE', isDefault: true },
  { name: 'Khác (chi)', icon: '📦', color: '#6B7280', type: 'EXPENSE', isDefault: true },
  { name: 'Lương', icon: '💰', color: '#10B981', type: 'INCOME', isDefault: true },
  { name: 'Thưởng', icon: '🎁', color: '#F59E0B', type: 'INCOME', isDefault: true },
  { name: 'Đầu tư', icon: '📈', color: '#3B82F6', type: 'INCOME', isDefault: true },
  { name: 'Khác (thu)', icon: '💵', color: '#6B7280', type: 'INCOME', isDefault: true },
]

async function main() {
  for (const cat of categories) {
    await (prisma.category as any).upsert({
      where: { name_userId: { name: cat.name, userId: null } },
      update: {},
      create: cat,
    })
  }
  console.log('Seed completed')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
