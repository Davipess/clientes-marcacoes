-- Phase 14: no-show protection & booking abuse prevention.
ALTER TABLE "clients" ADD COLUMN "noShowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "blockReason" TEXT,
ADD COLUMN "blockedAt" TIMESTAMP(3);

ALTER TABLE "business_settings" ADD COLUMN "maxActiveBookingsPerPhone" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "maxBookingsPerPhonePerDay" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "noShowFlagThreshold" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "retentionMonths" INTEGER NOT NULL DEFAULT 24;
