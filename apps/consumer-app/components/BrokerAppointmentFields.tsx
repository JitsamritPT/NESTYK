import React from "react";
import { Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { BrokerAppointmentInput } from "@nestyk/types";

type TextField = Exclude<
  keyof BrokerAppointmentInput,
  "landlordSignaturePng" | "brokerSignaturePng"
>;

export function emptyBrokerAppointmentForm(): BrokerAppointmentInput {
  return {
    documentNo: "",
    issueDate: "",
    landlordName: "",
    landlordNationality: "",
    landlordId: "",
    landlordAddress: "",
    landlordPhone: "",
    brokerCompany: "",
    brokerContact: "",
    brokerNationality: "",
    brokerId: "",
    brokerPhone: "",
    brokerAddress: "",
    propertyLine: "",
    monthlyRent: "",
    leaseMonths: "",
    commissionFee: "",
    commissionMonths: "",
    landlordSignName: "",
    brokerSignName: "",
    landlordSignaturePng: "",
    brokerSignaturePng: "",
  };
}

export const BROKER_APPOINTMENT_REQUIRED: TextField[] = [
  "issueDate",
  "landlordName",
  "brokerCompany",
  "brokerContact",
  "propertyLine",
];

const REQUIRED_MESSAGE = "กรุณากรอกข้อมูลนี้";

export function brokerAppointmentFieldErrors(
  value: BrokerAppointmentInput,
): Partial<Record<TextField, string>> {
  const errors: Partial<Record<TextField, string>> = {};
  for (const key of BROKER_APPOINTMENT_REQUIRED) {
    if (!String(value[key] ?? "").trim()) errors[key] = REQUIRED_MESSAGE;
  }
  if (value.issueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value.issueDate.trim()))
    errors.issueDate = "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)";
  if (value.commissionFee.trim() && value.commissionMonths.trim())
    errors.commissionFee =
      "เลือกค่าคอมเป็นจำนวนเงิน หรือจำนวนเดือนอย่างใดอย่างหนึ่ง";
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
    label: "วันที่ (YYYY-MM-DD)",
    required: true,
    placeholder: "2026-10-01",
  },
  { key: "landlordName", label: "ผู้ให้เช่า", required: true },
  { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
  { key: "landlordId", label: "เลขบัตร / พาสปอร์ตผู้ให้เช่า" },
  { key: "landlordAddress", label: "ที่อยู่ผู้ให้เช่า", multiline: true },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า" },
  { key: "brokerCompany", label: "บริษัทนายหน้า", required: true },
  { key: "brokerContact", label: "ผู้ติดต่อนายหน้า", required: true },
  { key: "brokerNationality", label: "สัญชาตินายหน้า" },
  { key: "brokerId", label: "เลขบัตร / พาสปอร์ตนายหน้า" },
  { key: "brokerPhone", label: "เบอร์ติดต่อนายหน้า" },
  { key: "brokerAddress", label: "ที่อยู่นายหน้า", multiline: true },
  {
    key: "propertyLine",
    label: "โครงการ / ห้อง / ที่อยู่",
    required: true,
    multiline: true,
  },
  { key: "monthlyRent", label: "ค่าเช่า (บาท)" },
  { key: "leaseMonths", label: "ระยะเช่าที่เสนอ (เดือน)" },
  {
    key: "commissionFee",
    label: "ค่าคอมที่ตกลง (บาท) — หรือเว้นว่างถ้าคิดเป็นเดือน",
  },
  {
    key: "commissionMonths",
    label: "ค่าคอมเป็นจำนวนเดือนของค่าเช่า — หรือเว้นว่างถ้าคิดเป็นบาท",
  },
];

export function BrokerAppointmentFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: BrokerAppointmentInput;
  onChange: (next: BrokerAppointmentInput) => void;
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
        รายละเอียดแต่งตั้งนายหน้า
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
            if (field.key === "brokerContact" && !value.brokerSignName.trim())
              next.brokerSignName = text;
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
