/*
  Warnings:

  - You are about to drop the column `currentVersionId` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `versionId` on the `merkle_blocks` table. All the data in the column will be lost.
  - You are about to drop the `DocumentVersion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_documentId_fkey";

-- DropForeignKey
ALTER TABLE "merkle_blocks" DROP CONSTRAINT "merkle_blocks_versionId_fkey";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "currentVersionId";

-- AlterTable
ALTER TABLE "merkle_blocks" DROP COLUMN "versionId";

-- DropTable
DROP TABLE "DocumentVersion";

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "root_hash" TEXT NOT NULL,
    "leaf_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_doc_versions_root" ON "document_versions"("root_hash");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_root_hash_key" ON "document_versions"("document_id", "root_hash");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
