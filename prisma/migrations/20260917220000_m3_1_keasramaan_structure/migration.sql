-- CreateTable
CREATE TABLE "santri_kamar_placements" (
    "id" TEXT NOT NULL,
    "santri_id" TEXT NOT NULL,
    "kamar_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "santri_kamar_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "santri_kamar_placements_santri_id_is_active_idx" ON "santri_kamar_placements"("santri_id", "is_active");

-- CreateIndex
CREATE INDEX "santri_kamar_placements_kamar_id_is_active_idx" ON "santri_kamar_placements"("kamar_id", "is_active");

-- CreateIndex (Enforce at most one active kamar placement per santri)
CREATE UNIQUE INDEX "unique_active_santri_kamar" ON "santri_kamar_placements"("santri_id") WHERE ("is_active" = true);

-- AddForeignKey
ALTER TABLE "santri_kamar_placements" ADD CONSTRAINT "santri_kamar_placements_santri_id_fkey" FOREIGN KEY ("santri_id") REFERENCES "santri"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "santri_kamar_placements" ADD CONSTRAINT "santri_kamar_placements_kamar_id_fkey" FOREIGN KEY ("kamar_id") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
