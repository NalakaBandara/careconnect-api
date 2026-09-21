-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "bookingReference" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_bookingReference_key" ON "Appointment"("bookingReference");
