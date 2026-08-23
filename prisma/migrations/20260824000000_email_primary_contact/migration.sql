-- Email becomes the primary client contact; phone is optional.
ALTER TABLE "clients" ALTER COLUMN "emailEnc" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "emailHash" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "phoneEnc" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "phoneHash" DROP NOT NULL;

-- Identity/dedupe moves from phone hash to email hash.
DROP INDEX IF EXISTS "clients_businessId_phoneHash_key";
CREATE UNIQUE INDEX "clients_businessId_emailHash_key" ON "clients"("businessId", "emailHash");
CREATE INDEX "clients_businessId_phoneHash_idx" ON "clients"("businessId", "phoneHash");
