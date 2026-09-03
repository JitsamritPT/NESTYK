export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'failed';

export interface RentalContract {
  id: string;
  listingId: string;
  tenantId: string;
  ownerId: string;
  agentId?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  contractPdfUrl?: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  contractId: string;
  tenantId: string;
  title: string;
  dueDate: string;
  amountRent: number;
  amountWater?: number;
  amountElectric?: number;
  amountOther?: number;
  totalAmount: number;
  status: PaymentStatus;
  paymentQrCode?: string;
  paidAt?: string;
}
