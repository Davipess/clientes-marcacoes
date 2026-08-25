-- Retencao do historico: 1 mes (0 trace apos ~1 mes).
ALTER TABLE "business_settings" ALTER COLUMN "retentionMonths" SET DEFAULT 1;
UPDATE "business_settings" SET "retentionMonths" = 1;
