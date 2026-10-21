-- ==============================================================================
-- Vault Cryptographic Document Attestation Platform - Initial Database Migration
-- Target: PostgreSQL 14+ (Neon.tech / Supabase / Self-hosted)
-- 3NF Normalized relational schema with B-Tree indexes & JSONB support
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'SIGNER', 'VIEWER', 'PUBLIC_VERIFIER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action_type AS ENUM ('UPLOAD', 'VIEW', 'SIGN', 'PERMISSION_UPDATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Users Table (with RBAC roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'VIEWER' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Refresh Tokens Table (Secure Auth Lifecycle)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- 5. Documents Table (Attested records with SHA-256 and Merkle Root)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 (64 hex characters)
    merkle_root VARCHAR(64) NOT NULL, -- Merkle Root Hash (64 hex characters)
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(128) DEFAULT 'application/octet-stream' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Performance B-Tree Indexes for Verification & Fast Lookup
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_merkle_root ON documents(merkle_root);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON documents(organization_id);

-- 6. Merkle Blocks Table (256 KB fixed chunk hashes forming binary tree leaves)
CREATE TABLE IF NOT EXISTS merkle_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    block_index INTEGER NOT NULL,
    block_hash VARCHAR(64) NOT NULL,
    parent_hash VARCHAR(64),
    chunk_size INTEGER DEFAULT 262144 NOT NULL,
    chunk_offset INTEGER DEFAULT 0 NOT NULL,
    CONSTRAINT uq_doc_block_idx UNIQUE (document_id, block_index)
);
CREATE INDEX IF NOT EXISTS idx_merkle_blocks_doc_id ON merkle_blocks(document_id);

-- 7. Audit Log Entries Table (Cryptographic Hash-Chain)
-- Current Hash = SHA-256(Payload_JSON + ":" + Action_Type + ":" + Timestamp + ":" + Previous_Hash)
CREATE TABLE IF NOT EXISTS audit_log_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    action_type audit_action_type NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    payload_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_doc_timestamp ON audit_log_entries(document_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_log_entries(actor_id);

-- 8. Verification Attempts Table (Public & Internal Verification Tracking)
CREATE TABLE IF NOT EXISTS verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_authentic BOOLEAN NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address_hash VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_verifications_file_hash ON verification_attempts(file_hash);
CREATE INDEX IF NOT EXISTS idx_verifications_merkle_root ON verification_attempts(merkle_root);
CREATE INDEX IF NOT EXISTS idx_verifications_verified_at ON verification_attempts(verified_at DESC);
