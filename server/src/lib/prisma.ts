import { PrismaClient } from '@prisma/client'

// Append connection pool params if not already present.
// Prevents "too many clients" on Railway's shared Postgres (default limit = 97).
// connection_limit=5: max 5 concurrent DB connections per server instance.
// pool_timeout=20: wait up to 20s for a free connection before throwing.
function buildDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return url
  if (url.includes('connection_limit')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}connection_limit=5&pool_timeout=20`
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
})

export default prisma
