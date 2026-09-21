import React from "react";
import { Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { LeaseAgreementInput } from "@nestyk/types";

type TextField = Exclude<
  keyof LeaseAgreementInput,
  "landlordSignaturePng" | "tenantSignaturePng"
>;

export function emptyLeaseAgreementForm(): LeaseAgreementInput {
  return {
    documentNo: "",
    issueDate: "",
    landlordName: "",
    landlordNationality: "",
    landlordId: "",
    landlordAddress: "",
    landlordPhone: "",
    landlordEmail: "",
    tenantName: "",
    tenantNationality: "",
    tenantId: "",
    tenantAddress: "",
    tenantPhone: "",
    tenantEmail: "",
    propertyType: "",
    project: "",
    houseNo: "",
    propertyAddress: "",
    roomType: "",
    floor: "",
    area: "",
    termMonths: "",
    termFrom: "",
    termTo: "",
    monthlyRent: "",
    monthlyRentWords: "",
    rentDueDay: "",
    graceDay: "",
    latePenalty: "",
    latePenaltyWords: "",
    bankName: "",
    accountName: "",
    accountNo: "",
    otherPaymentMethod: "",
    advanceMonths: "",
    advanceAmount: "",
    depositMonths: "",
    depositAmount: "",
    otherInitialPayment: "",
    additionalTerms: "",
    agentContact: "",
    landlordSignName: "",
    tenantSignName: "",
    witnessSignName: "",
    landlordSignaturePng: "",
    tenantSignaturePng: "",
  };
}

export const LEASE_AGREEMENT_REQUIRED: TextField[] = [
  "issueDate",
  "landlordName",
  "tenantName",
  "project",
  "termFrom",
  "termTo",
  "monthlyRent",
  "depositAmount",
];

const REQUIRED_MESSAGE = "กรุณากรอกข้อมูลนี้";

export function leaseAgreementFieldErrors(
  value: LeaseAgreementInput,
): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {};
  for (const key of LEASE_AGREEMENT_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = REQUIRED_MESSAGE;
  }
  for (const key of ["issueDate", "termFrom", "termTo"] as const) {
    if (
      value[key].trim() &&
      !/^\d{4}-\d{2}-\d{2}$/.test(value[key].trim())
    )
      errors[key] = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
  }
  if (
    value.termFrom.trim() &&
    value.termTo.trim() &&
    value.termTo.trim() <= value.termFrom.trim()
  )
    errors.termTo = "วันสิ้นสุดต้องอยู่หลังวันเริ่มเช่า";
  return errors;
}

const FIELDS: Array<{
  key: TextField;
  label: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}> = [
  {
    key: "issueDate",
    label: "วันที่ออกเอกสาร (YYYY-MM-DD)",
    required: true,
    placeholder: "2026-10-01",
  },
  { key: "landlordName", label: "ผู้ให้เช่า", required: true },
  { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
  { key: "landlordId", label: "เลขบัตร / พาสปอร์ตผู้ให้เช่า" },
  { key: "landlordAddress", label: "ที่อยู่ผู้ให้เช่า", multiline: true },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า" },
  { key: "landlordEmail", label: "อีเมลผู้ให้เช่า" },
  { key: "tenantName", label: "ผู้เช่า", required: true },
  { key: "tenantNationality", label: "สัญชาติผู้เช่า" },
  { key: "tenantId", label: "เลขบัตร / พาสปอร์ตผู้เช่า" },
  { key: "tenantAddress", label: "ที่อยู่ผู้เช่า", multiline: true },
  { key: "tenantPhone", label: "เบอร์ติดต่อผู้เช่า" },
  { key: "tenantEmail", label: "อีเมลผู้เช่า" },
  { key: "propertyType", label: "ประเภททรัพย์สิน" },
  { key: "project", label: "โครงการ", required: true },
  { key: "houseNo", label: "บ้านเลขที่ / ห้อง" },
  { key: "propertyAddress", label: "ที่อยู่ทรัพย์สิน", multiline: true },
  { key: "roomType", label: "ประเภทห้อง" },
  { key: "floor", label: "ชั้น" },
  { key: "area", label: "ขนาดห้อง (ตร.ม.)" },
  { key: "termMonths", label: "ระยะเวลาเช่า (เดือน)" },
  {
    key: "termFrom",
    label: "เริ่มวันที่ (YYYY-MM-DD)",
    required: true,
    placeholder: "2026-10-01",
  },
  {
    key: "termTo",
    label: "สิ้นสุดวันที่ (YYYY-MM-DD)",
    required: true,
    placeholder: "2027-09-30",
  },
  { key: "monthlyRent", label: "ค่าเช่าต่อเดือน (บาท)", required: true },
  { key: "monthlyRentWords", label: "ค่าเช่าเป็นตัวอักษร" },
  { key: "rentDueDay", label: "วันครบกำหนดชำระค่าเช่า (ของเดือน)" },
  { key: "graceDay", label: "ผ่อนผันถึงวันที่" },
  { key: "latePenalty", label: "เบี้ยปรับต่อวัน (บาท)" },
  { key: "latePenaltyWords", label: "เบี้ยปรับเป็นตัวอักษร" },
  { key: "bankName", label: "ธนาคาร" },
  { key: "accountName", label: "ชื่อบัญชี" },
  { key: "accountNo", label: "เลขบัญชี" },
  {
    key: "otherPaymentMethod",
    label: "ช่องทางชำระอื่น",
    multiline: true,
  },
  { key: "advanceMonths", label: "ค่าเช่าล่วงหน้า (เดือน)" },
  { key: "advanceAmount", label: "ค่าเช่าล่วงหน้า (บาท)" },
  { key: "depositMonths", label: "เงินประกัน (เดือน)" },
  {
    key: "depositAmount",
    label: "เงินประกัน (บาท)",
    required: true,
  },
  { key: "otherInitialPayment", label: "รายการแรกเข้าอื่น" },
  {
    key: "additionalTerms",
    label: "ข้อตกลงเพิ่มเติม",
    multiline: true,
  },
  {
    key: "agentContact",
    label: "เอเจนท์ / ช่องทางติดต่อ (พยาน)",
    multiline: true,
  },
];

export function LeaseAgreementFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: LeaseAgreementInput;
  onChange: (next: LeaseAgreementInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextField, string>>;
}) {
  const { theme } = useMobileTheme();
  return (
    <View
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
        style={{
          fontSize: 16,
          lineHeight: 24,
          fontWeight: "600",
          color: theme.textHeading,
        }}
      >
        รายละเอียดสัญญาเช่า
      </Text>
      {FIELDS.map((field) => (
        <MobileInput
          key={field.key}
          label={field.label}
          required={field.required}
          error={errors?.[field.key]}
          value={value[field.key]}
          onChangeText={(text) => {
            const next = { ...value, [field.key]: text };
            if (field.key === "landlordName") next.landlordSignName = text;
            if (field.key === "tenantName") next.tenantSignName = text;
            if (field.key === "agentContact" && !value.witnessSignName.trim())
              next.witnessSignName = text;
            onChange(next);
          }}
          placeholder={field.placeholder}
          editable={!disabled}
          multiline={field.multiline}
        />
      ))}
    </View>
  );
}
