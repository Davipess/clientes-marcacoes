-- AlterTable: password reset + optional TOTP fields on users
ALTER TABLE "users" ADD COLUMN "passwordResetTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "twoFactorSecretEnc" TEXT;

-- CreateTable columns for encrypted client PII
ALTER TABLE "clients" ADD COLUMN "phoneEnc" TEXT NOT NULL,
ADD COLUMN "emailEnc" TEXT,
ADD COLUMN "phoneHash" TEXT NOT NULL,
ADD COLUMN "emailHash" TEXT;

-- Drop plaintext PII and the old uniqueness on phone
DROP INDEX IF EXISTS "clients_businessId_phone_key";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "phone",
DROP COLUMN IF EXISTS "email";

-- Uniqueness moves to the deterministic hash (per business)
CREATE UNIQUE INDEX "clients_businessId_phoneHash_key" ON "clients"("businessId", "phoneHash");
