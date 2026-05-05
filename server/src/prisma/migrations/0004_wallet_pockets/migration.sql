CREATE TABLE "WalletPocket" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '💰',
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletPocket_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WalletPocket" ADD CONSTRAINT "WalletPocket_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WalletPocket_walletId_idx" ON "WalletPocket"("walletId");

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "pocketId" TEXT;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_pocketId_fkey"
    FOREIGN KEY ("pocketId") REFERENCES "WalletPocket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
