CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log_entries is append-only'; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

ALTER TABLE documents ADD CONSTRAINT chk_file_hash   CHECK (file_hash   ~ '^[0-9a-f]{64}$');
ALTER TABLE documents ADD CONSTRAINT chk_merkle_root CHECK (merkle_root ~ '^[0-9a-f]{64}$');