-- Drop old global unique constraint on name
DROP INDEX IF EXISTS "Category_name_key";
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_name_key";

-- Add userId column (nullable — NULL = default/system category)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Foreign key: cascade delete user's categories when user deleted
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite unique: each user can't have duplicate category names
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_userId_key" ON "Category"("name", "userId");

-- Partial unique: default categories (userId IS NULL) still have unique names globally
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_default_key" ON "Category"("name") WHERE "userId" IS NULL;
