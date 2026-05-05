const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const migrationFile = process.argv[2]
if (!migrationFile) { console.error('Usage: node run-migration.js <sql-file>'); process.exit(1) }

const sql = fs.readFileSync(path.resolve(migrationFile), 'utf8').trim()

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected. Running:', migrationFile)
  await client.query(sql)
  console.log('Done.')
  await client.end()
}
run().catch(e => { console.error(e.message); process.exit(1) })
