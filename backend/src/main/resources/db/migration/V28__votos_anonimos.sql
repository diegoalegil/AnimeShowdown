ALTER TABLE votos ADD COLUMN peso NUMERIC(4,2) NOT NULL DEFAULT 1.00;
ALTER TABLE votos ADD COLUMN anon_session_id VARCHAR(64);
ALTER TABLE votos ADD COLUMN anon_ip_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_votos_anon_session ON votos (anon_session_id);
CREATE INDEX IF NOT EXISTS idx_votos_anon_ip_hash ON votos (anon_ip_hash);
