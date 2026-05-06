const { Client } = require('pg')
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const sql = `
CREATE TABLE IF NOT EXISTS "PocketEntry" (
  "id" TEXT NOT NULL,
  "pocketId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'DEPOSIT',
  "note" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PocketEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PocketEntry_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "WalletPocket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PocketEntry_pocketId_date_idx" ON "PocketEntry"("pocketId", "date");
`

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('Migration 0014 applied.'); client.end() })
  .catch(e => { console.error(e.message); process.exit(1) })
