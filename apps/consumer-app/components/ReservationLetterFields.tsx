import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, useMobileTheme } from "@nestyk/ui/native";
import type { ReservationLetterInput } from "@nestyk/types";
import { searchOwnerUsers } from "../lib/agent-contracts-api";

export function emptyReservationLetterForm(): ReservationLetterInput {
  return {
    documentNo: "",
    issueDate: "",
    tenantName: "",
    tenantFirstName: "",
    tenantLastName: "",
    tenantPhone: "",
    tenantEmail: "",
    tenantId: "",
    tenantNationality: "",
    landlordName: "",
    landlordFirstName: "",
    landlordLastName: "",
    landlordPhone: "",
    landlordEmail: "",
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
  "tenantFirstName",
  "landlordFirstName",
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
  if (!value.tenantPhone.trim()) errors.tenantPhone = REQUIRED_MESSAGE;
  if (!value.tenantEmail.trim()) errors.tenantEmail = REQUIRED_MESSAGE;
  if (!value.landlordPhone.trim()) errors.landlordPhone = REQUIRED_MESSAGE;
  if (!value.landlordEmail.trim()) errors.landlordEmail = REQUIRED_MESSAGE;
  for (const key of ["tenantEmail", "landlordEmail"] as const) {
    if (
      value[key].trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value[key].trim())
    )
      errors[key] = "รูปแบบอีเมลไม่ถูกต้อง";
  }
  return errors;
}

type PartyField = {
  key: TextKey;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  email?: boolean;
  locked?: boolean;
};

const TENANT_FIELDS: PartyField[] = [
  { key: "tenantFirstName", label: "ชื่อผู้จอง", required: true, locked: true },
  { key: "tenantLastName", label: "นามสกุลผู้จอง", locked: true },
  { key: "tenantPhone", label: "เบอร์ติดต่อผู้จอง", required: true, locked: true },
  { key: "tenantEmail", label: "อีเมลผู้จอง", email: true, required: true, locked: true },
  { key: "tenantId", label: "เลขบัตร / พาสปอร์ต / นิติบุคคล ผู้จอง", locked: true },
  { key: "tenantNationality", label: "สัญชาติผู้จอง", locked: true },
];

const LANDLORD_FIELDS: PartyField[] = [
  { key: "landlordFirstName", label: "ชื่อผู้ให้เช่า", required: true },
  { key: "landlordLastName", label: "นามสกุลผู้ให้เช่า" },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า", required: true },
  { key: "landlordEmail", label: "อีเมลผู้ให้เช่า", email: true, required: true },
  { key: "landlordId", label: "เลขบัตร / พาสปอร์ต / นิติบุคคล ผู้ให้เช่า" },
  { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
];

const AGENT_FIELDS: PartyField[] = [
  { key: "agentName", label: "ชื่อเอเจนท์" },
  { key: "companyName", label: "ชื่อบริษัท" },
  { key: "agentPhone", label: "โทรเอเจนท์" },
];

const SECTIONS: Array<{
  title: string;
  fields: PartyField[];
}> = [
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
  const [party, setParty] = useState<"tenant" | "landlord">("landlord");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerHits, setOwnerHits] = useState<
    Array<{
      id: number;
      name: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      identityNumber: string;
      nationality: string;
    }>
  >([]);
  const [ownerSearchError, setOwnerSearchError] = useState("");
  const [landlordOpen, setLandlordOpen] = useState(false);
  const searchSeq = useRef(0);
  const set = (key: TextKey, text: string) => {
    const next = { ...value, [key]: text };
    if (key === "landlordFirstName" || key === "landlordLastName") {
      const full = [next.landlordFirstName, next.landlordLastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");
      if (!value.payee || value.payee === value.landlordName) next.payee = full;
      if (!value.landlordSignName || value.landlordSignName === value.landlordName)
        next.landlordSignName = full;
      next.landlordName = full;
    }
    onChange(next);
  };
  useEffect(() => {
    const q = ownerQuery.trim();
    if (q.length < 1) {
      setOwnerHits([]);
      setOwnerSearchError("");
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      void searchOwnerUsers(q)
        .then((rows) => {
          if (seq === searchSeq.current) {
            setOwnerHits(rows);
            setOwnerSearchError("");
          }
        })
        .catch(() => {
          if (seq === searchSeq.current) {
            setOwnerHits([]);
            setOwnerSearchError("ค้นหาผู้ให้เช่าไม่สำเร็จ");
          }
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [ownerQuery]);
  const pickOwner = (owner: {
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    identityNumber: string;
    nationality: string;
  }) => {
    onChange({
      ...value,
      landlordFirstName: owner.firstName,
      landlordLastName: owner.lastName,
      landlordName: owner.name,
      landlordPhone: owner.phone,
      landlordEmail: owner.email,
      landlordId: owner.identityNumber,
      landlordNationality: owner.nationality,
      landlordSignName: owner.name,
      payee: !value.payee || value.payee === value.landlordName ? owner.name : value.payee,
    });
    setLandlordOpen(true);
    setOwnerQuery("");
    setOwnerHits([]);
  };
  const addLandlord = () => {
    onChange({
      ...value,
      landlordName: "",
      landlordFirstName: "",
      landlordLastName: "",
      landlordPhone: "",
      landlordEmail: "",
      landlordId: "",
      landlordNationality: "",
      landlordSignName:
        value.landlordSignName === value.landlordName ? "" : value.landlordSignName,
      payee: value.payee === value.landlordName ? "" : value.payee,
    });
    setLandlordOpen(true);
    setOwnerQuery("");
    setOwnerHits([]);
  };
  const partyFields = party === "tenant" ? TENANT_FIELDS : LANDLORD_FIELDS;
  const partyHasError = (fields: PartyField[]) =>
    fields.some((field) => !!errors?.[field.key]);
  useEffect(() => {
    if (!errors) return;
    const tenantError = partyHasError(TENANT_FIELDS);
    const landlordError = partyHasError(LANDLORD_FIELDS);
    if (party === "tenant" && landlordError && !tenantError) setParty("landlord");
    if (party === "landlord" && tenantError && !landlordError) setParty("tenant");
  }, [errors, party]);

  const renderField = (field: PartyField) => (
    <MobileInput
      key={field.key}
      label={field.label}
      required={field.required}
      error={errors?.[field.key]}
      value={value[field.key]}
      onChangeText={(text) => set(field.key, text)}
      placeholder={field.placeholder}
      editable={!disabled && !field.locked}
      multiline={field.multiline}
      keyboardType={field.email ? "email-address" : "default"}
      autoCapitalize={field.email ? "none" : "sentences"}
    />
  );
  const tab = (id: "tenant" | "landlord", label: string, fields: PartyField[]) => {
    const selected = party === id;
    const hasError = partyHasError(fields);
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        disabled={disabled}
        onPress={() => setParty(id)}
        style={{
          flex: 1,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? "#F8B615" : hasError ? "#DC2626" : theme.border,
          backgroundColor: selected ? "#FFFBEB" : theme.background,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            lineHeight: 21,
            color: hasError && !selected ? "#DC2626" : theme.textHeading,
            fontWeight: selected ? "600" : "400",
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 16 }}>
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
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: theme.textHeading }}>
          01 คู่สัญญา
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {tab("landlord", "ผู้ให้เช่า", LANDLORD_FIELDS)}
          {tab("tenant", "ผู้จอง", TENANT_FIELDS)}
        </View>
        {party === "tenant" ? (
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
            ดึงจากข้อมูลผู้เช่า แก้ไขไม่ได้
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <MobileInput
                  label="ค้นหาผู้ให้เช่า"
                  value={ownerQuery}
                  onChangeText={setOwnerQuery}
                  placeholder="ชื่อ อีเมล หรือเบอร์"
                  editable={!disabled}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={addLandlord}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: "#F8B615",
                  paddingHorizontal: 12,
                  marginBottom: 2,
                }}
              >
                <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: "600", color: "#211E1E" }}>
                  + เพิ่มผู้ให้เช่า
                </Text>
              </Pressable>
            </View>
            {ownerSearchError ? (
              <Text style={{ fontSize: 13, lineHeight: 20, color: "#DC2626" }}>{ownerSearchError}</Text>
            ) : null}
            {!landlordOpen && errors?.landlordFirstName ? (
              <Text style={{ fontSize: 13, lineHeight: 20, color: "#DC2626" }}>
                เลือกผู้ให้เช่าจากผลค้นหา หรือกดเพิ่มผู้ให้เช่า
              </Text>
            ) : null}
            {ownerHits.map((owner) => (
              <Pressable
                key={owner.id}
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => pickOwner(owner)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                }}
              >
                <Text style={{ fontSize: 14, lineHeight: 21, color: theme.textHeading }}>{owner.name}</Text>
                <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
                  {[owner.email, owner.phone].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            ))}
          </>
        )}
        {party === "landlord" && !landlordOpen ? null : partyFields.map(renderField)}
      </View>
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
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: "600", color: theme.textHeading }}>
          ผู้ประสานงาน
        </Text>
        {AGENT_FIELDS.map(renderField)}
      </View>
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
          {section.fields.map(renderField)}
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
