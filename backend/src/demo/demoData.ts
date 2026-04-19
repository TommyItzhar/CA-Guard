// Demo mode seed data — realistic Conditional Access policies for UI demonstration
// No Azure subscription or App Registration required

import { v4 as uuidv4 } from 'uuid';

export const DEMO_TENANT_ID = 'demo-tenant-00000000-0000-0000-0000-000000000000';
export const DEMO_USER_ID   = 'demo-user-00000000-0000-0000-0000-000000000000';
export const DEMO_ADMIN_ID  = 'demo-admin-00000000-0000-0000-0000-000000000000';

export const demoTenant = {
  id: DEMO_TENANT_ID,
  tenant_id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Contoso Corporation (Demo)',
  client_id: '00000000-demo-0000-0000-000000000000',
  is_active: true,
  last_sync: new Date().toISOString(),
  sync_status: 'success',
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
};

export const demoUsers = [
  {
    id: DEMO_ADMIN_ID,
    azure_oid: 'demo-oid-admin',
    display_name: 'Alex Admin',
    email: 'alex.admin@contoso.demo',
    role: 'super_admin',
    is_active: true,
    last_login: new Date().toISOString(),
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: DEMO_USER_ID,
    azure_oid: 'demo-oid-user',
    display_name: 'Demo User',
    email: 'demo@contoso.demo',
    role: 'ca_admin',
    is_active: true,
    last_login: new Date().toISOString(),
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'demo-azure-admin-id',
    azure_oid: 'demo-oid-azure',
    display_name: 'Jordan Azure',
    email: 'jordan.azure@contoso.demo',
    role: 'azure_admin',
    is_active: true,
    last_login: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 'demo-viewer-id',
    azure_oid: 'demo-oid-viewer',
    display_name: 'Sam Viewer',
    email: 'sam.viewer@contoso.demo',
    role: 'viewer',
    is_active: true,
    last_login: new Date(Date.now() - 5 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const makePolicy = (id: string, name: string, state: string, locked: boolean, conditions: object, grantControls: object | null) => ({
  id,
  azure_policy_id: `azure-${id}`,
  display_name: name,
  state,
  is_locked: locked,
  last_synced: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  updated_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
  tenant_name: 'Contoso Corporation (Demo)',
  tenant_id: DEMO_TENANT_ID,
  version_count: Math.floor(Math.random() * 8) + 1,
  active_requests: 0,
  policy_data: {
    id: `azure-${id}`,
    displayName: name,
    state,
    createdDateTime: new Date(Date.now() - 90 * 86400000).toISOString(),
    modifiedDateTime: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    conditions,
    grantControls,
    sessionControls: null,
  },
});

export const demoPolicies = [
  makePolicy('policy-001', 'Require MFA for All Users', 'enabled', true,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['browser', 'mobileAppsAndDesktopClients'] },
    { operator: 'OR', builtInControls: ['mfa'] }
  ),
  makePolicy('policy-002', 'Block Legacy Authentication', 'enabled', true,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] },
    { operator: 'OR', builtInControls: ['block'] }
  ),
  makePolicy('policy-003', 'Require Compliant Device for Office 365', 'enabled', true,
    { users: { includeUsers: ['All'], excludeGroups: ['grp-breakglass-001'] }, applications: { includeApplications: ['Office365'] } },
    { operator: 'OR', builtInControls: ['compliantDevice'] }
  ),
  makePolicy('policy-004', 'High Risk Sign-in Block', 'enabled', true,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, signInRiskLevels: ['high'] },
    { operator: 'OR', builtInControls: ['block'] }
  ),
  makePolicy('policy-005', 'Require MFA for Azure Management', 'enabled', true,
    { users: { includeUsers: ['All'], excludeRoles: ['62e90394-69f5-4237-9190-012177145e10'] }, applications: { includeApplications: ['797f4846-ba00-4fd7-ba43-dac1f8f63013'] } },
    { operator: 'OR', builtInControls: ['mfa'] }
  ),
  makePolicy('policy-006', 'Guest Access — MFA Required', 'enabled', true,
    { users: { includeUsers: ['GuestsOrExternalUsers'] }, applications: { includeApplications: ['All'] } },
    { operator: 'OR', builtInControls: ['mfa'] }
  ),
  makePolicy('policy-007', 'Named Locations — Trusted Countries Only', 'enabled', false,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, locations: { includeLocations: ['All'], excludeLocations: ['trusted-locations-001'] } },
    { operator: 'OR', builtInControls: ['block'] }
  ),
  makePolicy('policy-008', 'Report-Only: Risky Users', 'enabledForReportingButNotEnforced', true,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, userRiskLevels: ['high', 'medium'] },
    { operator: 'OR', builtInControls: ['mfa', 'passwordChange'] }
  ),
  makePolicy('policy-009', 'Privileged Roles — PIM Required', 'disabled', true,
    { users: { includeRoles: ['62e90394-69f5-4237-9190-012177145e10', '194ae4cb-b126-40b2-bd5b-6091b380977d'] }, applications: { includeApplications: ['All'] } },
    { operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] }
  ),
  makePolicy('policy-010', 'iOS and Android — App Protection Policy', 'enabled', true,
    { users: { includeUsers: ['All'] }, applications: { includeApplications: ['Office365'] }, platforms: { includePlatforms: ['iOS', 'android'] } },
    { operator: 'OR', builtInControls: ['approvedApplication', 'compliantApplication'] }
  ),
];

export const demoVersions: Record<string, any[]> = {};
demoPolicies.forEach(p => {
  const count = p.version_count;
  demoVersions[p.id] = Array.from({ length: count }, (_, i) => ({
    id: `ver-${p.id}-${i}`,
    policy_id: p.id,
    version_number: i + 1,
    change_type: i === 0 ? 'initial' : i === count - 1 ? 'post_change' : i % 3 === 0 ? 'rollback' : 'sync',
    change_summary: i === 0 ? 'Initial import from Azure' : i === count - 1 ? 'Post-change backup after approved request' : 'Sync from Azure',
    created_at: new Date(Date.now() - (count - i) * 5 * 86400000).toISOString(),
    created_by_name: i % 2 === 0 ? 'Alex Admin' : 'System',
    request_id: null,
    policy_data: p.policy_data,
  }));
});

export const demoChangeRequests = [
  {
    id: 'req-001',
    tenant_id: DEMO_TENANT_ID,
    tenant_name: 'Contoso Corporation (Demo)',
    policy_id: 'policy-007',
    azure_policy_id: 'azure-policy-007',
    policy_name: 'Named Locations — Trusted Countries Only',
    requester_id: 'demo-azure-admin-id',
    requester_name: 'Jordan Azure',
    requester_display_name: 'Jordan Azure',
    status: 'pending',
    justification: 'Need to add the new Tel Aviv office IP range (185.220.x.x/24) to the trusted locations list so our team can access Azure without triggering the block policy.',
    planned_changes: 'Add new named location for Tel Aviv office. Update policy to exclude new location from block rule.',
    approver_id: null,
    approver_name: null,
    approver_display_name: null,
    approval_note: null,
    approved_at: null,
    unlocked_at: null,
    lock_expires_at: null,
    change_detected_at: null,
    completed_at: null,
    pre_change_version_id: null,
    post_change_version_id: null,
    pre_version_number: null,
    post_version_number: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'req-002',
    tenant_id: DEMO_TENANT_ID,
    tenant_name: 'Contoso Corporation (Demo)',
    policy_id: 'policy-003',
    azure_policy_id: 'azure-policy-003',
    policy_name: 'Require Compliant Device for Office 365',
    requester_id: 'demo-azure-admin-id',
    requester_display_name: 'Jordan Azure',
    requester_name: 'Jordan Azure',
    status: 'completed',
    justification: 'Exclude the contractors group from compliant device requirement — they use personal devices.',
    planned_changes: 'Add contractors-external group (grp-contractors-ext) to the exclude list.',
    approver_id: DEMO_ADMIN_ID,
    approver_name: 'Alex Admin',
    approver_display_name: 'Alex Admin',
    approval_note: 'Approved — contractors group confirmed with HR. Please re-enable after Q1.',
    approved_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    unlocked_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    lock_expires_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    change_detected_at: new Date(Date.now() - 4 * 86400000 - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    pre_change_version_id: 'ver-policy-003-2',
    post_change_version_id: 'ver-policy-003-3',
    pre_version_number: 2,
    post_version_number: 3,
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'req-003',
    tenant_id: DEMO_TENANT_ID,
    tenant_name: 'Contoso Corporation (Demo)',
    policy_id: 'policy-009',
    azure_policy_id: 'azure-policy-009',
    policy_name: 'Privileged Roles — PIM Required',
    requester_id: 'demo-azure-admin-id',
    requester_display_name: 'Jordan Azure',
    requester_name: 'Jordan Azure',
    status: 'rejected',
    justification: 'Temporarily disable PIM requirement for Global Admin role during migration window.',
    planned_changes: 'Remove Global Admin role from policy conditions.',
    approver_id: DEMO_ADMIN_ID,
    approver_name: 'Alex Admin',
    approver_display_name: 'Alex Admin',
    approval_note: 'Rejected — disabling PIM for Global Admin violates our security baseline. Please use the emergency access account process instead.',
    approved_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    unlocked_at: null,
    lock_expires_at: null,
    change_detected_at: null,
    completed_at: null,
    pre_change_version_id: null,
    post_change_version_id: null,
    pre_version_number: null,
    post_version_number: null,
    created_at: new Date(Date.now() - 11 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

export const demoAuditLog = [
  { id: 'aud-001', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'System', action: 'tenant.synced', resource_type: 'tenant', resource_name: 'Contoso Corporation (Demo)', details: { created: 0, updated: 10, total: 10 }, ip_address: null, created_at: new Date(Date.now() - 1 * 3600000).toISOString() },
  { id: 'aud-002', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'Jordan Azure', action: 'change_request.created', resource_type: 'change_request', resource_name: 'Named Locations — Trusted Countries Only', details: { justification: 'Add Tel Aviv office IP range' }, ip_address: '185.220.10.1', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'aud-003', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'Alex Admin', action: 'change_request.rejected', resource_type: 'change_request', resource_name: 'Privileged Roles — PIM Required', details: { note: 'Violates security baseline' }, ip_address: '20.10.5.1', created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 'aud-004', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'Alex Admin', action: 'change_request.approved', resource_type: 'change_request', resource_name: 'Require Compliant Device for Office 365', details: { note: 'Approved for contractors' }, ip_address: '20.10.5.1', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'aud-005', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'System', action: 'policy.change_detected', resource_type: 'ca_policy', resource_name: 'Require Compliant Device for Office 365', details: {}, ip_address: null, created_at: new Date(Date.now() - 4 * 86400000 - 3600000).toISOString() },
  { id: 'aud-006', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'Alex Admin', action: 'change_request.completed', resource_type: 'change_request', resource_name: 'Require Compliant Device for Office 365', details: {}, ip_address: '20.10.5.1', created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: 'aud-007', tenant_id: DEMO_TENANT_ID, tenant_name: 'Contoso Corporation (Demo)', user_name: 'Demo User', action: 'user.login', resource_type: null, resource_name: null, details: { email: 'demo@contoso.demo' }, ip_address: '82.80.10.5', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
];
