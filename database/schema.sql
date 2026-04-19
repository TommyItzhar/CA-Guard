-- CA Guardian Database Schema
-- Run: psql -U postgres -f schema.sql

CREATE DATABASE ca_guardian;
\c ca_guardian;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  azure_oid     VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('super_admin', 'ca_admin', 'azure_admin', 'viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Tenants ──────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  client_id     VARCHAR(255) NOT NULL,
  client_secret TEXT NOT NULL,  -- encrypted at app layer
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_sync     TIMESTAMPTZ,
  sync_status   VARCHAR(50) DEFAULT 'pending',
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Conditional Access Policies ──────────────────────────────────────────────
CREATE TABLE ca_policies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  azure_policy_id   VARCHAR(255) NOT NULL,
  display_name      VARCHAR(500) NOT NULL,
  state             VARCHAR(50) NOT NULL,  -- enabled, disabled, enabledForReportingButNotEnforced
  is_locked         BOOLEAN NOT NULL DEFAULT true,
  policy_data       JSONB NOT NULL,        -- full Graph API representation
  last_synced       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, azure_policy_id)
);

CREATE INDEX idx_ca_policies_tenant ON ca_policies(tenant_id);
CREATE INDEX idx_ca_policies_locked ON ca_policies(is_locked);

-- ─── Policy Versions (Backup Store) ───────────────────────────────────────────
CREATE TABLE policy_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id         UUID NOT NULL REFERENCES ca_policies(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  azure_policy_id   VARCHAR(255) NOT NULL,
  display_name      VARCHAR(500) NOT NULL,
  version_number    INTEGER NOT NULL,
  policy_data       JSONB NOT NULL,
  change_type       VARCHAR(50) NOT NULL
                      CHECK (change_type IN ('initial', 'pre_change', 'post_change', 'rollback', 'sync')),
  change_summary    TEXT,
  created_by        UUID REFERENCES users(id),
  request_id        UUID,  -- FK added after change_requests table
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_versions_policy ON policy_versions(policy_id);
CREATE INDEX idx_policy_versions_tenant ON policy_versions(tenant_id);
CREATE INDEX idx_policy_versions_created ON policy_versions(created_at DESC);

-- ─── Change Requests ──────────────────────────────────────────────────────────
CREATE TABLE change_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id         UUID NOT NULL REFERENCES ca_policies(id) ON DELETE CASCADE,
  azure_policy_id   VARCHAR(255) NOT NULL,
  policy_name       VARCHAR(500) NOT NULL,
  requester_id      UUID NOT NULL REFERENCES users(id),
  requester_name    VARCHAR(255) NOT NULL,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'unlocked', 'change_detected', 'completed', 'cancelled')),
  justification     TEXT NOT NULL,
  planned_changes   TEXT,
  approver_id       UUID REFERENCES users(id),
  approver_name     VARCHAR(255),
  approval_note     TEXT,
  approved_at       TIMESTAMPTZ,
  unlocked_at       TIMESTAMPTZ,
  lock_expires_at   TIMESTAMPTZ,  -- auto re-lock after X hours
  change_detected_at TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  pre_change_version_id  UUID REFERENCES policy_versions(id),
  post_change_version_id UUID REFERENCES policy_versions(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_requests_tenant ON change_requests(tenant_id);
CREATE INDEX idx_change_requests_policy ON change_requests(policy_id);
CREATE INDEX idx_change_requests_status ON change_requests(status);
CREATE INDEX idx_change_requests_requester ON change_requests(requester_id);

-- Add FK from policy_versions to change_requests
ALTER TABLE policy_versions ADD CONSTRAINT fk_policy_versions_request
  FOREIGN KEY (request_id) REFERENCES change_requests(id);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID REFERENCES tenants(id),
  user_id       UUID REFERENCES users(id),
  user_name     VARCHAR(255),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id   VARCHAR(255),
  resource_name VARCHAR(500),
  details       JSONB,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id),
  type          VARCHAR(100) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  message       TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  reference_id  UUID,
  reference_type VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ─── Update trigger ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ca_policies_updated BEFORE UPDATE ON ca_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_change_requests_updated BEFORE UPDATE ON change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Initial seed: super admin placeholder ────────────────────────────────────
-- Replace with your actual Azure OID after first login
-- INSERT INTO users (azure_oid, display_name, email, role)
-- VALUES ('YOUR-AZURE-OID', 'Super Admin', 'admin@yourdomain.com', 'super_admin');
