import type { AgreementType, AgentContract, ContractCandidate, CreateAgentContract } from '@nestyk/types';
import { apiGet, apiPost } from './api';
import { ensureAgentSession } from './agent-session';
export async function listAgentContracts(): Promise<AgentContract[]> { await ensureAgentSession(); return apiGet('/agent/contracts'); }
export async function getAgentContract(id: number): Promise<AgentContract> { await ensureAgentSession(); return apiGet(`/agent/contracts/${id}`); }
export async function listContractCandidates(): Promise<ContractCandidate[]> { await ensureAgentSession(); return apiGet('/agent/contracts/candidates'); }
export async function createAgentContract(input: CreateAgentContract): Promise<AgentContract> { await ensureAgentSession(); return apiPost('/agent/contracts', input); }

export async function listAgreementTypes(): Promise<AgreementType[]> { await ensureAgentSession(); return apiGet('/agent/contracts/types'); }
