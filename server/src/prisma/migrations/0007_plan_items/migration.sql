CREATE TABLE IF NOT EXISTS "PlanItem" (
  "id"         TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "amount"     DOUBLE PRECISION NOT NULL,
  "type"       TEXT NOT NULL,
  "categoryId" TEXT,
  "note"       TEXT,
  "frequency"  TEXT NOT NULL,
  "dueDay"     INTEGER,
  "dueDate"    TIMESTAMP(3),
  "remindDays" INTEGER NOT NULL DEFAULT 3,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "userId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanCompletion" (
  "id"         TEXT NOT NULL,
  "planItemId" TEXT NOT NULL,
  "periodKey"  TEXT NOT NULL,
  "isDone"     BOOLEAN NOT NULL DEFAULT false,
  "doneAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlanItem_userId_isActive_idx" ON "PlanItem"("userId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanCompletion_planItemId_periodKey_key" ON "PlanCompletion"("planItemId", "periodKey");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PlanItem_userId_fkey') THEN
    ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PlanItem_categoryId_fkey') THEN
    ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PlanCompletion_planItemId_fkey') THEN
    ALTER TABLE "PlanCompletion" ADD CONSTRAINT "PlanCompletion_planItemId_fkey"
      FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
