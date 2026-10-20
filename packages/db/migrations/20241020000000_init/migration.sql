-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INSPECTOR', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CropType" AS ENUM ('DURIAN', 'MANGO', 'DRAGON_FRUIT', 'OTHER');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'REOPENED');

-- CreateEnum
CREATE TYPE "FruitStage" AS ENUM ('FLOWERING', 'FRUIT_SET', 'DEVELOPING', 'MATURE', 'HARVEST_READY');

-- CreateEnum
CREATE TYPE "ObservationKind" AS ENUM ('PEST', 'DISEASE', 'DAMAGE', 'YIELD');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "app_version" VARCHAR(50),
    "ota_update_id" VARCHAR(100),
    "last_pulled_seq" BIGINT,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "centroid" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "crop" "CropType" NOT NULL,
    "variety" VARCHAR(255),
    "polygon" JSONB NOT NULL,
    "area_ha" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "inspector_id" UUID NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "fruit_stage" "FruitStage",
    "overall_score" INTEGER,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "field_clocks" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "kind" "ObservationKind" NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "severity" INTEGER,
    "count" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracy_m" DOUBLE PRECISION,
    "note" TEXT,
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_clocks" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "observation_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "mime" VARCHAR(50) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storage_key" VARCHAR(255),
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "uploaded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "seq" BIGSERIAL NOT NULL,
    "org_id" UUID NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "op" VARCHAR(20) NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "mutation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("mutation_id")
);

-- CreateTable
CREATE TABLE "conflict_records" (
    "id" UUID NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "field" VARCHAR(100) NOT NULL,
    "winning_value" JSONB NOT NULL,
    "losing_value" JSONB NOT NULL,
    "winning_hlc" VARCHAR(50) NOT NULL,
    "losing_hlc" VARCHAR(50) NOT NULL,
    "losing_device_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "farms_org_id_idx" ON "farms"("org_id");

-- CreateIndex
CREATE INDEX "blocks_farm_id_idx" ON "blocks"("farm_id");

-- CreateIndex
CREATE INDEX "inspections_org_id_idx" ON "inspections"("org_id");

-- CreateIndex
CREATE INDEX "inspections_block_id_idx" ON "inspections"("block_id");

-- CreateIndex
CREATE INDEX "inspections_inspector_id_idx" ON "inspections"("inspector_id");

-- CreateIndex
CREATE INDEX "inspections_status_idx" ON "inspections"("status");

-- CreateIndex
CREATE INDEX "inspections_deleted_at_idx" ON "inspections"("deleted_at");

-- CreateIndex
CREATE INDEX "observations_inspection_id_idx" ON "observations"("inspection_id");

-- CreateIndex
CREATE INDEX "observations_deleted_at_idx" ON "observations"("deleted_at");

-- CreateIndex
CREATE INDEX "photos_observation_id_idx" ON "photos"("observation_id");

-- CreateIndex
CREATE UNIQUE INDEX "photos_sha256_key" ON "photos"("sha256");

-- CreateIndex
CREATE INDEX "change_log_org_id_seq_idx" ON "change_log"("org_id", "seq");

-- CreateIndex
CREATE INDEX "idempotency_records_user_id_idx" ON "idempotency_records"("user_id");

-- CreateIndex
CREATE INDEX "idempotency_records_created_at_idx" ON "idempotency_records"("created_at");

-- CreateIndex
CREATE INDEX "conflict_records_entity_entity_id_idx" ON "conflict_records"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "conflict_records_created_at_idx" ON "conflict_records"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
