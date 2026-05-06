// Chạy sau khi db:push đã thêm cột myRounds: npm run db:migrate-hui
// Script này chuyển myRound → myRounds cho tất cả bản ghi cũ

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const affected = await prisma.$executeRaw`
    UPDATE "Hui"
    SET "myRounds" = '[' || CAST("myRound" AS TEXT) || ']'
    WHERE "myRounds" = '[]' AND "myRound" IS NOT NULL
  `
  console.log(`✓ Migrated ${affected} hui records: myRound → myRounds`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
