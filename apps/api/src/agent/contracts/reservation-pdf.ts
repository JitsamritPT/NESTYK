import {
  PDFDocument,
  PDFHexString,
  rgb,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  setFillingRgbColor,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentContract, ReservationLetterInput } from "@nestyk/types";
import { emptyReservationLetter } from "./reservation-letter";
import { bahtText } from "./financial-document";

/** Storage path segment for filled reservation letter PDFs. */
export const MOCK_RESERVATION_VERSION = "letter-v1";

type TextField = Exclude<
  keyof ReservationLetterInput,
  "applyToAdvance" | "applyToDeposit"
>;

type Blank = { x: number; w: number; y: number; size?: number };

/**
 * Blank slots measured from template underscore runs (pdf.js positions).
 * Letter size: 612 × 792. Keep printed underscores; draw values on top.
 */
const SLOTS: Record<TextField, Blank> = {
  documentNo: { x: 407.0, w: 38.0, y: 708.4 },
  issueDate: { x: 505.0, w: 44.0, y: 708.4 },
  tenantName: { x: 168.0, w: 185.0, y: 646.3 },
  tenantPhone: { x: 468.0, w: 80.0, y: 646.3 },
  tenantId: { x: 355.0, w: 68.0, y: 629.4 },
  tenantNationality: { x: 505.0, w: 42.0, y: 629.4 },
  landlordName: { x: 148.0, w: 205.0, y: 612.5 },
  landlordPhone: { x: 468.0, w: 80.0, y: 612.5 },
  landlordId: { x: 345.0, w: 80.0, y: 595.6 },
  landlordNationality: { x: 505.0, w: 42.0, y: 595.6 },
  agentName: { x: 168.0, w: 88.0, y: 578.6 },
  companyName: { x: 345.0, w: 95.0, y: 578.6 },
  agentPhone: { x: 490.0, w: 58.0, y: 578.6 },
  project: { x: 130.0, w: 105.0, y: 526.0 },
  address: { x: 300.0, w: 245.0, y: 526.0 },
  unitNo: { x: 145.0, w: 42.0, y: 509.0 },
  floor: { x: 235.0, w: 48.0, y: 509.0 },
  area: { x: 335.0, w: 48.0, y: 509.0 },
  beds: { x: 455.0, w: 36.0, y: 509.0 },
  baths: { x: 540.0, w: 36.0, y: 509.0 },
  termMonths: { x: 130.0, w: 55.0, y: 492.1 },
  termFrom: { x: 295.0, w: 70.0, y: 492.1 },
  termTo: { x: 435.0, w: 70.0, y: 492.1 },
  monthlyRent: { x: 68.0, w: 95.0, y: 416.0 },
  advanceMonths: { x: 232.0, w: 22.0, y: 416.0 },
  advanceAmount: { x: 310.0, w: 38.0, y: 416.0 },
  depositMonths: { x: 395.0, w: 22.0, y: 416.0 },
  depositAmount: { x: 473.0, w: 38.0, y: 416.0 },
  reservationPayment: { x: 171.0, w: 32.0, y: 361.6 },
  reservationWords: { x: 305.0, w: 130.0, y: 361.6 },
  balanceDue: { x: 440.0, w: 85.0, y: 344.6 },
  payee: { x: 175.0, w: 120.0, y: 327.7 },
  paymentMethod: { x: 0, w: 0, y: 0 }, // drawn as checkmarks
  bankAccount: { x: 430.0, w: 115.0, y: 310.8 },
  tenantSignName: { x: 112.0, w: 58.0, y: 38.6, size: 7.5 },
  landlordSignName: { x: 282.4, w: 58.0, y: 38.6, size: 7.5 },
  agentSignName: { x: 452.8, w: 58.0, y: 38.6, size: 7.5 },
};

const CHECKS = {
  applyToAdvance: { x: 127.8, y: 344.6 },
  applyToDeposit: { x: 260.0, y: 344.6 },
  transfer: { x: 60.6, y: 310.8 },
  cash: { x: 124.6, y: 310.8 },
  credit: { x: 184.7, y: 310.8 },
} as const;

/** Template signature lines L→R: tenant, landlord, agent. */
const SIGNATURE_SLOTS: Record<
  "tenant" | "owner" | "agent",
  { x: number; y: number; maxW: number; maxH: number }
> = {
  tenant: { x: 60.6, y: 74, maxW: 111, maxH: 34 },
  owner: { x: 230.9, y: 74, maxW: 111, maxH: 34 },
  agent: { x: 401.3, y: 74, maxW: 111, maxH: 34 },
};

function formatDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatMoney(value: string) {
  const clean = value.replace(/[,\s]/g, "").trim();
  if (!clean) return "";
  if (!/^\d+(\.\d+)?$/.test(clean)) return value.trim();
  const [whole, fraction] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction != null ? `${grouped}.${fraction}` : grouped;
}

function moneyNumber(value: string) {
  const clean = value.replace(/[,\s]/g, "").trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

export function reservationLetterFromContract(
  contract: AgentContract,
): ReservationLetterInput {
  const saved = (contract.data?.reservationLetter ?? null) as
    | Partial<ReservationLetterInput>
    | null;
  const base = emptyReservationLetter();
  const fee =
    contract.reservationFee != null ? String(contract.reservationFee) : "";
  const rent =
    contract.monthlyRent != null ? String(contract.monthlyRent) : "";
  const deposit =
    contract.deposit != null ? String(contract.deposit) : "";
  return {
    ...base,
    ...saved,
    documentNo: saved?.documentNo || contract.contractNo || "",
    issueDate:
      saved?.issueDate ||
      contract.bookingDate ||
      contract.startDate ||
      "",
    tenantName: saved?.tenantName || contract.tenant || "",
    project: saved?.project || contract.property || "",
    unitNo: saved?.unitNo || contract.room || "",
    termFrom:
      saved?.termFrom || contract.moveInDate || contract.startDate || "",
    termTo: saved?.termTo || contract.endDate || "",
    monthlyRent: saved?.monthlyRent || rent,
    reservationPayment: saved?.reservationPayment || fee,
    reservationWords:
      saved?.reservationWords ||
      (fee && moneyNumber(fee) != null
        ? bahtText(moneyNumber(fee)!)
        : ""),
    depositAmount: saved?.depositAmount || deposit,
    tenantSignName: saved?.tenantSignName || contract.tenant || "",
  };
}

export async function createReservationMock(
  contract: AgentContract,
): Promise<Buffer> {
  return createReservationLetterPdf(reservationLetterFromContract(contract));
}

export async function createReservationLetterPdf(
  data: ReservationLetterInput,
): Promise<Buffer> {
  const template = await readFile(
    join(__dirname, "assets/reservation-letter.pdf"),
  );
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit(fontkit);
  const bytes = await readFile(
    join(__dirname, "assets/NotoSansThai_400Regular.ttf"),
  );
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const page = pdf.getPages()[0];
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ink = rgb(0.12, 0.12, 0.12);
  const widthOf = (value: string, size: number) =>
    (shaping.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    shaping.unitsPerEm;

  function drawShaped(value: string, x: number, y: number, size: number) {
    const run = shaping.layout(value);
    const encoded = font.encodeText(value).asString();
    if (encoded.length !== run.glyphs.length * 4)
      throw new Error("Unexpected font encoding");
    let dx = 0;
    let dy = 0;
    const scale = size / shaping.unitsPerEm;
    page.pushOperators(
      beginText(),
      setFontAndSize(fontKey, size),
      setFillingRgbColor(ink.red, ink.green, ink.blue),
    );
    run.positions.forEach((pos, i) => {
      page.pushOperators(
        setTextMatrix(
          1,
          0,
          0,
          1,
          x + (dx + pos.xOffset) * scale,
          y + (dy + pos.yOffset) * scale,
        ),
        showText(PDFHexString.of(encoded.slice(i * 4, i * 4 + 4))),
      );
      dx += pos.xAdvance;
      dy += pos.yAdvance;
    });
    page.pushOperators(endText());
  }

  function fit(value: string, maxWidth: number, preferredSize: number) {
    const clean = value.replace(/[\r\n\t]+/g, " ").trim();
    if (!clean) return { text: "", size: preferredSize };
    let size = preferredSize;
    while (size > 6 && widthOf(clean, size) > maxWidth) size -= 0.5;
    if (widthOf(clean, size) <= maxWidth) return { text: clean, size };
    let out = clean;
    while (out.length && widthOf(out, size) > maxWidth) out = out.slice(0, -1);
    if (out !== clean && out.length > 3) out = `${out.slice(0, -1)}…`;
    return { text: out, size };
  }

  function write(value: string, slot: Blank) {
    if (!slot.w) return;
    const preferred = slot.size ?? 8.5;
    const { text, size } = fit(value, slot.w - 2, preferred);
    if (!text) return;
    drawShaped(text, slot.x + 1, slot.y + 0.6, size);
  }

  function mark(slot: { x: number; y: number }) {
    drawShaped("✓", slot.x + 0.8, slot.y + 0.2, 9);
  }

  const rentNum = moneyNumber(data.monthlyRent);
  const words =
    data.reservationWords ||
    (moneyNumber(data.reservationPayment) != null
      ? bahtText(moneyNumber(data.reservationPayment)!)
      : "");

  const values: Record<TextField, string> = {
    ...data,
    issueDate: formatDate(data.issueDate),
    termFrom: formatDate(data.termFrom),
    termTo: formatDate(data.termTo),
    monthlyRent: formatMoney(data.monthlyRent),
    advanceAmount: formatMoney(data.advanceAmount),
    depositAmount: formatMoney(data.depositAmount),
    reservationPayment: formatMoney(data.reservationPayment),
    reservationWords: words,
    balanceDue: formatMoney(data.balanceDue),
    paymentMethod: data.paymentMethod,
  };

  (Object.keys(SLOTS) as TextField[]).forEach((key) => {
    if (key === "paymentMethod") return;
    write(values[key], SLOTS[key]);
  });

  if (data.applyToAdvance) mark(CHECKS.applyToAdvance);
  if (data.applyToDeposit) mark(CHECKS.applyToDeposit);
  if (data.paymentMethod === "transfer") mark(CHECKS.transfer);
  if (data.paymentMethod === "cash") mark(CHECKS.cash);
  if (data.paymentMethod === "credit") mark(CHECKS.credit);

  // Monthly rent words under the THB blank when empty words field not used for rent.
  if (rentNum != null && !data.reservationWords) {
    write(`(${bahtText(rentNum)})`, { x: 68.0, w: 130.0, y: 395.9, size: 7.5 });
  } else if (rentNum != null) {
    write(`(${bahtText(rentNum)})`, { x: 68.0, w: 130.0, y: 395.9, size: 7.5 });
  }

  pdf.setTitle("หนังสือจองเช่าที่อยู่อาศัย");
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}

export async function stampReservationSignatures(
  base: Buffer,
  signatures: Buffer[],
): Promise<Buffer> {
  if (signatures.length !== 3) throw new Error("Three signatures are required");
  // Callers pass [owner, tenant, agent] matching CONTRACT_SIGN_PARTIES.
  const byParty = {
    owner: signatures[0]!,
    tenant: signatures[1]!,
    agent: signatures[2]!,
  } as const;
  const pdf = await PDFDocument.load(base);
  const page = pdf.getPages()[0];
  for (const party of ["tenant", "owner", "agent"] as const) {
    const slot = SIGNATURE_SLOTS[party];
    const image = await pdf.embedPng(byParty[party]);
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, {
      x: slot.x + (slot.maxW - size.width) / 2,
      y: slot.y,
      width: size.width,
      height: size.height,
    });
  }
  return Buffer.from(await pdf.save());
}
