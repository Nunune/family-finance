const { Client } = require('pg')
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const sql = `
ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_userId_key";
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'VND';
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "ExchangeRate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromCurrency" TEXT NOT NULL,
  "toCurrency" TEXT NOT NULL,
  "rate" DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExchangeRate_userId_fromCurrency_toCurrency_key" UNIQUE ("userId", "fromCurrency", "toCurrency"),
  CONSTRAINT "ExchangeRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('Migration 0013 applied.'); client.end() })
  .catch(e => { console.error(e.message); process.exit(1) })
