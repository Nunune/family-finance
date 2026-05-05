-- Add transferGroupId to Transaction (links two sides of a transfer)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Transaction' AND column_name = 'transferGroupId'
  ) THEN
    ALTER TABLE "Transaction" ADD COLUMN "transferGroupId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");
