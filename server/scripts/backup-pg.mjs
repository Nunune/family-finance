/**
 * Backup PostgreSQL database to a .sql file.
 * Requires pg_dump (PostgreSQL client tools) installed locally.
 *
 * Usage:
 *   railway run node scripts/backup-pg.mjs
 *   -- or for local dev with DATABASE_PUBLIC_URL set:
 *   DATABASE_PUBLIC_URL="postgres://..." node scripts/backup-pg.mjs
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '../backups')

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!url) {
  console.error('ERROR: DATABASE_PUBLIC_URL or DATABASE_URL not set')
  process.exit(1)
}

fs.mkdirSync(DIR, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dest = path.join(DIR, `backup-${ts}.sql`)

console.log(`Backing up database to ${dest} ...`)
try {
  execSync(`pg_dump "${url}" -f "${dest}" --no-owner --no-acl`, { stdio: 'inherit' })
  const size = (fs.statSync(dest).size / 1024).toFixed(1)
  console.log(`Done! File size: ${size} KB`)
} catch {
  console.error('pg_dump failed — make sure PostgreSQL client tools are installed.')
  console.error('Install: https://www.postgresql.org/download/')
  process.exit(1)
}

// Keep 10 most recent backups
const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.sql'))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

files.slice(10).forEach(({ name }) => {
  fs.unlinkSync(path.join(DIR, name))
  console.log(`Removed old backup: ${name}`)
})
