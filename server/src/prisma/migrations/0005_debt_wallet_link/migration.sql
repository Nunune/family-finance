ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "walletTransactionId" TEXT;
ALTER TABLE "DebtPayment" ADD COLUMN IF NOT EXISTS "walletTransactionId" TEXT;
