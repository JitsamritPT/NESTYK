export interface AgreementTemplate {
  id: number;
  agreementTypeCode: string;
  version: number;
  name: string;
  formKind: "reservation" | "lease" | "broker_appointment";
  dataSchema: Record<string, unknown>;
}
export interface AgreementType {
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string;
  formKind: "reservation" | "lease" | "broker_appointment";
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
  formKind: "reservation" | "lease" | "broker_appointment";
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
  brokerAppointmentUrl: string | null;
  brokerAppointmentStatus:
    "awaiting_signatures" | "ready_to_generate" | "ready" | null;
  leaseDocumentUrl: string | null;
  invoiceUrl: string | null;
  receiptUrl: string | null;
}
export type AgentContractDocumentKind =
  | "reservation_letter"
  | "lease_agreement"
  | "invoice"
  | "receipt"
  | "broker_appointment";
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

export type FinancialDocumentKind = "invoice" | "receipt";
export interface FinancialDocumentInput {
  documentNo: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  customerName: string;
  customerAddress: string;
  customerTaxId: string;
  customerPhone: string;
  customerEmail: string;
  issuerName: string;
  issuerAddress: string;
  issuerTaxId: string;
  issuerPhone: string;
  issuerEmail: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  vatRate: number;
  discount: number;
  paymentMethod: string;
  paymentDetails: string;
  receiverName: string;
  notes: string;
}

/** Fillable fields for residential rental reservation PDF (หนังสือจอง). */
export interface ReservationLetterInput {
  documentNo: string;
  issueDate: string;
  tenantName: string;
  tenantPhone: string;
  tenantId: string;
  tenantNationality: string;
  landlordName: string;
  landlordPhone: string;
  landlordId: string;
  landlordNationality: string;
  agentName: string;
  companyName: string;
  agentPhone: string;
  project: string;
  address: string;
  unitNo: string;
  floor: string;
  area: string;
  beds: string;
  baths: string;
  termMonths: string;
  termFrom: string;
  termTo: string;
  monthlyRent: string;
  advanceMonths: string;
  advanceAmount: string;
  depositMonths: string;
  depositAmount: string;
  reservationPayment: string;
  reservationWords: string;
  /** Apply reservation to advance rent. */
  applyToAdvance: boolean;
  /** Apply reservation to security deposit. */
  applyToDeposit: boolean;
  balanceDue: string;
  payee: string;
  /** transfer | cash | credit | "" */
  paymentMethod: string;
  bankAccount: string;
  tenantSignName: string;
  landlordSignName: string;
  agentSignName: string;
}

/** Fields for generated rental broker appointment PDF (แต่งตั้งนายหน้า). */
export interface BrokerAppointmentInput {
  documentNo: string;
  issueDate: string;
  landlordName: string;
  landlordNationality: string;
  landlordId: string;
  landlordAddress: string;
  landlordPhone: string;
  brokerCompany: string;
  brokerContact: string;
  brokerNationality: string;
  brokerId: string;
  brokerPhone: string;
  brokerAddress: string;
  propertyLine: string;
  monthlyRent: string;
  leaseMonths: string;
  commissionFee: string;
  commissionMonths: string;
  landlordSignName: string;
  brokerSignName: string;
  /** Optional PNG data URL for landlord signature image on the PDF. */
  landlordSignaturePng: string;
  /** Optional PNG data URL for broker signature image on the PDF. */
  brokerSignaturePng: string;
}
