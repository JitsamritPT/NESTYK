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
  monthlyRent: number | null;
  deposit: number | null;
  notes: string | null;
  ownerSignedAt: string | null;
  tenantSignedAt: string | null;
}
export interface ContractCandidate {
  leadId: number;
  tenant: string;
  property: string;
  room: string | null;
}
export interface CreateAgentContract {
  leadId: number;
  startDate: string;
  endDate: string;
  monthlyRent?: number;
  deposit?: number;
  reservationFee?: number;
  agreementTypeCode?: string;
  notes?: string;
}
