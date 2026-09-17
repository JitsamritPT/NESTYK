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
import type {
  FinancialDocumentInput,
  FinancialDocumentKind,
} from "@nestyk/types";
import { bahtText, financialTotals } from "./financial-document";

/** Receipt-template layout, with shaped Thai glyph offsets and expandable text rows. */
export async function createFinancialPdf(
  kind: FinancialDocumentKind,
  data: FinancialDocumentInput,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bytes = await readFile(
    join(__dirname, "assets/NotoSansThai_400Regular.ttf"),
  );
  const font = await pdf.embedFont(bytes, { subset: true });
  const shaping = fontkit.create(bytes);
  const page = pdf.addPage([595.28, 841.89]);
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ink = rgb(0.13, 0.12, 0.12);
  const width = (value: string, size: number) =>
    (shaping.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    shaping.unitsPerEm;
  function text(value: string, x: number, y: number, size = 10) {
    // pdf-lib's normal drawText omits GPOS offsets; apply them for Thai stacked marks.
    const run = shaping.layout(value);
    const encoded = font.encodeText(value).asString();
    if (encoded.length !== run.glyphs.length * 4)
      throw new Error("Unexpected font encoding");
    let dx = 0,
      dy = 0;
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
  function wrap(value: string, max: number, size: number) {
    const lines: string[] = [];
    let line = "";
    for (const { segment } of new Intl.Segmenter("th", {
      granularity: "grapheme",
    }).segment(value.replace(/\s+/g, " ").trim() || "-")) {
      if (line && width(line + segment, size) > max) {
        lines.push(line);
        line = "";
      }
      line += segment;
    }
    if (line) lines.push(line);
    return lines;
  }
  function block(
    value: string,
    x: number,
    y: number,
    max: number,
    lines = 2,
    size = 10,
  ) {
    let rows = wrap(value, max, size);
    while (rows.length > lines && size > 7) {
      size -= 0.25;
      rows = wrap(value, max, size);
    }
    if (rows.length > lines)
      throw new Error(
        "ข้อความยาวเกินพื้นที่เอกสาร กรุณาย่อที่อยู่หรือรายละเอียด",
      );
    rows.forEach((row, index) => text(row, x, y - index * size * 1.65, size));
  }
  const line = (y: number) =>
    page.drawLine({
      start: { x: 42, y },
      end: { x: 553, y },
      thickness: 0.65,
      color: ink,
    });
  const amount = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const right = (value: string, x: number, y: number, size = 10) =>
    text(value, x - width(value, size), y, size);
  const date = (value: string) =>
    value ? value.split("-").reverse().join("/") : "-";
  /** Label + value on one line when space allows; otherwise value wraps under the label. */
  const field = (
    label: string,
    value: string,
    x: number,
    y: number,
    colWidth: number,
    lines = 1,
    size = 10,
  ) => {
    text(label, x, y, size);
    const labelW = width(label, size);
    const remaining = colWidth - labelW - 4;
    const inline = lines === 1 && remaining >= 72;
    if (inline) {
      block(value || "-", x + labelW + 4, y, remaining, 1, size);
      return;
    }
    block(value || "-", x, y - size * 1.45, colWidth, Math.max(lines, 1), size);
  };
  const docNoLabel =
    kind === "receipt" ? "เลขที่ / Receipt No. : " : "เลขที่ / Invoice No. : ";
  const left = 42;
  const rightCol = 340;
  const leftW = 280;
  const rightW = 213;

  // Header: Thai title → rule → English title (matches paper template)
  text(kind === "receipt" ? "ใบเสร็จรับเงิน" : "ใบแจ้งหนี้", left, 800, 26);
  line(784);
  text(kind === "receipt" ? "RECEIPT" : "INVOICE", left, 764, 16);

  // Customer (left) + document meta (right)
  field("ชื่อลูกค้า / Customer : ", data.customerName, left, 736, leftW);
  field(docNoLabel, data.documentNo, rightCol, 736, rightW);
  field("ที่อยู่ / Address : ", data.customerAddress, left, 712, leftW, 2, 10);
  field("วันที่ / Date : ", date(data.issueDate), rightCol, 712, rightW);
  field(
    "เลขประจำตัวผู้เสียภาษี / Tax ID : ",
    data.customerTaxId || "-",
    left,
    668,
    leftW,
    1,
    9,
  );
  field("อ้างอิง / Ref. : ", data.reference || "-", rightCol, 688, rightW);
  field(
    "เบอร์ติดต่อ / Contact No. : ",
    data.customerPhone || "-",
    left,
    646,
    leftW,
    1,
    9,
  );
  field("E-mail : ", data.customerEmail || "-", left, 624, leftW, 1, 9);

  // Issuer (left) + issuer contact (right)
  field("ผู้ออก / Issuer : ", data.issuerName, left, 588, leftW);
  field(
    "เลขประจำตัวผู้เสียภาษี / Tax ID : ",
    data.issuerTaxId || "-",
    rightCol,
    588,
    rightW,
    1,
    9,
  );
  field("ที่อยู่ / Address : ", data.issuerAddress, left, 564, leftW, 2, 10);
  field(
    "เบอร์ติดต่อ / Contact No. : ",
    data.issuerPhone || "-",
    rightCol,
    564,
    rightW,
    1,
    9,
  );
  field("อีเมล / E-mail : ", data.issuerEmail || "-", rightCol, 524, rightW, 1, 9);

  line(508);
  text("ลำดับ", 46, 490, 10);
  text("รายการ / Description", 84, 490, 10);
  right("จำนวน", 376, 490);
  right("ราคา/หน่วย", 462, 490);
  right("รวม (บาท)", 549, 490);
  line(476);
  data.items.forEach((item, index) => {
    const y = 455 - index * 36;
    text(String(index + 1), 49, y);
    block(item.description, 84, y, 235, 2, 9);
    right(String(item.quantity), 376, y, 9);
    right(amount(item.unitPrice), 462, y, 9);
    right(
      amount(
        Math.round(item.quantity * Math.round(item.unitPrice * 100)) / 100,
      ),
      549,
      y,
      9,
    );
  });
  line(285);
  const totals = financialTotals(data);
  [
    ["ราคารวม / Subtotal", totals.subtotal],
    ["ส่วนลด / Discount", totals.discount],
    [`VAT (${data.vatRate}%)`, totals.vat],
  ].forEach(([label, value], i) => {
    text(String(label), 330, 266 - i * 20, 10);
    right(amount(Number(value)), 549, 266 - i * 20, 10);
  });
  line(212);
  text("จำนวนเงินรวมทั้งสิ้น / Grand total", 42, 190, 12);
  right(amount(totals.total), 549, 190, 13);
  block(`(${bahtText(totals.total)})`, 42, 169, 507, 2, 10);
  if (kind === "invoice") {
    text(`กำหนดชำระ / Due date : ${date(data.dueDate)}`, 42, 129, 11);
  } else {
    const method: Record<string, string> = {
      cash: "เงินสด / Cash",
      transfer: "โอน / Transfer",
      cheque: "เช็ค / Cheque",
      other: "อื่น ๆ / Other",
    };
    text(`ชำระเงินโดย / Paid by : ${method[data.paymentMethod]}`, 42, 129, 11);
  }
  block(data.paymentDetails || "-", 42, 109, 507, 2, 9);
  block(`หมายเหตุ / Remark : ${data.notes || "-"}`, 42, 73, 507, 2, 9);
  if (kind === "receipt")
    block(`ผู้รับเงิน / Receiver : ${data.receiverName}`, 42, 40, 507, 1, 10);
  pdf.setTitle(
    `${kind === "receipt" ? "Receipt" : "Invoice"} ${data.documentNo}`,
  );
  pdf.setCreator("NESTYK");
  return Buffer.from(await pdf.save());
}
