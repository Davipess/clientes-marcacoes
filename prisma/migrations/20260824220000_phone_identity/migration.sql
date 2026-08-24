-- Phone becomes the sole client identifier; email optional again.
ALTER TABLE "clients" ALTER COLUMN "phoneEnc" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "phoneHash" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "emailEnc" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "emailHash" DROP NOT NULL;

DROP INDEX IF EXISTS "clients_businessId_emailHash_key";
CREATE UNIQUE INDEX "clients_businessId_phoneHash_key" ON "clients"("businessId", "phoneHash");
DROP INDEX IF EXISTS "clients_businessId_phoneHash_idx";
