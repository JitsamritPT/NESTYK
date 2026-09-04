import { apiPost } from './api';

export type AuthSyncResponse = {
  id: number;
  email: string;
  roles: string[];
};

let ensurePromise: Promise<AuthSyncResponse> | null = null;

async function syncAndGrantAgent(): Promise<AuthSyncResponse> {
  const synced = await apiPost<AuthSyncResponse>('/auth/sync', {});
  if (synced.roles?.includes('agent')) {
    return synced;
  }
  return apiPost<AuthSyncResponse>('/auth/dev/roles', { role: 'agent' });
}

/** Provision a local-dev user and grant the agent role (idempotent). */
export function ensureAgentSession(): Promise<AuthSyncResponse> {
  if (!ensurePromise) {
    ensurePromise = syncAndGrantAgent().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}
