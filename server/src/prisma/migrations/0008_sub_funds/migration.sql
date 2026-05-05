-- SubFund table
CREATE TABLE IF NOT EXISTS "SubFund" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "icon"        TEXT NOT NULL DEFAULT '🏦',
  "description" TEXT,
  "familyId"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubFund_pkey" PRIMARY KEY ("id")
);

-- SubFundMember table
CREATE TABLE IF NOT EXISTS "SubFundMember" (
  "id"        TEXT NOT NULL,
  "subFundId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubFundMember_pkey" PRIMARY KEY ("id")
);

-- Add subFundId to Wallet
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Wallet' AND column_name = 'subFundId'
  ) THEN
    ALTER TABLE "Wallet" ADD COLUMN "subFundId" TEXT;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "SubFund_familyId_idx" ON "SubFund"("familyId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubFundMember_subFundId_userId_key" ON "SubFundMember"("subFundId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_subFundId_key" ON "Wallet"("subFundId");

-- FK: SubFund → Family
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SubFund_familyId_fkey') THEN
    ALTER TABLE "SubFund" ADD CONSTRAINT "SubFund_familyId_fkey"
      FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK: SubFundMember → SubFund
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SubFundMember_subFundId_fkey') THEN
    ALTER TABLE "SubFundMember" ADD CONSTRAINT "SubFundMember_subFundId_fkey"
      FOREIGN KEY ("subFundId") REFERENCES "SubFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK: SubFundMember → User
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'SubFundMember_userId_fkey') THEN
    ALTER TABLE "SubFundMember" ADD CONSTRAINT "SubFundMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- FK: Wallet → SubFund
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Wallet_subFundId_fkey') THEN
    ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_subFundId_fkey"
      FOREIGN KEY ("subFundId") REFERENCES "SubFund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
