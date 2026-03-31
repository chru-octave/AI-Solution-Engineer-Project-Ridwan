-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "emailFrom" TEXT,
    "emailTo" TEXT,
    "emailSubject" TEXT,
    "emailDate" TIMESTAMP(3),
    "rawBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insured_info" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "mailingAddress" TEXT,
    "dotNumber" TEXT,
    "mcNumber" TEXT,
    "yearsInBusiness" INTEGER,
    "state" TEXT,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "insured_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_info" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "broker_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lines_of_business" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "lines_of_business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limits_requested" (
    "id" TEXT NOT NULL,
    "lineOfBusiness" TEXT,
    "limitAmount" TEXT,
    "deductible" TEXT,
    "description" TEXT,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "limits_requested_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_pricing" (
    "id" TEXT NOT NULL,
    "lineOfBusiness" TEXT,
    "targetPremium" TEXT,
    "currentPremium" TEXT,
    "description" TEXT,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "target_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exposure_info" (
    "id" TEXT NOT NULL,
    "numberOfTrucks" INTEGER,
    "numberOfDrivers" INTEGER,
    "numberOfTrailers" INTEGER,
    "radius" TEXT,
    "commodities" TEXT[],
    "annualRevenue" TEXT,
    "annualMileage" TEXT,
    "operatingStates" TEXT[],
    "vehicleTypes" TEXT[],
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "exposure_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_records" (
    "id" TEXT NOT NULL,
    "policyYear" TEXT,
    "numberOfClaims" INTEGER,
    "totalIncurred" TEXT,
    "totalPaid" TEXT,
    "description" TEXT,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "loss_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_sourceFile_key" ON "submissions"("sourceFile");

-- CreateIndex
CREATE UNIQUE INDEX "insured_info_submissionId_key" ON "insured_info"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "broker_info_submissionId_key" ON "broker_info"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "exposure_info_submissionId_key" ON "exposure_info"("submissionId");

-- AddForeignKey
ALTER TABLE "insured_info" ADD CONSTRAINT "insured_info_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_info" ADD CONSTRAINT "broker_info_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lines_of_business" ADD CONSTRAINT "lines_of_business_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limits_requested" ADD CONSTRAINT "limits_requested_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_pricing" ADD CONSTRAINT "target_pricing_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exposure_info" ADD CONSTRAINT "exposure_info_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

