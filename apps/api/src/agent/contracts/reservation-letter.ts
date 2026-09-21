import { BadRequestException } from "@nestjs/common";
import type { ReservationLetterInput } from "@nestyk/types";

const TEXT = [
  ["documentNo", 40],
  ["issueDate", 32],
  ["tenantName", 120],
  ["tenantPhone", 40],
  ["tenantId", 40],
  ["tenantNationality", 40],
  ["landlordName", 120],
  ["landlordPhone", 40],
  ["landlordId", 40],
  ["landlordNationality", 40],
  ["agentName", 80],
  ["companyName", 80],
  ["agentPhone", 40],
  ["project", 80],
  ["address", 160],
  ["unitNo", 24],
  ["floor", 16],
  ["area", 16],
  ["beds", 8],
  ["baths", 8],
  ["termMonths", 12],
  ["termFrom", 32],
  ["termTo", 32],
  ["monthlyRent", 40],
  ["advanceMonths", 8],
  ["advanceAmount", 40],
  ["depositMonths", 8],
  ["depositAmount", 40],
  ["reservationPayment", 40],
  ["reservationWords", 120],
  ["balanceDue", 40],
  ["payee", 80],
  ["paymentMethod", 16],
  ["bankAccount", 120],
  ["tenantSignName", 60],
  ["landlordSignName", 60],
  ["agentSignName", 60],
] as const;

const PAYMENT_METHODS = new Set(["", "transfer", "cash", "credit"]);

/** Calendar date in Asia/Bangkok (YYYY-MM-DD). */
export function bangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Number and booking date are system-owned: keep a saved draft, otherwise assign today. */
export function stampReservationDocumentHeader(
  input: unknown,
  saved?: Partial<ReservationLetterInput> | null,
): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const savedDate = saved?.issueDate;
  const savedNo = saved?.documentNo;
  return {
    ...(input as Record<string, unknown>),
    documentNo: typeof savedNo === "string" ? savedNo : "",
    issueDate:
      typeof savedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)
        ? savedDate
        : bangkokDate(),
  };
}

export function emptyReservationLetter(): ReservationLetterInput {
  return {
    documentNo: "",
    issueDate: "",
    tenantName: "",
    tenantPhone: "",
    tenantId: "",
    tenantNationality: "",
    landlordName: "",
    landlordPhone: "",
    landlordId: "",
    landlordNationality: "",
    agentName: "",
    companyName: "",
    agentPhone: "",
    project: "",
    address: "",
    unitNo: "",
    floor: "",
    area: "",
    beds: "",
    baths: "",
    termMonths: "",
    termFrom: "",
    termTo: "",
    monthlyRent: "",
    advanceMonths: "",
    advanceAmount: "",
    depositMonths: "",
    depositAmount: "",
    reservationPayment: "",
    reservationWords: "",
    applyToAdvance: false,
    applyToDeposit: false,
    balanceDue: "",
    payee: "",
    paymentMethod: "",
    bankAccount: "",
    tenantSignName: "",
    landlordSignName: "",
    agentSignName: "",
  };
}

export function validateReservationLetter(
  input: unknown,
): ReservationLetterInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลหนังสือจอง");
  const b = input as Record<string, unknown>;
  const out = emptyReservationLetter();
  for (const [key, max] of TEXT) {
    const v = b[key];
    if (typeof v !== "string" || v.trim().length > max)
      throw new BadRequestException("ข้อมูลในฟอร์มไม่ครบหรือยาวเกินไป");
    out[key] = v.trim();
  }
  out.applyToAdvance = b.applyToAdvance === true;
  out.applyToDeposit = b.applyToDeposit === true;
  if (!PAYMENT_METHODS.has(out.paymentMethod))
    throw new BadRequestException("วิธีชำระเงินไม่ถูกต้อง");
  for (const key of [
    "tenantName",
    "landlordName",
    "project",
    "issueDate",
    "reservationPayment",
  ] as const) {
    if (!out[key])
      throw new BadRequestException("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
  }
  for (const key of ["issueDate", "termFrom", "termTo"] as const) {
    if (out[key] && !/^\d{4}-\d{2}-\d{2}$/.test(out[key]))
      throw new BadRequestException("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  }
  return out;
}
