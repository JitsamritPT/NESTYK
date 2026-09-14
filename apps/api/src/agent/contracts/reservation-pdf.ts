import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentContract } from "@nestyk/types";

export const MOCK_RESERVATION_VERSION = "mock-v2";
const positions = [48, 220, 392];

/** Temporary one-page template. Keep the same base PDF when stamping signatures. */
export async function createReservationMock(
  contract: AgentContract,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(join(__dirname, "assets/NotoSansThai_400Regular.ttf")),
    { subset: true },
  );
  const page = pdf.addPage([595.28, 841.89]);
  const ink = rgb(0.12, 0.2, 0.25);
  const text = (
    value: string,
    x: number,
    y: number,
    size = 12,
    maxWidth = 490,
  ) => {
    const clean = value.replace(/[\r\n\t]/g, " ");
    let clipped = clean;
    while (clipped.length && font.widthOfTextAtSize(clipped, size) > maxWidth)
      clipped = clipped.slice(0, -1);
    if (clipped !== clean) clipped = clipped.slice(0, -3) + "...";
    page.drawText(clipped, { x, y, size, font, color: ink });
  };
  page.drawRectangle({
    x: 0,
    y: 730,
    width: 596,
    height: 112,
    color: rgb(0.93, 0.97, 0.96),
  });
  text("NESTYK", 48, 790, 23);
  text("ใบจองห้องพัก (เอกสารตัวอย่าง)", 48, 753, 19);
  text("MOCK - ใช้ทดสอบระบบเท่านั้น / ไม่ใช่สัญญาฉบับจริง", 48, 700, 12);
  const fields = [
    ["เลขที่เอกสาร", contract.contractNo],
    ["ผู้จอง", contract.tenant],
    ["โครงการ", contract.property],
    ["ห้อง", contract.room ?? "-"],
    ["วันที่จอง", contract.bookingDate ?? contract.startDate],
    ["วันที่เข้าอยู่", contract.moveInDate ?? "-"],
    ["ค่าจอง", `${(contract.reservationFee ?? 0).toLocaleString("th-TH")} บาท`],
  ];
  fields.forEach(([label, value], index) => {
    const y = 652 - index * 38;
    text(label, 48, y, 11, 130);
    text(value, 195, y, 12, 350);
    page.drawLine({
      start: { x: 48, y: y - 12 },
      end: { x: 547, y: y - 12 },
      color: rgb(0.87, 0.9, 0.91),
      thickness: 0.5,
    });
  });
  text("พื้นที่ลงนามของทั้ง 3 ฝ่าย", 48, 345, 14);
  ["เจ้าของห้อง", "ผู้เช่า / ผู้จอง", "ตัวแทน"].forEach((label, index) => {
    const x = positions[index];
    page.drawRectangle({
      x,
      y: 190,
      width: 155,
      height: 100,
      borderWidth: 0.7,
      borderColor: rgb(0.74, 0.8, 0.8),
    });
    text(label, x, 170, 11, 155);
  });
  text("เอกสารตัวอย่างสำหรับทดสอบการวางลายเซ็นทั้ง 3 ตำแหน่ง", 48, 100, 10);
  text(`Template ${MOCK_RESERVATION_VERSION}  |  1 / 1`, 48, 55, 9);
  return Buffer.from(await pdf.save());
}

export async function stampReservationSignatures(
  base: Buffer,
  signatures: Buffer[],
): Promise<Buffer> {
  if (signatures.length !== 3) throw new Error("Three signatures are required");
  const pdf = await PDFDocument.load(base);
  const page = pdf.getPages()[0];
  for (let i = 0; i < 3; i++) {
    const image = await pdf.embedPng(signatures[i]);
    const size = image.scaleToFit(135, 80);
    page.drawImage(image, {
      x: positions[i] + (155 - size.width) / 2,
      y: 190 + (100 - size.height) / 2,
      ...size,
    });
  }
  return Buffer.from(await pdf.save());
}
