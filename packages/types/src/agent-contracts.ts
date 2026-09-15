export interface AgreementTemplate {
  id: number;
  agreementTypeCode: string;
  version: number;
  name: string;
  formKind: "reservation" | "lease";
  dataSchema: Record<string, unknown>;
}
export interface AgreementType {
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  formKind: "reservation" | "lease";
}
export type AgentContractStatus =
  | "draft"
  | "awaiting_signatures"
  | "awaiting_agent_review"
  | "awaiting_payment"
  | "awaiting_payment_verification"
  | "active"
  | "cancelled"
  | "expired"
  | "terminated";
export interface AgentContract {
  id: number;
  tenantId: number;
  leadId: number;
  contractNo: string;
  templateId: number | null;
  templateVersion: number | null;
  agreementKind: "new" | "renewal";
  previousAgreementId: number | null;
  rootAgreementId: number;
  data: Record<string, unknown>;
  property: string;
  room: string | null;
  tenant: string;
  agreementTypeCode: string;
  agreementTypeName: string;
  formKind: "reservation" | "lease";
  reservationFee: number | null;
  status: AgentContractStatus;
  startDate: string;
  endDate: string | null;
  bookingDate: string | null;
  moveInDate: string | null;
  monthlyRent: number | null;
  deposit: number | null;
  notes: string | null;
  ownerSignedAt: string | null;
  tenantSignedAt: string | null;
  agentSignedAt: string | null;
  ownerSignatureUrl: string | null;
  tenantSignatureUrl: string | null;
  agentSignatureUrl: string | null;
  reservationLetterUrl: string | null;
  reservationLetterStatus:
    "awaiting_signatures" | "ready_to_generate" | "ready" | null;
  leaseDocumentUrl: string | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
}
export type AgentContractDocumentKind =
  | "reservation_letter"
  | "lease_agreement"
  | "invoice"
  | "receipt";
export type AgentContractSignParty = "owner" | "tenant" | "agent";
export interface SignAgentContract {
  parties: AgentContractSignParty[];
  signaturePng: string;
}
export interface ContractSignInvite {
  party: "owner" | "tenant";
  url: string;
  expiresAt: string;
}
export interface ContractCandidate {
  leadId: number;
  tenant: string;
  property: string;
  room: string | null;
}
export interface CreateAgentContract {
  templateId?: number;
  previousAgreementId?: number;
  data?: Record<string, unknown>;
  leadId: number;
  startDate: string;
  endDate?: string;
  moveInDate?: string;
  monthlyRent?: number;
  deposit?: number;
  reservationFee?: number;
  agreementTypeCode?: string;
  notes?: string;
}

export type AgreementDocumentSubject =
  "tenant" | "owner" | "property" | "representative";
export interface AgreementAttachment {
  id: number;
  agreementId: number;
  documentTypeCode: string;
  subject: AgreementDocumentSubject;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  reviewStatus: "pending" | "accepted" | "rejected";
  reviewNote: string | null;
  reviewedAt: string | null;
  supersedesDocumentId: number | null;
  sourceDocumentId: number | null;
  isCurrent: boolean;
}
export interface AgreementAttachmentChecklist {
  editable: boolean;
  readyToSign: boolean;
  documentTypes: Array<{ code: string; nameTh: string }>;
  requirements: Array<{
    groupKey: string;
    label: string;
    subject: AgreementDocumentSubject;
    documentTypeCodes: string[];
    complete: boolean;
  }>;
  documents: AgreementAttachment[];
  reusableDocuments: AgreementAttachment[];
}
