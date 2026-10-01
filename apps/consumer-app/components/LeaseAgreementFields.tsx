import React from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { LeaseAgreementInput } from "@nestyk/types";

type TextField = Exclude<
  keyof LeaseAgreementInput,
  "landlordSignaturePng" | "tenantSignaturePng"
>;

function splitStoredName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

export function completeLeaseNames(
  input: Partial<LeaseAgreementInput>,
): LeaseAgreementInput {
  const form = { ...emptyLeaseAgreementForm(), ...input };
  if (!form.landlordFirstName.trim() && !form.landlordLastName.trim()) {
    const [first, last] = splitStoredName(form.landlordName);
    form.landlordFirstName = first;
    form.landlordLastName = last;
  }
  if (!form.tenantFirstName.trim() && !form.tenantLastName.trim()) {
    const [first, last] = splitStoredName(form.tenantName);
    form.tenantFirstName = first;
    form.tenantLastName = last;
  }
  return form;
}

export function emptyLeaseAgreementForm(): LeaseAgreementInput {
  return {
    documentNo: "",
    issueDate: "",
    landlordName: "",
    landlordFirstName: "",
    landlordLastName: "",
    landlordNationality: "",
    landlordId: "",
    landlordAddress: "",
    landlordPhone: "",
    landlordEmail: "",
    tenantName: "",
    tenantFirstName: "",
    tenantLastName: "",
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
  "landlordFirstName",
  "tenantFirstName",
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
    if (value[key].trim() && !/^\d{4}-\d{2}-\d{2}$/.test(value[key].trim()))
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
  { key: "landlordFirstName", label: "ชื่อผู้ให้เช่า", required: true },
  { key: "landlordLastName", label: "นามสกุลผู้ให้เช่า" },
  { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
  { key: "landlordId", label: "เลขบัตร / พาสปอร์ตผู้ให้เช่า" },
  { key: "landlordAddress", label: "ที่อยู่ผู้ให้เช่า", multiline: true },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า" },
  { key: "landlordEmail", label: "อีเมลผู้ให้เช่า" },
  { key: "tenantFirstName", label: "ชื่อผู้เช่า", required: true },
  { key: "tenantLastName", label: "นามสกุลผู้เช่า" },
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

/** Maps existing validation errors back to the section where they can be corrected. */
export function leaseAgreementFieldStep(key: string): number {
  if (
    key === "issueDate" ||
    key.startsWith("landlord") ||
    key.startsWith("tenant")
  )
    return 0;
  if (
    [
      "propertyType",
      "project",
      "houseNo",
      "propertyAddress",
      "roomType",
      "floor",
      "area",
      "termMonths",
      "termFrom",
      "termTo",
    ].includes(key)
  )
    return 1;
  if (["additionalTerms", "agentContact", "witnessSignName"].includes(key))
    return 3;
  return 2;
}

export function LeaseAgreementFields({
  value,
  onChange,
  disabled,
  errors,
  step,
  onStepChange,
}: {
  value: LeaseAgreementInput;
  onChange: (next: LeaseAgreementInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextField, string>>;
  step?: number;
  onStepChange?: (step: number) => void;
}) {
  const { theme } = useMobileTheme();
  const body = {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.textHeading,
  };
  const renderFields = (keys: TextField[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {keys.map((key) => {
        const field = FIELDS.find((item) => item.key === key)!;
        const wide =
          field.multiline ||
          /Email$|Id$|Words$/.test(key) ||
          [
            "project",
            "propertyType",
            "monthlyRent",
            "accountNo",
            "issueDate",
            "otherInitialPayment",
          ].includes(key);
        return (
          <View
            key={key}
            style={{
              flexGrow: 1,
              flexBasis: wide ? "100%" : "45%",
              minWidth: 130,
              justifyContent: "flex-end",
            }}
          >
            <MobileInput
              label={field.label}
              accessibilityLabel={field.label}
              required={field.required}
              error={errors?.[field.key]}
              value={value[field.key]}
              onChangeText={(text) => {
                const next = { ...value, [field.key]: text };
                if (
                  field.key === "landlordFirstName" ||
                  field.key === "landlordLastName"
                ) {
                  const full = [next.landlordFirstName, next.landlordLastName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(" ");
                  next.landlordName = full;
                  next.landlordSignName = full;
                }
                if (
                  field.key === "tenantFirstName" ||
                  field.key === "tenantLastName"
                ) {
                  const full = [next.tenantFirstName, next.tenantLastName]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(" ");
                  next.tenantName = full;
                  next.tenantSignName = full;
                }
                if (
                  field.key === "agentContact" &&
                  !value.witnessSignName.trim()
                )
                  next.witnessSignName = text;
                onChange(next);
              }}
              placeholder={field.placeholder}
              editable={!disabled}
              multiline={field.multiline}
              autoCapitalize={key.endsWith("Email") ? "none" : "sentences"}
              keyboardType={
                key.endsWith("Email")
                  ? "email-address"
                  : key.endsWith("Phone")
                    ? "phone-pad"
                    : /Months$|Amount$/.test(key) ||
                        [
                          "area",
                          "monthlyRent",
                          "latePenalty",
                          "rentDueDay",
                          "graceDay",
                        ].includes(key)
                      ? "decimal-pad"
                      : "default"
              }
              style={{ borderRadius: 12 }}
            />
          </View>
        );
      })}
    </View>
  );
  const card = (
    title: string,
    children: React.ReactNode,
    editStep?: number,
  ) => (
    <View
      style={{
        padding: 16,
        gap: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            ...body,
            fontFamily: tokens.typography.native.headingTh,
            fontSize: 16,
            lineHeight: 24,
            flex: 1,
          }}
        >
          {title}
        </Text>
        {editStep !== undefined && onStepChange && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`แก้ไข${title}`}
            disabled={disabled}
            onPress={() => onStepChange(editStep)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ ...body, color: theme.textSecondary }}>แก้ไข</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
  const row = (label: string, text: string) => (
    <View key={label} style={{ flexDirection: "row", gap: 12 }}>
      <Text style={{ ...body, color: theme.textSecondary, flex: 1 }}>
        {label}
      </Text>
      <Text style={{ ...body, flex: 1, textAlign: "right" }}>
        {text || "ยังไม่ระบุ"}
      </Text>
    </View>
  );
  const amount = (text: string) => {
    const number = Number(text.replace(/,/g, ""));
    return text.trim() && Number.isFinite(number)
      ? `${number.toLocaleString("th-TH")} บาท`
      : text;
  };
  const dateLabel = (text: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const date = new Date(`${text}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? text
      : date.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const shown = (index: number) => step === undefined || step === index;
  return (
    <View style={{ gap: 16 }}>
      {shown(0) && (
        <>
          {card("ข้อมูลเอกสาร", renderFields(["issueDate"]))}
          {card(
            "ผู้ให้เช่า",
            renderFields([
              "landlordFirstName",
              "landlordLastName",
              "landlordNationality",
              "landlordId",
              "landlordAddress",
              "landlordPhone",
              "landlordEmail",
            ]),
          )}
          {card(
            "ผู้เช่า",
            renderFields([
              "tenantFirstName",
              "tenantLastName",
              "tenantNationality",
              "tenantId",
              "tenantAddress",
              "tenantPhone",
              "tenantEmail",
            ]),
          )}
        </>
      )}
      {shown(1) && (
        <>
          {card(
            "ทรัพย์สินที่เช่า",
            renderFields([
              "propertyType",
              "project",
              "houseNo",
              "propertyAddress",
              "roomType",
              "floor",
              "area",
            ]),
          )}
          {card(
            "ระยะเวลาการเช่า",
            <>
              {renderFields(["termMonths", "termFrom", "termTo"])}
              {!!value.termFrom &&
                !!value.termTo &&
                !errors?.termFrom &&
                !errors?.termTo && (
                  <View
                    style={{
                      backgroundColor: tokens.colors.brand[50],
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ ...body, color: tokens.colors.onBrand }}>
                      {[
                        value.termMonths ? `${value.termMonths} เดือน` : "",
                        `${dateLabel(value.termFrom)} – ${dateLabel(value.termTo)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                )}
            </>,
          )}
        </>
      )}
      {shown(2) && (
        <>
          {card(
            "ค่าเช่ารายเดือน",
            renderFields(["monthlyRent", "monthlyRentWords"]),
          )}
          {card(
            "กำหนดชำระและเบี้ยปรับ",
            renderFields([
              "rentDueDay",
              "graceDay",
              "latePenalty",
              "latePenaltyWords",
            ]),
          )}
          {card(
            "บัญชีรับชำระ",
            renderFields([
              "bankName",
              "accountName",
              "accountNo",
              "otherPaymentMethod",
            ]),
          )}
          {card(
            "ค่าใช้จ่ายแรกเข้า",
            renderFields([
              "advanceMonths",
              "advanceAmount",
              "depositMonths",
              "depositAmount",
              "otherInitialPayment",
            ]),
          )}
        </>
      )}
      {shown(3) && (
        <>
          {card("ข้อตกลงเพิ่มเติม", renderFields(["additionalTerms"]))}
          {card("ผู้ประสานงาน / พยาน", renderFields(["agentContact"]))}
          {step === 3 && (
            <>
              {card(
                "คู่สัญญา",
                <>
                  {row("วันที่ออกเอกสาร", dateLabel(value.issueDate))}
                  {row(
                    "ผู้ให้เช่า",
                    value.landlordName ||
                      [value.landlordFirstName, value.landlordLastName]
                        .filter(Boolean)
                        .join(" "),
                  )}
                  {row(
                    "ติดต่อผู้ให้เช่า",
                    [value.landlordPhone, value.landlordEmail]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                  {row(
                    "ผู้เช่า",
                    value.tenantName ||
                      [value.tenantFirstName, value.tenantLastName]
                        .filter(Boolean)
                        .join(" "),
                  )}
                  {row(
                    "ติดต่อผู้เช่า",
                    [value.tenantPhone, value.tenantEmail]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                </>,
                0,
              )}
              {card(
                "ห้องและระยะเวลา",
                <>
                  {row(
                    "ทรัพย์สิน",
                    [value.propertyType, value.project]
                      .filter(Boolean)
                      .join(" · "),
                  )}
                  {row("บ้านเลขที่ / ห้อง", value.houseNo)}
                  {row("ที่อยู่ทรัพย์สิน", value.propertyAddress)}
                  {row("ประเภทห้อง", value.roomType)}
                  {row("ชั้น", value.floor)}
                  {row("ขนาดห้อง", value.area ? `${value.area} ตร.ม.` : "")}
                  {row(
                    "ระยะเวลาเช่า",
                    value.termMonths ? `${value.termMonths} เดือน` : "",
                  )}
                  {row("เริ่มวันที่", dateLabel(value.termFrom))}
                  {row("สิ้นสุดวันที่", dateLabel(value.termTo))}
                </>,
                1,
              )}
              {card(
                "ค่าเช่าและการชำระ",
                <>
                  {row("ค่าเช่ารายเดือน", amount(value.monthlyRent))}
                  {row(
                    "กำหนดชำระ",
                    value.rentDueDay
                      ? `วันที่ ${value.rentDueDay} ของเดือน`
                      : "",
                  )}
                  {row("ผ่อนผันถึงวันที่", value.graceDay)}
                  {row("เบี้ยปรับต่อวัน", amount(value.latePenalty))}
                  {row(
                    "ค่าเช่าล่วงหน้า",
                    [
                      amount(value.advanceAmount),
                      value.advanceMonths
                        ? `(${value.advanceMonths} เดือน)`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  )}
                  {row(
                    "เงินประกัน",
                    [
                      amount(value.depositAmount),
                      value.depositMonths
                        ? `(${value.depositMonths} เดือน)`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  )}
                  {row("รายการแรกเข้าอื่น", value.otherInitialPayment)}
                  {row(
                    "บัญชีรับชำระ",
                    [value.bankName, value.accountName, value.accountNo]
                      .filter(Boolean)
                      .join("\n"),
                  )}
                  {row("ช่องทางชำระอื่น", value.otherPaymentMethod)}
                </>,
                2,
              )}
              {card(
                "ชื่อผู้ลงนาม",
                <>
                  {row("ผู้ให้เช่า", value.landlordSignName)}
                  {row("ผู้เช่า", value.tenantSignName)}
                  {row("พยาน", value.witnessSignName)}
                  <Text
                    style={{
                      ...body,
                      color: theme.textSecondary,
                      fontSize: 12,
                      lineHeight: 18,
                    }}
                  >
                    อ้างอิงจากข้อมูลคู่สัญญาและพยาน
                  </Text>
                </>,
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
