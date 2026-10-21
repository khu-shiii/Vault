ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_log_entries ALTER COLUMN seq DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_doc_seq ON audit_log_entries(document_id, seq);

ALTER TABLE documents      ALTER COLUMN file_size    TYPE BIGINT;
ALTER TABLE merkle_blocks  ALTER COLUMN chunk_offset TYPE BIGINT;
DROP INDEX IF EXISTS idx_merkle_blocks_doc_id;

ALTER TABLE documents ADD CONSTRAINT chk_file_hash   CHECK (file_hash   ~ '^[0-9a-f]{64}$');
ALTER TABLE documents ADD CONSTRAINT chk_merkle_root CHECK (merkle_root ~ '^[0-9a-f]{64}$');

ALTER TABLE audit_log_entries DROP CONSTRAINT IF EXISTS audit_log_entries_document_id_fkey;
ALTER TABLE audit_log_entries ADD CONSTRAINT audit_log_entries_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT;
ALTER TABLE audit_log_entries DROP CONSTRAINT IF EXISTS audit_log_entries_actor_id_fkey;
ALTER TABLE audit_log_entries ADD CONSTRAINT audit_log_entries_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_entries is append-only';
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log_entries;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();