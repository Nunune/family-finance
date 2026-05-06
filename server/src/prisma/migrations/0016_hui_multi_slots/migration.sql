-- Hụi: support multiple collection slots (myRound → myRounds JSON array)
ALTER TABLE "Hui" ADD COLUMN IF NOT EXISTS "myRounds" TEXT NOT NULL DEFAULT '[]';

-- Migrate existing data: myRound N → myRounds [N]
UPDATE "Hui" SET "myRounds" = '[' || CAST("myRound" AS TEXT) || ']' WHERE "myRounds" = '[]';

-- myRound is now unused; make nullable (safe) then drop
ALTER TABLE "Hui" ALTER COLUMN "myRound" DROP NOT NULL;
ALTER TABLE "Hui" DROP COLUMN "myRound";
