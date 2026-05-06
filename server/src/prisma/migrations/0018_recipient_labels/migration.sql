CREATE TABLE "RecipientLabel" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "icon"      TEXT NOT NULL DEFAULT '👤',
  "color"     TEXT NOT NULL DEFAULT '#6B7280',
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipientLabel_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecipientLabel" ADD CONSTRAINT "RecipientLabel_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipientLabel" ADD CONSTRAINT "RecipientLabel_name_userId_key"
  UNIQUE ("name","userId");

CREATE INDEX "RecipientLabel_userId_idx" ON "RecipientLabel"("userId");

ALTER TABLE "Transaction" ADD COLUMN "recipientLabelId" TEXT;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recipientLabelId_fkey"
  FOREIGN KEY ("recipientLabelId") REFERENCES "RecipientLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
