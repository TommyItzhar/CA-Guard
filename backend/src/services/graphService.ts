import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { logger } from '../utils/logger';

interface TenantCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: string;
  conditions: Record<string, unknown>;
  grantControls: Record<string, unknown> | null;
  sessionControls: Record<string, unknown> | null;
  createdDateTime: string;
  modifiedDateTime: string;
}

function getClientApp(creds: TenantCredentials): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      authority: `https://login.microsoftonline.com/${creds.tenantId}`,
    },
  });
}

async function getAccessToken(creds: TenantCredentials): Promise<string> {
  const app = getClientApp(creds);
  const result = await app.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) {
    throw new Error('Failed to acquire access token from Azure');
  }
  return result.accessToken;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function fetchAllCAPolicies(
  creds: TenantCredentials
): Promise<ConditionalAccessPolicy[]> {
  try {
    const token = await getAccessToken(creds);
    const client = getGraphClient(token);
    const response = await client
      .api('/identity/conditionalAccess/policies')
      .select(['id', 'displayName', 'state', 'conditions', 'grantControls', 'sessionControls', 'createdDateTime', 'modifiedDateTime'])
      .get();

    return response.value as ConditionalAccessPolicy[];
  } catch (err) {
    logger.error('Failed to fetch CA policies from Graph API', err);
    throw err;
  }
}

export async function fetchSingleCAPolicy(
  creds: TenantCredentials,
  policyId: string
): Promise<ConditionalAccessPolicy> {
  const token = await getAccessToken(creds);
  const client = getGraphClient(token);
  return client.api(`/identity/conditionalAccess/policies/${policyId}`).get();
}

export async function updateCAPolicy(
  creds: TenantCredentials,
  policyId: string,
  policyData: Partial<ConditionalAccessPolicy>
): Promise<void> {
  const token = await getAccessToken(creds);
  const client = getGraphClient(token);
  // Remove read-only fields before patching
  const { id, createdDateTime, modifiedDateTime, ...patchData } = policyData as ConditionalAccessPolicy;
  void id; void createdDateTime; void modifiedDateTime;
  await client
    .api(`/identity/conditionalAccess/policies/${policyId}`)
    .patch(patchData);
  logger.info(`Updated CA policy ${policyId} in Azure`);
}

export async function rollbackCAPolicy(
  creds: TenantCredentials,
  policyId: string,
  versionData: ConditionalAccessPolicy
): Promise<void> {
  await updateCAPolicy(creds, policyId, versionData);
  logger.info(`Rolled back CA policy ${policyId}`);
}

export async function verifyTenantCredentials(
  creds: TenantCredentials
): Promise<{ valid: boolean; tenantName?: string; error?: string }> {
  try {
    const token = await getAccessToken(creds);
    const client = getGraphClient(token);
    const org = await client.api('/organization').select(['displayName']).get();
    return {
      valid: true,
      tenantName: org.value?.[0]?.displayName ?? creds.tenantId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}

export async function fetchAuditLogs(
  creds: TenantCredentials,
  filter?: string
): Promise<unknown[]> {
  const token = await getAccessToken(creds);
  const client = getGraphClient(token);
  let api = client
    .api('/auditLogs/directoryAudits')
    .filter(`category eq 'Policy'`)
    .top(100);
  if (filter) api = api.filter(filter);
  const response = await api.get();
  return response.value;
}
