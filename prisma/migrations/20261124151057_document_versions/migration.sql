-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "currentVersionId" TEXT;

-- AlterTable
ALTER TABLE "merkle_blocks" ADD COLUMN     "versionId" TEXT;

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rootHash" TEXT NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_rootHash_key" ON "DocumentVersion"("documentId", "rootHash");

-- AddForeignKey
ALTER TABLE "merkle_blocks" ADD CONSTRAINT "merkle_blocks_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
