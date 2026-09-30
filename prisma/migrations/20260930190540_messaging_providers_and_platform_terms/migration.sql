-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('RECORDED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "FounderProfile" ADD COLUMN     "platformTermsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "platformTermsVersion" TEXT;

-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "error" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'outbox',
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'RECORDED';

-- CreateIndex
CREATE INDEX "OutboundMessage_to_createdAt_idx" ON "OutboundMessage"("to", "createdAt");
