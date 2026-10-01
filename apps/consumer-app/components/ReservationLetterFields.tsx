import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
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
  if (
    value.termFrom.trim() &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value.termFrom.trim())
  )
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
  {
    key: "tenantPhone",
    label: "เบอร์ติดต่อผู้จอง",
    required: true,
    locked: true,
  },
  {
    key: "tenantEmail",
    label: "อีเมลผู้จอง",
    email: true,
    required: true,
    locked: true,
  },
  {
    key: "tenantId",
    label: "เลขบัตร / พาสปอร์ต / นิติบุคคล ผู้จอง",
    locked: true,
  },
  { key: "tenantNationality", label: "สัญชาติผู้จอง", locked: true },
];

const LANDLORD_FIELDS: PartyField[] = [
  { key: "landlordFirstName", label: "ชื่อผู้ให้เช่า", required: true },
  { key: "landlordLastName", label: "นามสกุลผู้ให้เช่า" },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า", required: true },
  {
    key: "landlordEmail",
    label: "อีเมลผู้ให้เช่า",
    email: true,
    required: true,
  },
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
  value: "transfer" | "cash" | "credit";
  label: string;
}> = [
  { value: "transfer", label: "โอน" },
  { value: "cash", label: "เงินสด" },
  { value: "credit", label: "บัตรเครดิต" },
];

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];

function readThaiNumber(n: number): string {
  if (n >= 1000000)
    return (
      readThaiNumber(Math.floor(n / 1000000)) +
      "ล้าน" +
      (n % 1000000 === 1 ? "เอ็ด" : n % 1000000 ? readThaiNumber(n % 1000000) : "")
    );
  const chars = String(n).split("").map(Number);
  return chars
    .map((digit, index) => {
      const pos = chars.length - index - 1;
      if (!digit) return "";
      if (pos === 1) return (digit === 1 ? "" : digit === 2 ? "ยี่" : THAI_DIGITS[digit]) + "สิบ";
      return (
        (pos === 0 && digit === 1 && n > 10 ? "เอ็ด" : THAI_DIGITS[digit]) +
        ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"][pos]
      );
    })
    .join("");
}

/** Same wording the reservation PDF stamps into the amount blanks. */
function bahtWords(raw: string) {
  const clean = raw.replace(/[,\s]/g, "").trim();
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return "";
  const cents = Math.round(Number(clean) * 100);
  if (!Number.isFinite(cents)) return "";
  return (
    (Math.floor(cents / 100) ? readThaiNumber(Math.floor(cents / 100)) : "ศูนย์") +
    "บาท" +
    (cents % 100 ? readThaiNumber(cents % 100) + "สตางค์" : "ถ้วน")
  );
}

export function ReservationLetterFields({
  value,
  onChange,
  disabled,
  errors,
  step = 0,
  onStepChange,
}: {
  step?: number;
  onStepChange?: (step: number) => void;
  value: ReservationLetterInput;
  onChange: (next: ReservationLetterInput) => void;
  disabled?: boolean;
  errors?: Partial<Record<TextKey, string>>;
}) {
  const { theme } = useMobileTheme();
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
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
  const [landlordOpen, setLandlordOpen] = useState(!!value.landlordFirstName);
  const searchSeq = useRef(0);
  const set = (key: TextKey, text: string) => {
    const next = { ...value, [key]: text };
    if (key === "landlordFirstName" || key === "landlordLastName") {
      const full = [next.landlordFirstName, next.landlordLastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");
      if (!value.payee || value.payee === value.landlordName) next.payee = full;
      if (
        !value.landlordSignName ||
        value.landlordSignName === value.landlordName
      )
        next.landlordSignName = full;
      next.landlordName = full;
    }
    onChange(next);
  };
  useEffect(() => {
    const seq = ++searchSeq.current;
    const q = ownerQuery.trim();
    if (q.length < 1) {
      setOwnerHits([]);
      setOwnerSearchError("");
      return;
    }
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
    return () => {
      clearTimeout(timer);
      searchSeq.current++;
    };
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
      payee:
        !value.payee || value.payee === value.landlordName
          ? owner.name
          : value.payee,
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
        value.landlordSignName === value.landlordName
          ? ""
          : value.landlordSignName,
      payee: value.payee === value.landlordName ? "" : value.payee,
    });
    setLandlordOpen(true);
    setOwnerQuery("");
    setOwnerHits([]);
  };
  useEffect(() => {
    if (value.landlordFirstName || errors?.landlordFirstName)
      setLandlordOpen(true);
  }, [value.landlordFirstName, errors?.landlordFirstName]);

  const renderField = (field: PartyField) => (
    <View
      key={field.key}
      style={{
        flexGrow: 1,
        flexBasis:
          field.multiline || field.email || field.key.endsWith("Id")
            ? "100%"
            : "45%",
        minWidth: 130,
      }}
    >
      <MobileInput
        label={field.label}
        accessibilityLabel={field.label}
        required={field.required}
        error={errors?.[field.key]}
        value={value[field.key]}
        onChangeText={(text) => set(field.key, text)}
        placeholder={field.placeholder}
        editable={!disabled && !field.locked}
        multiline={field.multiline}
        keyboardType={
          field.email
            ? "email-address"
            : /Phone$/.test(field.key)
              ? "phone-pad"
              : /Amount$|Months$|monthlyRent|reservationPayment|balanceDue|^area$|^beds$|^baths$/.test(
                    field.key,
                  )
                ? "decimal-pad"
                : "default"
        }
        autoCapitalize={field.email ? "none" : "sentences"}
        style={{ borderRadius: 12 }}
      />
    </View>
  );
  const fields = (items: PartyField[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map(renderField)}
    </View>
  );
  const heading = {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: theme.textHeading,
  };
  const card = (
    label: string,
    children: React.ReactNode,
    editStep?: number,
  ) => (
    <View
      style={{
        gap: 14,
        padding: 16,
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
        }}
      >
        <Text style={heading}>{label}</Text>
        {editStep !== undefined && (
          <Pressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`แก้ไข${label}`}
            onPress={() => onStepChange?.(editStep)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ color: theme.textSecondary }}>แก้ไข</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
  const amount = (raw: string) => {
    if (!raw.trim()) return "ยังไม่ระบุ";
    const number = Number(raw.replace(/,/g, ""));
    return Number.isFinite(number)
      ? `${number.toLocaleString("th-TH")} บาท`
      : raw;
  };
  const row = (label: string, text: string) => (
    <View
      key={label}
      style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}
    >
      <Text style={{ ...muted, flex: 1, lineHeight: 22 }}>{label}</Text>
      <Text style={{ ...title, flex: 1, textAlign: "right", lineHeight: 22 }}>
        {text || "ยังไม่ระบุ"}
      </Text>
    </View>
  );
  const chips = (children: React.ReactNode) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {children}
    </View>
  );
  const chipStyle = (selected: boolean) => ({
    minHeight: 44,
    justifyContent: "center" as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: selected ? tokens.colors.brand[500] : theme.border,
    backgroundColor: selected ? tokens.colors.brand[50] : theme.background,
  });
  const propertyFields = SECTIONS[0].fields;
  const paymentFields = SECTIONS[1].fields;
  return (
    <View style={{ gap: 16 }}>
      {step === 0 && (
        <>
          {card(
            "ข้อมูลผู้จอง",
            <>
              <Text style={muted}>ดึงจากข้อมูลผู้เช่า · แก้ไขไม่ได้</Text>
              {fields(TENANT_FIELDS)}
            </>,
          )}
          {card(
            "ผู้ให้เช่า",
            <>
              <MobileInput
                label="ค้นหาผู้ให้เช่า"
                value={ownerQuery}
                onChangeText={setOwnerQuery}
                placeholder="ชื่อ อีเมล หรือเบอร์"
                editable={!disabled}
              />
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={addLandlord}
                style={chipStyle(false)}
              >
                <Text style={title}>+ เพิ่มผู้ให้เช่า</Text>
              </Pressable>
              {!!ownerSearchError && (
                <Text style={{ color: tokens.colors.error }}>
                  {ownerSearchError}
                </Text>
              )}
              {ownerHits.map((owner) => (
                <Pressable
                  key={owner.id}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => pickOwner(owner)}
                  style={chipStyle(false)}
                >
                  <Text style={title}>{owner.name}</Text>
                  <Text style={muted}>
                    {[owner.email, owner.phone].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              ))}
              {landlordOpen ? (
                fields(LANDLORD_FIELDS)
              ) : (
                <Text style={muted}>
                  เลือกจากผลค้นหา หรือเพิ่มผู้ให้เช่าใหม่
                </Text>
              )}
            </>,
          )}
          {card("ผู้ประสานงาน", fields(AGENT_FIELDS))}
        </>
      )}
      {step === 1 && (
        <>
          <Text style={{ ...muted, lineHeight: 22 }}>
            เลขเอกสาร: {value.documentNo || "ระบบกำหนด"} · วันที่จอง:{" "}
            {reservationIssueDate(value.issueDate)}
          </Text>
          {card(
            "ข้อมูลทรัพย์สิน",
            fields(
              propertyFields
                .slice(0, 7)
                .map((field) => ({
                  ...field,
                  label:
                    field.key === "beds"
                      ? "ห้องนอน"
                      : field.key === "baths"
                        ? "ห้องน้ำ"
                        : field.label,
                })),
            ),
          )}
          {card("ระยะเวลาการเช่า", fields(propertyFields.slice(7)))}
        </>
      )}
      {step === 2 && (
        <>
          {card(
            "ค่าเช่ารายเดือน",
            <>
              {fields(paymentFields.slice(0, 1))}
              <Text style={{ ...muted, lineHeight: 22 }}>
                ({bahtWords(value.monthlyRent) || "……………………บาทถ้วน"})
              </Text>
            </>,
          )}
          {card(
            "ค่าเช่าล่วงหน้า",
            <>
              {fields(paymentFields.slice(1, 3))}
              <Text style={{ ...muted, lineHeight: 22 }}>* ใส่วันจอง</Text>
            </>,
          )}
          {card(
            "เงินประกัน",
            <>
              {fields(paymentFields.slice(3, 5))}
              <Text style={{ ...muted, lineHeight: 22 }}>* ใส่วันทำสัญญา</Text>
            </>,
          )}
          {card(
            "เงินจอง",
            <>
              {fields(paymentFields.slice(5, 6))}
              <Text style={{ ...muted, lineHeight: 22 }}>
                ตัวอักษร {bahtWords(value.reservationPayment) || "……………………"}
              </Text>
              <Text style={title}>นำไปหัก</Text>
              {chips(
                (
                  [
                    ["applyToAdvance", "ค่าเช่าล่วงหน้า"],
                    ["applyToDeposit", "เงินประกัน"],
                  ] as const
                ).map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: value[key] }}
                    disabled={disabled}
                    onPress={() => onChange({ ...value, [key]: !value[key] })}
                    style={chipStyle(value[key])}
                  >
                    <Text
                      style={{
                        color: value[key]
                          ? tokens.colors.onBrand
                          : theme.textHeading,
                        lineHeight: 22,
                      }}
                    >
                      {value[key] ? "✓ " : "□ "}
                      {label}
                    </Text>
                  </Pressable>
                )),
              )}
              {fields([paymentFields[6]])}
            </>,
          )}
          {card("ผู้รับเงิน", fields(paymentFields.slice(7, 8)))}
          {card(
            "ช่องทางชำระ",
            <>
              {chips(
                PAYMENT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: value.paymentMethod === option.value,
                    }}
                    disabled={disabled}
                    onPress={() =>
                      onChange({
                        ...value,
                        paymentMethod:
                          value.paymentMethod === option.value ? "" : option.value,
                      })
                    }
                    style={chipStyle(value.paymentMethod === option.value)}
                  >
                    <Text
                      style={{
                        color:
                          value.paymentMethod === option.value
                            ? tokens.colors.onBrand
                            : theme.textHeading,
                        lineHeight: 22,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                )),
              )}
              {fields(
                paymentFields.slice(8, 9).map((field) => ({
                  ...field,
                  label: "ธนาคาร ชื่อและเลขบัญชี",
                  multiline: true,
                })),
              )}
            </>,
          )}
        </>
      )}
      {step === 3 && (
        <>
          {card(
            "คู่สัญญา",
            <>
              {row(
                "ผู้จอง",
                [value.tenantFirstName, value.tenantLastName]
                  .filter(Boolean)
                  .join(" ") || value.tenantName,
              )}
              {row(
                "ติดต่อผู้จอง",
                [value.tenantPhone, value.tenantEmail]
                  .filter(Boolean)
                  .join("\n"),
              )}
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
                "ผู้ประสานงาน",
                [value.agentName, value.companyName, value.agentPhone]
                  .filter(Boolean)
                  .join("\n"),
              )}
            </>,
            0,
          )}
          {card(
            "ห้องและสัญญา",
            <>
              {row("โครงการ", value.project)}
              {row("ที่อยู่", value.address)}
              {row(
                "ห้อง / ชั้น",
                [value.unitNo, value.floor].filter(Boolean).join(" / "),
              )}
              {row(
                "พื้นที่ / นอน / น้ำ",
                [
                  value.area ? `${value.area} ตร.ม.` : "—",
                  value.beds || "—",
                  value.baths || "—",
                ].join(" / "),
              )}
              {row(
                "ระยะเวลา",
                value.termMonths ? `${value.termMonths} เดือน` : "",
              )}
              {row("วันที่เข้าอยู่", value.termFrom)}
              {row("วันสิ้นสุด", value.termTo)}
            </>,
            1,
          )}
          {card(
            "จำนวนเงิน",
            <>
              {row("ค่าเช่ารายเดือน", amount(value.monthlyRent))}
              {row(
                `ค่าเช่าล่วงหน้า${value.advanceMonths ? ` (${value.advanceMonths} เดือน)` : ""}`,
                amount(value.advanceAmount),
              )}
              {row(
                `เงินประกัน${value.depositMonths ? ` (${value.depositMonths} เดือน)` : ""}`,
                amount(value.depositAmount),
              )}
              {row("เงินจอง", amount(value.reservationPayment))}
              {row(
                "นำไปหัก",
                [
                  value.applyToAdvance && "ค่าเช่าล่วงหน้า",
                  value.applyToDeposit && "เงินประกัน",
                ]
                  .filter(Boolean)
                  .join(" / "),
              )}
              {row("ยอดคงเหลือ", amount(value.balanceDue))}
              {row(
                "วิธีชำระ",
                PAYMENT_OPTIONS.find(
                  (option) => option.value === value.paymentMethod,
                )?.label || value.paymentMethod,
              )}
              {row("ผู้รับเงิน", value.payee)}
              {row("บัญชีรับเงิน", value.bankAccount)}
            </>,
            2,
          )}
          {card("ชื่อใต้ลายเซ็น", fields(paymentFields.slice(9)))}
          <Text style={{ ...muted, lineHeight: 20 }}>
            เงื่อนไขการจองและคืนเงินอยู่ในแม่แบบ PDF แล้ว
          </Text>
        </>
      )}
    </View>
  );
}
