-- CreateEnum
CREATE TYPE "PitchType" AS ENUM ('IDEA', 'EXISTING');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'SCREENING', 'DUE_DILIGENCE', 'COMMITTEE', 'LISTED', 'RETURNED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PitchReviewStage" AS ENUM ('SCREENING', 'DUE_DILIGENCE', 'COMMITTEE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileKind" ADD VALUE 'PITCH_DECK';
ALTER TYPE "FileKind" ADD VALUE 'PITCH_IMAGE';
ALTER TYPE "FileKind" ADD VALUE 'PITCH_DOCUMENT';

-- CreateTable
CREATE TABLE "Pitch" (
    "id" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "status" "PitchStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "PitchType" NOT NULL DEFAULT 'IDEA',
    "savedSections" TEXT[],
    "title" TEXT NOT NULL,
    "sector" TEXT,
    "country" TEXT,
    "city" TEXT,
    "oneLiner" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "whyNow" TEXT,
    "teamExperience" TEXT,
    "teamMembers" JSONB NOT NULL DEFAULT '[]',
    "advisors" TEXT,
    "plannedHires" TEXT,
    "targetCustomers" TEXT,
    "marketSize" TEXT,
    "competitors" TEXT,
    "differentiation" TEXT,
    "revenueModel" TEXT,
    "pricing" TEXT,
    "unitEconomics" TEXT,
    "channels" TEXT,
    "partners" TEXT,
    "startedYear" INTEGER,
    "employees" INTEGER,
    "revenueLast12" DECIMAL(18,2),
    "expensesLast12" DECIMAL(18,2),
    "monthlyRevenue" DECIMAL(18,2),
    "customers" INTEGER,
    "tractionNotes" TEXT,
    "liabilities" TEXT,
    "existingInvestors" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "amount" DECIMAL(18,2),
    "minTicket" DECIMAL(18,2),
    "multipleInvestors" BOOLEAN NOT NULL DEFAULT true,
    "dealType" "DealType",
    "equityPercent" DECIMAL(5,2),
    "profitSharePercent" DECIMAL(5,2),
    "founderCapital" DECIMAL(18,2),
    "revenueSharePercent" DECIMAL(5,2),
    "returnCapMultiple" DECIMAL(4,2),
    "termMonths" INTEGER,
    "valuation" DECIMAL(18,2),
    "valuationMethod" TEXT,
    "nonFinancialAsks" TEXT,
    "expectedReturn" TEXT,
    "exitOptions" TEXT,
    "projections" JSONB NOT NULL DEFAULT '[]',
    "projectionAssumptions" TEXT,
    "risks" JSONB NOT NULL DEFAULT '[]',
    "failurePlan" TEXT,
    "videoUrl" TEXT,
    "deckFileId" TEXT,
    "imageFileIds" TEXT[],
    "documentFileIds" TEXT[],
    "teaser" TEXT,
    "screeningScore" INTEGER,
    "assignedToId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "listedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchCostItem" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL,
    "timing" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PitchCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchMilestone" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "successMetric" TEXT NOT NULL,
    "budget" DECIMAL(18,2) NOT NULL,
    "owner" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PitchMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchSubmission" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedIp" TEXT,

    CONSTRAINT "PitchSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchReview" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "stage" "PitchReviewStage" NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "scores" JSONB,
    "checklist" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchEvent" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "fromStatus" "PitchStatus",
    "toStatus" "PitchStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pitch_founderId_idx" ON "Pitch"("founderId");

-- CreateIndex
CREATE INDEX "Pitch_status_idx" ON "Pitch"("status");

-- CreateIndex
CREATE INDEX "PitchCostItem_pitchId_idx" ON "PitchCostItem"("pitchId");

-- CreateIndex
CREATE INDEX "PitchMilestone_pitchId_idx" ON "PitchMilestone"("pitchId");

-- CreateIndex
CREATE UNIQUE INDEX "PitchSubmission_pitchId_version_key" ON "PitchSubmission"("pitchId", "version");

-- CreateIndex
CREATE INDEX "PitchReview_pitchId_stage_idx" ON "PitchReview"("pitchId", "stage");

-- CreateIndex
CREATE INDEX "PitchEvent_pitchId_idx" ON "PitchEvent"("pitchId");

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pitch" ADD CONSTRAINT "Pitch_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchCostItem" ADD CONSTRAINT "PitchCostItem_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchMilestone" ADD CONSTRAINT "PitchMilestone_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSubmission" ADD CONSTRAINT "PitchSubmission_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchReview" ADD CONSTRAINT "PitchReview_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchReview" ADD CONSTRAINT "PitchReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvent" ADD CONSTRAINT "PitchEvent_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvent" ADD CONSTRAINT "PitchEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
