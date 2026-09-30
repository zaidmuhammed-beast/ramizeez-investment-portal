-- CreateEnum
CREATE TYPE "TankStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TankPitchStatus" AS ENUM ('INVITED', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealHealth" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "TaskArea" AS ENUM ('EXECUTION', 'MARKETING', 'LEGAL', 'FINANCE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PLANNED', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'RETURNED', 'PUBLISHED');

-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'INVESTOR_REPORT';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "health" "DealHealth" NOT NULL DEFAULT 'GREEN',
ADD COLUMN     "healthNote" TEXT,
ADD COLUMN     "healthUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "TankSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TankStatus" NOT NULL DEFAULT 'SCHEDULED',
    "videoProvider" TEXT NOT NULL,
    "roomName" TEXT,
    "joinUrlEnc" TEXT,
    "recordingUrlEnc" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TankSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TankPitch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "TankPitchStatus" NOT NULL DEFAULT 'INVITED',
    "grantAccess" BOOLEAN NOT NULL DEFAULT true,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TankPitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TankSeat" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'REQUESTED',
    "typedName" TEXT NOT NULL,
    "ndaHash" TEXT NOT NULL,
    "ip" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "joinCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TankSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TankInterest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TankInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealTask" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "area" "TaskArea" NOT NULL DEFAULT 'EXECUTION',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "forFounder" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "founderNote" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "budget" DECIMAL(18,2),
    "currency" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANNED',
    "reach" INTEGER,
    "leads" INTEGER,
    "conversions" INTEGER,
    "resultsNote" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorReport" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "revenue" DECIMAL(18,2) NOT NULL,
    "costs" DECIMAL(18,2) NOT NULL,
    "cashInBank" DECIMAL(18,2),
    "customers" INTEGER,
    "keyMetric" TEXT,
    "highlights" TEXT NOT NULL,
    "challenges" TEXT NOT NULL,
    "asks" TEXT,
    "fileIds" TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerId" TEXT,
    "commentary" TEXT,
    "returnNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TankSession_startsAt_idx" ON "TankSession"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "TankPitch_sessionId_pitchId_key" ON "TankPitch"("sessionId", "pitchId");

-- CreateIndex
CREATE UNIQUE INDEX "TankSeat_sessionId_userId_key" ON "TankSeat"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TankInterest_sessionId_pitchId_investorId_key" ON "TankInterest"("sessionId", "pitchId", "investorId");

-- CreateIndex
CREATE INDEX "DealTask_dealId_status_idx" ON "DealTask"("dealId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorReport_dealId_period_key" ON "InvestorReport"("dealId", "period");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankSession" ADD CONSTRAINT "TankSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankPitch" ADD CONSTRAINT "TankPitch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TankSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankPitch" ADD CONSTRAINT "TankPitch_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankSeat" ADD CONSTRAINT "TankSeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TankSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankSeat" ADD CONSTRAINT "TankSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankSeat" ADD CONSTRAINT "TankSeat_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankInterest" ADD CONSTRAINT "TankInterest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TankSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankInterest" ADD CONSTRAINT "TankInterest_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankInterest" ADD CONSTRAINT "TankInterest_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTask" ADD CONSTRAINT "DealTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTask" ADD CONSTRAINT "DealTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealTask" ADD CONSTRAINT "DealTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorReport" ADD CONSTRAINT "InvestorReport_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorReport" ADD CONSTRAINT "InvestorReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
