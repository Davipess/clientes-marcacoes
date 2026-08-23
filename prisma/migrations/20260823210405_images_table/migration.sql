-- DropIndex
DROP INDEX "clients_businessId_phoneHash_idx";

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);
