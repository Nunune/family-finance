-- Hụi (rotating savings/credit club)
CREATE TABLE IF NOT EXISTS "Hui" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "totalRounds" INTEGER NOT NULL,
  "myRound"     INTEGER NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "frequency"   TEXT NOT NULL DEFAULT 'MONTHLY',
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "userId"      TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Hui_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HuiRound" (
  "id"          TEXT NOT NULL,
  "huiId"       TEXT NOT NULL,
  "roundNo"     INTEGER NOT NULL,
  "ownerName"   TEXT,
  "dueDate"     TIMESTAMP(3) NOT NULL,
  "isPaid"      BOOLEAN NOT NULL DEFAULT false,
  "isReceived"  BOOLEAN NOT NULL DEFAULT false,
  "paidAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuiRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Hui_userId_idx" ON "Hui"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "HuiRound_huiId_roundNo_key" ON "HuiRound"("huiId", "roundNo");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Hui_userId_fkey') THEN
    ALTER TABLE "Hui" ADD CONSTRAINT "Hui_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HuiRound_huiId_fkey') THEN
    ALTER TABLE "HuiRound" ADD CONSTRAINT "HuiRound_huiId_fkey"
      FOREIGN KEY ("huiId") REFERENCES "Hui"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
