-- Drop the unique index on Wallet.userId so users can have multiple wallets (multi-currency).
-- Migration 0013 tried DROP CONSTRAINT but the original was a CREATE UNIQUE INDEX,
-- so the constraint command silently did nothing. This drops the index directly.
DROP INDEX IF EXISTS "Wallet_userId_key";
