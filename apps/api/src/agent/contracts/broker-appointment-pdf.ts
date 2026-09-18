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
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BrokerAppointmentInput } from "@nestyk/types";

export const BROKER_APPOINTMENT_VERSION = "v1";

type BrokerTextField = Exclude<
  keyof BrokerAppointmentInput,
  "landlordSignaturePng" | "brokerSignaturePng"
>;

type Blank = {
  x: number;
  w: number;
  y: number;
  size?: number;
  align?: "left" | "center";
};

/**
 * Blank slots measured from the template text runs (pdf.js positions + scaled
 * underscore spans) so values sit on the printed underline, not beside labels.
 */
const SLOTS: Record<BrokerTextField, Blank | Blank[]> = {
  // Header lines are vector strokes after the labels (no underscore glyphs).
  documentNo: { x: 385.0, w: 62.0, y: 753.6 },
  issueDate: { x: 492.0, w: 65.0, y: 753.6 },
  landlordName: { x: 132.2, w: 88.9, y: 649.9 },
  landlordNationality: { x: 308.4, w: 68.7, y: 649.9 },
  landlordId: { x: 486.9, w: 60.6, y: 649.9 },
  landlordAddress: { x: 130.0, w: 263.3, y: 630.1 },
  landlordPhone: { x: 477.5, w: 68.9, y: 630.1 },
  brokerCompany: { x: 163.6, w: 122.9, y: 610.4 },
  brokerContact: { x: 371.2, w: 172.6, y: 610.4 },
  brokerNationality: { x: 146.1, w: 67.0, y: 590.6 },
  brokerId: { x: 320.3, w: 71.0, y: 590.6 },
  brokerPhone: [
    { x: 480.1, w: 66.1, y: 590.6 },
    { x: 415.2, w: 128.8, y: 571.0 },
  ],
  brokerAddress: { x: 130.4, w: 191.6, y: 571.0 },
  propertyLine: { x: 200.9, w: 346.5, y: 551.2 },
  monthlyRent: { x: 147.4, w: 102.4, y: 531.5 },
  leaseMonths: { x: 420.2, w: 47.6, y: 531.5 },
  commissionFee: { x: 166.5, w: 36.2, y: 313.4 },
  commissionMonths: { x: 259.7, w: 14.7, y: 313.4 },
  landlordSignName: { x: 112.0, w: 130.0, y: 57.8, size: 8, align: "center" },
  brokerSignName: { x: 368.0, w: 128.0, y: 57.8, size: 8, align: "center" },
};

/** Drawn on the printed signature underscores (bottom-left of image). */
const SIGNATURE_SLOTS = [
  { key: "landlordSignaturePng" as const, x: 81.4, y: 62, maxW: 130, maxH: 40 },
  { key: "brokerSignaturePng" as const, x: 337.0, y: 62, maxW: 130, maxH: 40 },
];

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Format amounts like 25000 → 25,000 for PDF blanks. */
function formatMoney(value: string) {
  const clean = value.replace(/[,\s]/g, "").trim();
  if (!clean) return "";
  if (!/^\d+(\.\d+)?$/.test(clean)) return value.trim();
  const [whole, fraction] = clean.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction != null ? `${grouped}.${fraction}` : grouped;
}

/** Drop pad fill (#F8FAFC / near-white) so only ink sits on the template. */
async function transparentSignaturePng(dataUrl: string): Promise<Buffer> {
  const input = Buffer.from(
    dataUrl.replace(/^data:image\/png;base64,/i, ""),
    "base64",
  );
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r >= 235 && g >= 235 && b >= 235) data[i + 3] = 0;
  }
  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

export async function createBrokerAppointmentPdf(
  data: BrokerAppointmentInput,
): Promise<Buffer> {
  const template = await readFile(
    join(__dirname, "assets/broker-appointment.pdf"),
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
    while (size > 6.5 && widthOf(clean, size) > maxWidth) size -= 0.5;
    if (widthOf(clean, size) <= maxWidth) return { text: clean, size };
    let out = clean;
    while (out.length && widthOf(out, size) > maxWidth) out = out.slice(0, -1);
    if (out !== clean && out.length > 3) out = `${out.slice(0, -1)}…`;
    return { text: out, size };
  }

  function write(value: string, slot: Blank) {
    const preferred = slot.size ?? 9;
    const { text, size } = fit(value, slot.w - 2, preferred);
    if (!text) return;
    const textW = widthOf(text, size);
    const x =
      slot.align === "center"
        ? slot.x + Math.max(0, (slot.w - textW) / 2)
        : slot.x + 1;
    // Keep printed underscores; draw values on top of the blank lines.
    drawShaped(text, x, slot.y + 0.8, size);
  }

  const values: BrokerAppointmentInput = {
    ...data,
    issueDate: formatDate(data.issueDate),
    monthlyRent: formatMoney(data.monthlyRent),
    commissionFee: formatMoney(data.commissionFee),
  };

  (Object.keys(SLOTS) as BrokerTextField[]).forEach((key) => {
    const slot = SLOTS[key];
    const value = values[key];
    if (Array.isArray(slot)) slot.forEach((s) => write(value, s));
    else write(value, slot);
  });

  for (const slot of SIGNATURE_SLOTS) {
    const raw = values[slot.key];
    if (!raw) continue;
    const png = await transparentSignaturePng(raw);
    const image = await pdf.embedPng(png);
    const size = image.scaleToFit(slot.maxW, slot.maxH);
    page.drawImage(image, {
      x: slot.x + (slot.maxW - size.width) / 2,
      y: slot.y,
      width: size.width,
      height: size.height,
    });
  }

  pdf.setTitle("สัญญาแต่งตั้งนายหน้า (สำหรับเช่า)");
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}

/** Stamp owner (landlord) + agent (broker) PNGs onto a filled broker PDF. */
export async function stampBrokerAppointmentSignatures(
  base: Buffer,
  signatures: { owner: Buffer; agent: Buffer },
): Promise<Buffer> {
  const pdf = await PDFDocument.load(base);
  const page = pdf.getPages()[0];
  const pairs = [
    { slot: SIGNATURE_SLOTS[0]!, png: signatures.owner },
    { slot: SIGNATURE_SLOTS[1]!, png: signatures.agent },
  ];
  for (const { slot, png } of pairs) {
    const image = await pdf.embedPng(png);
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
