import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '../src/prisma/dev.db')
const DIR = path.join(__dirname, '../src/prisma/backups')

if (!fs.existsSync(DB)) {
  console.error('dev.db not found at', DB)
  process.exit(1)
}

fs.mkdirSync(DIR, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dest = path.join(DIR, `dev-${ts}.db`)
fs.copyFileSync(DB, dest)
console.log(`Backup saved: src/prisma/backups/dev-${ts}.db`)

// Keep only the 10 most recent backups
const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.db'))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(DIR, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)

files.slice(10).forEach(f => {
  fs.unlinkSync(path.join(DIR, f.name))
  console.log(`Removed old backup: ${f.name}`)
})
