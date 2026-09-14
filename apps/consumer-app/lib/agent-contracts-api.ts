import type { AgreementType, AgentContract, AgentContractDocumentKind, ContractCandidate, CreateAgentContract, SignAgentContract } from '@nestyk/types';
import { apiGet, apiPost, apiRequest } from './api';
import { ensureAgentSession } from './agent-session';
import { Platform } from 'react-native';
export async function listAgentContracts(): Promise<AgentContract[]> { await ensureAgentSession(); return apiGet('/agent/contracts'); }
export async function getAgentContract(id: number): Promise<AgentContract> { await ensureAgentSession(); return apiGet(`/agent/contracts/${id}`); }
export async function listContractCandidates(): Promise<ContractCandidate[]> { await ensureAgentSession(); return apiGet('/agent/contracts/candidates'); }
export async function createAgentContract(input: CreateAgentContract): Promise<AgentContract> { await ensureAgentSession(); return apiPost('/agent/contracts', input); }

export async function listAgreementTypes(): Promise<AgreementType[]> { await ensureAgentSession(); return apiGet('/agent/contracts/types'); }

export async function signAgentContract(id: number, input: SignAgentContract): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/sign`, input);
}

export async function uploadAgentContractDocument(
  id: number,
  kind: AgentContractDocumentKind,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<AgentContract> {
  await ensureAgentSession();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = file.file ?? await (await fetch(file.uri)).blob();
    form.append('file', blob, file.name);
  } else {
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest<AgentContract>(`/agent/contracts/${id}/documents/${kind}`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
