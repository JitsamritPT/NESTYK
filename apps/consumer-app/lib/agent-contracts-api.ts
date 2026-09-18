import type {
  AgreementType,
  AgentContract,
  AgentContractDocumentKind,
  ContractCandidate,
  CreateAgentContract,
  SignAgentContract,
} from "@nestyk/types";
import { apiGet, apiPost, apiRequest } from "./api";
import { ensureAgentSession } from "./agent-session";
import { Platform } from "react-native";
export async function listAgentContracts(): Promise<AgentContract[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts");
}
export async function getAgentContract(id: number): Promise<AgentContract> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}`);
}
export async function listContractCandidates(): Promise<ContractCandidate[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/candidates");
}
export async function getReservationDefaults(
  leadId: number,
): Promise<import("@nestyk/types").ReservationLetterInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/reservation-defaults/${leadId}`);
}
export async function getBrokerAppointmentLeadDefaults(
  leadId: number,
): Promise<import("@nestyk/types").BrokerAppointmentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/broker-appointment-defaults/${leadId}`);
}
export async function previewAgentBrokerAppointment(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/broker-appointment-preview`, {});
}
export async function generateAgentBrokerAppointment(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-broker-appointment`, {});
}
export async function createAgentContract(
  input: CreateAgentContract,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost("/agent/contracts", input);
}

export async function listAgreementTypes(): Promise<AgreementType[]> {
  await ensureAgentSession();
  return apiGet("/agent/contracts/types");
}

export async function signAgentContract(
  id: number,
  input: SignAgentContract,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/sign`, input);
}

export async function createContractSignInvite(
  id: number,
  party: "owner" | "tenant",
): Promise<import("@nestyk/types").ContractSignInvite> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/sign-invites`, { party });
}

export async function uploadAgentContractDocument(
  id: number,
  kind: AgentContractDocumentKind,
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<AgentContract> {
  await ensureAgentSession();
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    form.append("file", blob, file.name);
  } else {
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    return await apiRequest<AgentContract>(
      `/agent/contracts/${id}/documents/${kind}`,
      {
        method: "POST",
        body: form,
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function previewAgentReservation(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/reservation-preview`, {});
}
export async function generateAgentReservation(
  id: number,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/generate-reservation`, {});
}

export async function listAgreementTemplates(
  code: string,
): Promise<import("@nestyk/types").AgreementTemplate[]> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/types/${encodeURIComponent(code)}/templates`);
}
export async function getAgreementHistory(
  id: number,
): Promise<AgentContract[]> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/history`);
}

export async function listAgreementAttachments(
  id: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments`);
}
export async function getBrokerAppointmentDefaults(
  id: number,
): Promise<import("@nestyk/types").BrokerAppointmentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments/broker-appointment/defaults`);
}
export async function generateBrokerAppointment(
  id: number,
  body: import("@nestyk/types").BrokerAppointmentInput,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/broker-appointment`, body);
}

export async function openAgreementAttachment(
  id: number,
  documentId: number,
): Promise<{ url: string }> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/attachments/${documentId}/url`);
}
export async function removeAgreementAttachment(
  id: number,
  documentId: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiRequest(`/agent/contracts/${id}/attachments/${documentId}`, { method: "DELETE" });
}
export async function reviewAgreementAttachment(
  id: number,
  documentId: number,
  status: "accepted" | "rejected",
  note?: string,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/${documentId}/review`, {
    status,
    note,
  });
}
export async function reuseAgreementAttachment(
  id: number,
  sourceDocumentId: number,
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/attachments/reuse`, {
    sourceDocumentId,
    confirmedCurrent: true,
  });
}
export async function uploadAgreementAttachment(
  id: number,
  input: {
    subject: string;
    documentTypeCode: string;
    supersedesDocumentId?: number;
  },
  file: { uri: string; name: string; mimeType: string; file?: File },
): Promise<import("@nestyk/types").AgreementAttachmentChecklist> {
  await ensureAgentSession();
  const form = new FormData();
  form.append("subject", input.subject);
  form.append("documentTypeCode", input.documentTypeCode);
  if (input.supersedesDocumentId)
    form.append("supersedesDocumentId", String(input.supersedesDocumentId));
  if (Platform.OS === "web")
    form.append(
      "file",
      file.file ?? (await (await fetch(file.uri)).blob()),
      file.name,
    );
  else
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    return await apiRequest(`/agent/contracts/${id}/attachments`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFinancialDocumentDefaults(id: number, kind: import('@nestyk/types').FinancialDocumentKind): Promise<import('@nestyk/types').FinancialDocumentInput> {
  await ensureAgentSession();
  return apiGet(`/agent/contracts/${id}/financial-documents/${kind}`);
}
export async function generateFinancialDocument(
  id: number,
  kind: import("@nestyk/types").FinancialDocumentKind,
  input: Partial<import("@nestyk/types").FinancialDocumentInput>,
): Promise<AgentContract> {
  await ensureAgentSession();
  return apiPost(`/agent/contracts/${id}/financial-documents/${kind}`, input);
}
