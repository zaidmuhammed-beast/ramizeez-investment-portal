-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ViewLevel" AS ENUM ('TEASER', 'SUMMARY', 'FULL', 'FILE');

-- AlterTable
ALTER TABLE "Pitch" ADD COLUMN     "confidentialFields" TEXT[];

-- CreateTable
CREATE TABLE "NdaSignature" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "typedName" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "NdaSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "intendedAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "message" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAs" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchViewLog" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "level" "ViewLevel" NOT NULL,
    "fileId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "investorId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("investorId","pitchId")
);

-- CreateIndex
CREATE INDEX "NdaSignature_investorId_signedAt_idx" ON "NdaSignature"("investorId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NdaSignature_pitchId_investorId_key" ON "NdaSignature"("pitchId", "investorId");

-- CreateIndex
CREATE INDEX "AccessRequest_investorId_createdAt_idx" ON "AccessRequest"("investorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_pitchId_investorId_key" ON "AccessRequest"("pitchId", "investorId");

-- CreateIndex
CREATE INDEX "PitchViewLog_pitchId_level_idx" ON "PitchViewLog"("pitchId", "level");

-- CreateIndex
CREATE INDEX "PitchViewLog_investorId_createdAt_idx" ON "PitchViewLog"("investorId", "createdAt");

-- AddForeignKey
ALTER TABLE "NdaSignature" ADD CONSTRAINT "NdaSignature_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdaSignature" ADD CONSTRAINT "NdaSignature_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchViewLog" ADD CONSTRAINT "PitchViewLog_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchViewLog" ADD CONSTRAINT "PitchViewLog_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
