-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SIGNER', 'VIEWER', 'PUBLIC_VERIFIER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('UPLOAD', 'VIEW', 'SIGN', 'PERMISSION_UPDATE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "merkle_root" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merkle_blocks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "block_index" INTEGER NOT NULL,
    "block_hash" TEXT NOT NULL,
    "parent_hash" TEXT,
    "chunk_size" INTEGER NOT NULL DEFAULT 262144,
    "chunk_offset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "merkle_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "actor_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload_data" JSONB NOT NULL DEFAULT '{}',
    "previous_hash" TEXT NOT NULL,
    "current_hash" TEXT NOT NULL,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_attempts" (
    "id" TEXT NOT NULL,
    "document_id" TEXT,
    "is_authentic" BOOLEAN NOT NULL,
    "file_hash" TEXT NOT NULL,
    "merkle_root" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address_hash" TEXT,

    CONSTRAINT "verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_documents_file_hash" ON "documents"("file_hash");

-- CreateIndex
CREATE INDEX "idx_documents_merkle_root" ON "documents"("merkle_root");

-- CreateIndex
CREATE INDEX "idx_documents_org_id" ON "documents"("organization_id");

-- CreateIndex
CREATE INDEX "idx_merkle_blocks_doc_id" ON "merkle_blocks"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "merkle_blocks_document_id_block_index_key" ON "merkle_blocks"("document_id", "block_index");

-- CreateIndex
CREATE INDEX "idx_audit_actor_id" ON "audit_log_entries"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_entries_document_id_seq_key" ON "audit_log_entries"("document_id", "seq");

-- CreateIndex
CREATE INDEX "idx_verifications_file_hash" ON "verification_attempts"("file_hash");

-- CreateIndex
CREATE INDEX "idx_verifications_merkle_root" ON "verification_attempts"("merkle_root");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merkle_blocks" ADD CONSTRAINT "merkle_blocks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
