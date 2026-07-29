-- CreateEnum
CREATE TYPE "PhotoSubmissionStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateTable
CREATE TABLE "daily_mission_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_mission_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_photo_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" "PhotoSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "contest_photo_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_mission_claims_userId_missionKey_day_key" ON "daily_mission_claims"("userId", "missionKey", "day");

-- AddForeignKey
ALTER TABLE "daily_mission_claims" ADD CONSTRAINT "daily_mission_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_photo_submissions" ADD CONSTRAINT "contest_photo_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_photo_submissions" ADD CONSTRAINT "contest_photo_submissions_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
