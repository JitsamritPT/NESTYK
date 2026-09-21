import React from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { ReservationLetterInput } from "@nestyk/types";

export function emptyReservationLetterForm(): ReservationLetterInput {
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

type TextKey = Exclude<
  keyof ReservationLetterInput,
  "applyToAdvance" | "applyToDeposit"
>;

export const RESERVATION_LETTER_REQUIRED: TextKey[] = [
  "tenantName",
  "landlordName",
  "project",
  "reservationPayment",
];

/** Booking date is the document date; keep a saved draft date, otherwise today in Bangkok. */
export function reservationIssueDate(saved?: string | null) {
  if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const REQUIRED_MESSAGE = "กรุณากรอกข้อมูลนี้";

export function reservationLetterFieldErrors(
  value: ReservationLetterInput,
): Partial<Record<TextKey, string>> {
  const errors: Partial<Record<TextKey, string>> = {};
  for (const key of RESERVATION_LETTER_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = REQUIRED_MESSAGE;
  }
  if (
    value.issueDate.trim() &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value.issueDate.trim())
  )
    errors.issueDate = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
  if (value.termFrom.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.termFrom.trim()))
    errors.termFrom = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
  if (value.termTo.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.termTo.trim()))
    errors.termTo = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
  return errors;
}

const SECTIONS: Array<{
  title: string;
  fields: Array<{
    key: TextKey;
    label: string;
    placeholder?: string;
    multiline?: boolean;
    required?: boolean;
  }>;
}> = [
  {
    title: "01 คู่สัญญาและผู้ประสานงาน",
    fields: [
      { key: "tenantName", label: "ผู้จอง", required: true },
      { key: "tenantPhone", label: "เบอร์ติดต่อผู้จอง" },
      { key: "tenantId", label: "เลขบัตร / พาสปอร์ต / นิติบุคคล ผู้จอง" },
      { key: "tenantNationality", label: "สัญชาติผู้จอง" },
      { key: "landlordName", label: "ผู้ให้เช่า", required: true },
      { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า" },
      { key: "landlordId", label: "เลขบัตร / พาสปอร์ต / นิติบุคคล ผู้ให้เช่า" },
      { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
      { key: "agentName", label: "ชื่อเอเจนท์" },
      { key: "companyName", label: "ชื่อบริษัท" },
      { key: "agentPhone", label: "โทรเอเจนท์" },
    ],
  },
  {
    title: "02 ทรัพย์สินและข้อตกลงการเช่า",
    fields: [
      { key: "project", label: "โครงการ", required: true },
      { key: "address", label: "ที่อยู่", multiline: true },
      { key: "unitNo", label: "บ้านเลขที่ / ห้อง" },
      { key: "floor", label: "ชั้น" },
      { key: "area", label: "พื้นที่ (ตร.ม.)" },
      { key: "beds", label: "นอน" },
      { key: "baths", label: "น้ำ" },
      { key: "termMonths", label: "ระยะเวลา (เดือน)" },
      {
        key: "termFrom",
        label: "เริ่ม / วันที่เข้าอยู่ (YYYY-MM-DD)",
        placeholder: "2026-10-15",
      },
      {
        key: "termTo",
        label: "สิ้นสุด (YYYY-MM-DD)",
        placeholder: "2027-10-14",
      },
    ],
  },
  {
    title: "03 จำนวนเงินและการชำระ",
    fields: [
      { key: "monthlyRent", label: "ค่าเช่ารายเดือน (บาท)" },
      { key: "advanceMonths", label: "ค่าเช่าล่วงหน้า (เดือน)" },
      { key: "advanceAmount", label: "ค่าเช่าล่วงหน้า (บาท)" },
      { key: "depositMonths", label: "เงินประกัน (เดือน)" },
      { key: "depositAmount", label: "เงินประกัน (บาท)" },
      {
        key: "reservationPayment",
        label: "เงินจอง (บาท)",
        required: true,
        placeholder: "5000",
      },
      {
        key: "reservationWords",
        label: "ตัวอักษรเงินจอง (เว้นว่างให้ระบบใส่)",
      },
      { key: "balanceDue", label: "คงเหลือ (บาท)" },
      { key: "payee", label: "ผู้รับเงิน" },
      { key: "bankAccount", label: "ธนาคาร ชื่อและเลขบัญชี" },
      { key: "tenantSignName", label: "ชื่อใต้ลายเซ็นผู้จอง" },
      { key: "landlordSignName", label: "ชื่อใต้ลายเซ็นผู้ให้เช่า" },
      { key: "agentSignName", label: "ชื่อใต้ลายเซ็นเอเจนท์" },
    ],
  },
];

const PAYMENT_OPTIONS: Array<{
  value: "" | "transfer" | "cash" | "credit";
  label: string;
}> = [
  { value: "", label: "ไม่ระบุ" },
  { value: "transfer", label: "โอน" },
  { value: "cash", label: "เงินสด" },
  { value: "credit", label: "บัตรเครดิต" },
];

export function ReservationLetterFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: ReservationLetterInput;
  onChange: (next: ReservationLetterInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextKey, string>>;
}) {
  const { theme } = useMobileTheme();
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const set = (key: TextKey, text: string) =>
    onChange({ ...value, [key]: text });

  return (
    <View style={{ gap: 16 }}>
      {SECTIONS.map((section) => (
        <View
          key={section.title}
          style={{
            gap: 10,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          <Text
            style={[
              {
                fontSize: 16,
                lineHeight: 24,
                fontWeight: "600",
              },
              title,
            ]}
          >
            {section.title}
          </Text>
          {section.fields.map((field) => (
            <MobileInput
              key={field.key}
              label={field.label}
              required={field.required}
              error={errors?.[field.key]}
              value={value[field.key]}
              onChangeText={(text) => set(field.key, text)}
              placeholder={field.placeholder}
              editable={!disabled}
              multiline={field.multiline}
            />
          ))}
          {section.title.startsWith("03") ? (
            <>
              <Text style={[{ fontSize: 14, lineHeight: 21 }, title]}>
                นำไปหัก
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    ["applyToAdvance", "ค่าเช่าล่วงหน้า"],
                    ["applyToDeposit", "เงินประกัน"],
                  ] as const
                ).map(([key, label]) => {
                  const selected = value[key];
                  return (
                    <Pressable
                      key={key}
                      disabled={disabled}
                      onPress={() => onChange({ ...value, [key]: !selected })}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? "#F8B615" : theme.border,
                        backgroundColor: selected ? "#FFFBEB" : theme.background,
                      }}
                    >
                      <Text style={[{ fontSize: 13, lineHeight: 19 }, title]}>
                        {selected ? "✓ " : ""}
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[{ fontSize: 14, lineHeight: 21 }, title]}>
                วิธีชำระ
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = value.paymentMethod === option.value;
                  return (
                    <Pressable
                      key={option.value || "none"}
                      disabled={disabled}
                      onPress={() =>
                        onChange({ ...value, paymentMethod: option.value })
                      }
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? "#F8B615" : theme.border,
                        backgroundColor: selected ? "#FFFBEB" : theme.background,
                      }}
                    >
                      <Text style={[{ fontSize: 13, lineHeight: 19 }, title]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[{ fontSize: 12, lineHeight: 18 }, muted]}>
                เงื่อนไขการจองและคืนเงินอยู่ในแม่แบบ PDF แล้ว
              </Text>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}
