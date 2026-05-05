CREATE TABLE IF NOT EXISTS "WeeklyBudget" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "categoryId"  TEXT NOT NULL,
  "limitAmount" DOUBLE PRECISION NOT NULL,
  "alertPct"    INTEGER NOT NULL DEFAULT 80,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyBudget_userId_categoryId_key"
  ON "WeeklyBudget"("userId", "categoryId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WeeklyBudget_userId_fkey'
  ) THEN
    ALTER TABLE "WeeklyBudget"
      ADD CONSTRAINT "WeeklyBudget_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'WeeklyBudget_categoryId_fkey'
  ) THEN
    ALTER TABLE "WeeklyBudget"
      ADD CONSTRAINT "WeeklyBudget_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
