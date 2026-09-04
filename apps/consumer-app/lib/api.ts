import { APP_CONFIG } from './config';
import { getOrCreateDevIdentity, toDevBearer } from './dev-identity';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const identity = await getOrCreateDevIdentity();
  return { Authorization: `Bearer ${toDevBearer(identity)}` };
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const msg = (body as { message?: unknown }).message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg)) return msg.map(String).join('\n');
  return fallback;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(await authHeader()),
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${APP_CONFIG.apiUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFromBody(parsed, `HTTP ${res.status}`), res.status);
  }
  return parsed as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
