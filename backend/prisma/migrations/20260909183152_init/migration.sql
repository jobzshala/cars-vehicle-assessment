-- CreateTable
CREATE TABLE "Make" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Make_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeVehicleType" (
    "makeId" INTEGER NOT NULL,
    "vehicleTypeId" INTEGER NOT NULL,

    CONSTRAINT "MakeVehicleType_pkey" PRIMARY KEY ("makeId","vehicleTypeId")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "makesProcessed" INTEGER NOT NULL DEFAULT 0,
    "makesFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Make_name_idx" ON "Make"("name");

-- CreateIndex
CREATE INDEX "MakeVehicleType_vehicleTypeId_idx" ON "MakeVehicleType"("vehicleTypeId");

-- CreateIndex
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");

-- AddForeignKey
ALTER TABLE "MakeVehicleType" ADD CONSTRAINT "MakeVehicleType_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "Make"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MakeVehicleType" ADD CONSTRAINT "MakeVehicleType_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
