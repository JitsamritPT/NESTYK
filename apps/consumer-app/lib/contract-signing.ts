import type { AgentContract } from "@nestyk/types";

export const BOOKING_PAYMENT_BEFORE_SIGNING =
  "ผู้เช่าต้องชำระค่าจอง และรอเอเจนต์ตรวจสอบการชำระพร้อมออกใบเสร็จก่อนลงนาม";

export function bookingPaymentBlocksSigning(
  contract: Pick<AgentContract, "formKind" | "receiptUrl">,
  party: string | undefined,
) {
  return party === "tenant" && contract.formKind === "reservation" && !contract.receiptUrl;
}
