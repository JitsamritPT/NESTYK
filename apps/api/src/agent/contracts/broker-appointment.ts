import { BadRequestException } from "@nestjs/common";
import type { BrokerAppointmentInput } from "@nestyk/types";

const TEXT = [
  ["documentNo", 40],
  ["issueDate", 32],
  ["landlordName", 80],
  ["landlordNationality", 40],
  ["landlordId", 40],
  ["landlordAddress", 120],
  ["landlordPhone", 40],
  ["brokerCompany", 80],
  ["brokerContact", 80],
  ["brokerNationality", 40],
  ["brokerId", 40],
  ["brokerPhone", 40],
  ["brokerAddress", 120],
  ["propertyLine", 160],
  ["monthlyRent", 40],
  ["leaseMonths", 12],
  ["commissionFee", 24],
  ["commissionMonths", 8],
  ["landlordSignName", 60],
  ["brokerSignName", 60],
] as const;

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = "89504e470d0a1a0a";

function optionalPng(value: unknown, label: string): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string")
    throw new BadRequestException(`${label}ไม่ถูกต้อง`);
  const raw = value.replace(/^data:image\/png;base64,/i, "");
  let png: Buffer;
  try {
    png = Buffer.from(raw, "base64");
  } catch {
    throw new BadRequestException(`${label}ไม่ถูกต้อง`);
  }
  if (
    png.length < 32 ||
    png.length > MAX_SIGNATURE_BYTES ||
    png.subarray(0, 8).toString("hex") !== PNG_MAGIC
  )
    throw new BadRequestException(`${label}ต้องเป็นไฟล์ PNG`);
  return value.startsWith("data:") ? value : `data:image/png;base64,${raw}`;
}

export function validateBrokerAppointment(
  input: unknown,
): BrokerAppointmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("กรุณาระบุข้อมูลสัญญาแต่งตั้งนายหน้า");
  const b = input as Record<string, unknown>;
  const out = {} as BrokerAppointmentInput;
  for (const [key, max] of TEXT) {
    const v = b[key];
    if (typeof v !== "string" || v.trim().length > max)
      throw new BadRequestException("ข้อมูลในฟอร์มไม่ครบหรือยาวเกินไป");
    out[key] = v.trim();
  }
  out.landlordSignaturePng = optionalPng(
    b.landlordSignaturePng,
    "ลายเซ็นผู้ให้เช่า",
  );
  out.brokerSignaturePng = optionalPng(b.brokerSignaturePng, "ลายเซ็นนายหน้า");
  for (const key of [
    "issueDate",
    "landlordName",
    "brokerCompany",
    "brokerContact",
    "propertyLine",
  ] as const) {
    if (!out[key])
      throw new BadRequestException("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.issueDate))
    throw new BadRequestException("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  if (out.commissionFee && out.commissionMonths)
    throw new BadRequestException(
      "เลือกค่าคอมเป็นจำนวนเงิน หรือจำนวนเดือนของค่าเช่าอย่างใดอย่างหนึ่ง",
    );
  // Sign-line names are not edited in UI: landlord uses ชื่อผู้ให้เช่า; broker keeps autofill.
  out.landlordSignName = out.landlordName;
  if (!out.brokerSignName) out.brokerSignName = out.brokerContact;
  return out;
}

/** Persistable fields only — drop large signature payloads from contract JSON. */
export function brokerAppointmentSnapshot(
  data: BrokerAppointmentInput,
): Omit<BrokerAppointmentInput, "landlordSignaturePng" | "brokerSignaturePng"> {
  const {
    landlordSignaturePng: _l,
    brokerSignaturePng: _b,
    ...rest
  } = data;
  return rest;
}

/** Prefer lead lease duration; fall back to the room's shortest priced term. */
export function pickBrokerRentFromRoom(
  room:
    | {
        price_rows?: Array<{
          price: string;
          contract_type?: { term_months?: number } | null;
        }> | null;
        prices?: Record<string, unknown>[] | null;
      }
    | null
    | undefined,
  preferredMonths: number | null | undefined,
): { monthlyRent: string; leaseMonths: string } {
  type Row = { price: number; termMonths: number | null };
  const rows: Row[] = [];
  if (room?.price_rows?.length) {
    for (const row of room.price_rows) {
      const price = Number(row.price);
      if (!Number.isFinite(price)) continue;
      rows.push({
        price,
        termMonths: row.contract_type?.term_months ?? null,
      });
    }
    rows.sort((a, b) => (a.termMonths ?? 0) - (b.termMonths ?? 0));
  } else if (room?.prices?.length) {
    for (const row of room.prices) {
      const price = Number(row.price);
      if (
        !Number.isFinite(price) ||
        typeof row.contractTypeCode !== "string"
      )
        continue;
      rows.push({
        price,
        termMonths:
          Number(String(row.contractTypeCode).replace("monthly_", "")) || null,
      });
    }
  }
  const fromLead =
    preferredMonths != null && preferredMonths > 0
      ? String(preferredMonths)
      : "";
  if (!rows.length) return { monthlyRent: "", leaseMonths: fromLead };
  const match =
    preferredMonths != null
      ? rows.find((r) => r.termMonths === preferredMonths)
      : undefined;
  const picked = match ?? rows[0];
  return {
    monthlyRent: String(picked.price),
    leaseMonths:
      fromLead || (picked.termMonths != null ? String(picked.termMonths) : ""),
  };
}
