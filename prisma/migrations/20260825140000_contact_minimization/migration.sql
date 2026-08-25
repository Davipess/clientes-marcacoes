-- Minimizacao de dados: contacto apagado apos a visita (phoneEnc passa a opcional).
ALTER TABLE "clients" ALTER COLUMN "phoneEnc" DROP NOT NULL;
ALTER TABLE "business_settings" ADD COLUMN "contactRetentionDays" INTEGER NOT NULL DEFAULT 7;
