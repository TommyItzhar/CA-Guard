export type UserRole = 'super_admin' | 'ca_admin' | 'azure_admin' | 'viewer';

export interface User {
  id: string;
  azure_oid: string;
  display_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface Tenant {
  id: string;
  tenant_id: string;
  display_name: string;
  client_id: string;
  is_active: boolean;
  last_sync: string | null;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  created_at: string;
}

export interface CAPolicy {
  id: string;
  azure_policy_id: string;
  display_name: string;
  state: 'enabled' | 'disabled' | 'enabledForReportingButNotEnforced';
  is_locked: boolean;
  last_synced: string;
  created_at: string;
  updated_at: string;
  tenant_name: string;
  tenant_id: string;
  version_count: number;
  active_requests: number;
  policy_data: PolicyData;
}

export interface PolicyData {
  id: string;
  displayName: string;
  state: string;
  createdDateTime: string;
  modifiedDateTime: string;
  conditions: {
    users?: {
      includeUsers?: string[];
      excludeUsers?: string[];
      includeGroups?: string[];
      excludeGroups?: string[];
      includeRoles?: string[];
      excludeRoles?: string[];
    };
    applications?: {
      includeApplications?: string[];
      excludeApplications?: string[];
    };
    platforms?: {
      includePlatforms?: string[];
      excludePlatforms?: string[];
    };
    locations?: {
      includeLocations?: string[];
      excludeLocations?: string[];
    };
    signInRiskLevels?: string[];
    clientAppTypes?: string[];
  };
  grantControls: {
    operator?: string;
    builtInControls?: string[];
    customAuthenticationFactors?: string[];
    termsOfUse?: string[];
  } | null;
  sessionControls: {
    applicationEnforcedRestrictions?: { isEnabled: boolean };
    cloudAppSecurity?: { cloudAppSecurityType: string; isEnabled: boolean };
    signInFrequency?: { value: number; type: string; isEnabled: boolean };
    persistentBrowser?: { mode: string; isEnabled: boolean };
  } | null;
}

export type ChangeRequestStatus =
  | 'pending' | 'approved' | 'rejected'
  | 'unlocked' | 'change_detected' | 'completed' | 'cancelled';

export interface ChangeRequest {
  id: string;
  tenant_id: string;
  tenant_name: string;
  policy_id: string;
  azure_policy_id: string;
  policy_name: string;
  requester_id: string;
  requester_name: string;
  requester_display_name: string;
  status: ChangeRequestStatus;
  justification: string;
  planned_changes: string | null;
  approver_id: string | null;
  approver_name: string | null;
  approver_display_name: string | null;
  approval_note: string | null;
  approved_at: string | null;
  unlocked_at: string | null;
  lock_expires_at: string | null;
  change_detected_at: string | null;
  completed_at: string | null;
  pre_change_version_id: string | null;
  post_change_version_id: string | null;
  pre_version_number: number | null;
  post_version_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  change_type: 'initial' | 'pre_change' | 'post_change' | 'rollback' | 'sync';
  change_summary: string | null;
  created_at: string;
  created_by_name: string | null;
  request_id: string | null;
  policy_data?: PolicyData;
}

export interface AuditEntry {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  user_id: string | null;
  user_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}
