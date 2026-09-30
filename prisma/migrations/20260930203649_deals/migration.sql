-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'OPEN', 'ANSWERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('AWAITING_FOUNDER', 'AWAITING_INVESTOR', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OfferParty" AS ENUM ('INVESTOR', 'FOUNDER');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'COMMITTED', 'FUNDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('TERM_SHEET', 'AGREEMENT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('SIGNING', 'SIGNED', 'VOID');

-- CreateEnum
CREATE TYPE "SignatoryParty" AS ENUM ('INVESTOR', 'FOUNDER', 'RAMIZEEZ');

-- CreateEnum
CREATE TYPE "EscrowEntryType" AS ENUM ('DEPOSIT', 'FEE', 'RELEASE', 'REFUND');

-- CreateEnum
CREATE TYPE "EscrowEntryStatus" AS ENUM ('PENDING', 'POSTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'MILESTONE_EVIDENCE';

-- CreateTable
CREATE TABLE "PitchQuestion" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "conditions" TEXT,
    "lastBy" "OfferParty" NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferRevision" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "by" "OfferParty" NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "terms" JSONB NOT NULL,
    "conditions" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "target" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "closedEarly" BOOLEAN NOT NULL DEFAULT false,
    "fundedTotal" DECIMAL(18,2),
    "fundedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealDocument" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'SIGNING',
    "issuedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "party" "SignatoryParty" NOT NULL,
    "userId" TEXT NOT NULL,
    "typedName" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEntry" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "offerId" TEXT,
    "milestoneId" TEXT,
    "type" "EscrowEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "status" "EscrowEntryStatus" NOT NULL DEFAULT 'PENDING',
    "recordedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneClaim" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "fileIds" TEXT[],
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PitchQuestion_pitchId_status_idx" ON "PitchQuestion"("pitchId", "status");

-- CreateIndex
CREATE INDEX "Offer_pitchId_status_idx" ON "Offer"("pitchId", "status");

-- CreateIndex
CREATE INDEX "Offer_investorId_idx" ON "Offer"("investorId");

-- CreateIndex
CREATE INDEX "OfferRevision_offerId_idx" ON "OfferRevision"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_pitchId_key" ON "Deal"("pitchId");

-- CreateIndex
CREATE INDEX "DealDocument_offerId_kind_idx" ON "DealDocument"("offerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSignature_documentId_party_key" ON "DocumentSignature"("documentId", "party");

-- CreateIndex
CREATE INDEX "EscrowEntry_dealId_status_idx" ON "EscrowEntry"("dealId", "status");

-- CreateIndex
CREATE INDEX "MilestoneClaim_dealId_milestoneId_idx" ON "MilestoneClaim"("dealId", "milestoneId");

-- AddForeignKey
ALTER TABLE "PitchQuestion" ADD CONSTRAINT "PitchQuestion_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchQuestion" ADD CONSTRAINT "PitchQuestion_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchQuestion" ADD CONSTRAINT "PitchQuestion_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DealDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PitchMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEntry" ADD CONSTRAINT "EscrowEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "PitchMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneClaim" ADD CONSTRAINT "MilestoneClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
