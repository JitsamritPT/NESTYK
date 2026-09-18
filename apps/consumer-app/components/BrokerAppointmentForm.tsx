import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import {
  MobileBottomSheet,
  MobileButton,
  MobileInput,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgentContract,
  AgreementAttachmentChecklist,
  BrokerAppointmentInput,
} from "@nestyk/types";
import {
  generateBrokerAppointment,
  getBrokerAppointmentDefaults,
} from "../lib/agent-contracts-api";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";

type TextField = Exclude<
  keyof BrokerAppointmentInput,
  "landlordSignaturePng" | "brokerSignaturePng"
>;

type SignParty = "landlord" | "broker";

const FIELDS: Array<{
  key: TextField;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}> = [
  { key: "documentNo", label: "เลขที่ *", required: true },
  { key: "issueDate", label: "วันที่ * (YYYY-MM-DD)", required: true },
  { key: "landlordName", label: "ผู้ให้เช่า *", required: true },
  { key: "landlordNationality", label: "สัญชาติผู้ให้เช่า" },
  { key: "landlordId", label: "เลขบัตร / พาสปอร์ตผู้ให้เช่า" },
  { key: "landlordAddress", label: "ที่อยู่ผู้ให้เช่า", multiline: true },
  { key: "landlordPhone", label: "เบอร์ติดต่อผู้ให้เช่า" },
  { key: "brokerCompany", label: "บริษัทนายหน้า *", required: true },
  { key: "brokerContact", label: "ผู้ติดต่อนายหน้า *", required: true },
  { key: "brokerNationality", label: "สัญชาตินายหน้า" },
  { key: "brokerId", label: "เลขบัตร / พาสปอร์ตนายหน้า" },
  { key: "brokerPhone", label: "เบอร์ติดต่อนายหน้า" },
  { key: "brokerAddress", label: "ที่อยู่นายหน้า", multiline: true },
  {
    key: "propertyLine",
    label: "โครงการ / ห้อง / ที่อยู่ *",
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

const SIGN_PARTIES: Array<{
  key: SignParty;
  title: string;
  pngKey: "landlordSignaturePng" | "brokerSignaturePng";
}> = [
  {
    key: "landlord",
    title: "ผู้ให้เช่า / Landlord",
    pngKey: "landlordSignaturePng",
  },
  {
    key: "broker",
    title: "นายหน้า / Broker",
    pngKey: "brokerSignaturePng",
  },
];

export function BrokerAppointmentForm({
  contractId: fixedContractId,
  hosts,
  onBack,
  onCreated,
}: {
  /** When opened from a reservation detail, the host is fixed. */
  contractId?: number;
  /** When opened from the create menu, user picks a reservation host. */
  hosts?: AgentContract[];
  onBack: () => void;
  onCreated: (
    value: AgreementAttachmentChecklist,
    hostContractId: number,
  ) => void;
}) {
  const { theme } = useMobileTheme();
  const needsHostPick = fixedContractId == null;
  const [hostId, setHostId] = useState<number | null>(fixedContractId ?? null);
  const [form, setForm] = useState<BrokerAppointmentInput | null>(null);
  const [error, setError] = useState("");
  const [signError, setSignError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [signingParty, setSigningParty] = useState<SignParty | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);
  const saving = useRef(false);
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const contractId = fixedContractId ?? hostId;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (signingParty) {
        setSigningParty(null);
        setSignError("");
        return true;
      }
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, signingParty]);

  useEffect(() => {
    if (!signingParty) return;
    const id = requestAnimationFrame(() => padRef.current?.reinitialize?.());
    return () => cancelAnimationFrame(id);
  }, [signingParty, signPadKey]);

  useEffect(() => {
    if (contractId == null) {
      setForm(null);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    getBrokerAppointmentDefaults(contractId)
      .then((data) => {
        if (active)
          setForm({
            ...data,
            landlordSignaturePng: data.landlordSignaturePng ?? "",
            brokerSignaturePng: data.brokerSignaturePng ?? "",
          });
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "โหลดฟอร์มไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, retry]);

  function openSignSheet(party: SignParty) {
    if (busy || saving.current) return;
    setSignError("");
    setSignPadKey((key) => key + 1);
    setSigningParty(party);
  }

  function clearSignature(party: SignParty) {
    const pngKey =
      party === "landlord" ? "landlordSignaturePng" : "brokerSignaturePng";
    setForm((current) =>
      current ? { ...current, [pngKey]: "" } : current,
    );
  }

  async function save() {
    if (!form || contractId == null || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(await generateBrokerAppointment(contractId, form), contractId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างเอกสารไม่สำเร็จ");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const signingMeta = SIGN_PARTIES.find((row) => row.key === signingParty);
  const hostList = hosts ?? [];

  return (
    <View style={{ gap: 14, paddingBottom: 28 }}>
      <MobileButton variant="outline" disabled={busy} onPress={onBack}>
        ← กลับ
      </MobileButton>
      <Text
        style={{
          fontSize: 18,
          lineHeight: 28,
          color: theme.textHeading,
          fontWeight: "600",
        }}
      >
        สร้างสัญญาแต่งตั้งนายหน้า
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
        กรอกข้อมูลแล้วระบบจะใส่ลงในแม่แบบ PDF อัตโนมัติ
      </Text>

      {needsHostPick && (
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 14, lineHeight: 22, fontWeight: "600" }, title]}>
            ผูกกับหนังสือจอง *
          </Text>
          <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
            เลือกหนังสือจองเพื่อดึงข้อมูลตั้งต้นและบันทึกเอกสาร
          </Text>
          {!hostList.length ? (
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              ยังไม่มีหนังสือจองที่ใช้ได้ — สร้างหนังสือจองก่อน
            </Text>
          ) : (
            hostList.map((host) => {
              const selected = hostId === host.id;
              return (
                <Pressable
                  key={host.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => setHostId(host.id)}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: selected ? "#F8B615" : theme.border,
                    backgroundColor: selected ? "#FFF8E7" : theme.surface,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
                    opacity: pressed || busy ? 0.7 : 1,
                  })}
                >
                  <Text style={[{ fontSize: 15, lineHeight: 24 }, title]}>
                    {host.contractNo}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {host.property}
                    {host.room ? ` · ห้อง ${host.room}` : ""}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {loading && <ActivityIndicator color={theme.textHeading} />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
          {error}
        </Text>
      )}
      {!loading && !!error && contractId != null && !form && (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          ลองโหลดอีกครั้ง
        </MobileButton>
      )}
      {form &&
        FIELDS.map((field) => (
          <View key={field.key} style={{ gap: 6 }}>
            <Text style={[{ fontSize: 14, lineHeight: 22 }, title]}>
              {field.label}
            </Text>
            <MobileInput
              accessibilityLabel={field.label}
              value={form[field.key]}
              editable={!busy}
              multiline={field.multiline}
              numberOfLines={field.multiline ? 3 : 1}
              textAlignVertical={field.multiline ? "top" : "center"}
              style={
                field.multiline
                  ? { minHeight: 72, paddingTop: 11, paddingBottom: 11 }
                  : undefined
              }
              onChangeText={(value) =>
                setForm((current) =>
                  current ? { ...current, [field.key]: value } : current,
                )
              }
              placeholder={field.placeholder}
              maxLength={field.multiline ? 240 : 160}
            />
          </View>
        ))}
      {form && (
        <>
          <Text style={[{ fontSize: 12, lineHeight: 18 }, muted]}>
            ค่าคอมเลือกอย่างใดอย่างหนึ่ง: จำนวนเงิน (บาท) หรือจำนวนเดือนของค่าเช่า
          </Text>
          <View
            style={{
              gap: 14,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <Text
              style={[
                { fontSize: 16, lineHeight: 26, fontWeight: "600" },
                title,
              ]}
            >
              ลายเซ็น
            </Text>
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              ไม่บังคับ — กดลงนามเพื่อวาดลายเซ็นใส่ใน PDF
            </Text>
            {SIGN_PARTIES.map((party) => {
              const signed = !!form[party.pngKey];
              return (
                <View
                  key={party.key}
                  style={{
                    gap: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    backgroundColor: theme.surface,
                  }}
                >
                  <Text style={[{ fontSize: 15, lineHeight: 24 }, title]}>
                    {party.title}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {signed ? "✓ บันทึกลายเซ็นแล้ว" : "ยังไม่ได้ลงนาม"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    <MobileButton
                      disabled={busy}
                      onPress={() => openSignSheet(party.key)}
                    >
                      {signed ? "แก้ไขลายเซ็น" : "ลงนาม"}
                    </MobileButton>
                    {signed ? (
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        onPress={() => clearSignature(party.key)}
                      >
                        ล้างลายเซ็น
                      </MobileButton>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          <MobileButton
            disabled={busy || contractId == null}
            onPress={() => {
              void save();
            }}
          >
            {busy ? "กำลังสร้าง…" : "สร้างเอกสาร PDF"}
          </MobileButton>
        </>
      )}

      <MobileBottomSheet
        visible={signingParty != null}
        onClose={() => {
          if (busy) return;
          setSigningParty(null);
          setSignError("");
        }}
        maxHeight="90%"
      >
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text
            style={{
              fontSize: 18,
              lineHeight: 28,
              fontWeight: "600",
              color: theme.textHeading,
            }}
          >
            {signingMeta ? `ลงนาม — ${signingMeta.title}` : "ลงนาม"}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
            วาดลายเซ็นในกรอบ แล้วกดยืนยัน
          </Text>
          {!!signError && (
            <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
              {signError}
            </Text>
          )}
          {signingParty ? (
            <ContractSignaturePad
              key={`${signPadKey}-${signingParty}`}
              ref={padRef}
              onOK={(image) => {
                const pngKey =
                  signingParty === "landlord"
                    ? "landlordSignaturePng"
                    : "brokerSignaturePng";
                setForm((current) =>
                  current ? { ...current, [pngKey]: image } : current,
                );
                setSigningParty(null);
                setSignError("");
              }}
              onEmpty={() => setSignError("กรุณาวาดลายเซ็นก่อนยืนยัน")}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() => padRef.current?.clearSignature()}
            >
              ล้างลายเซ็น
            </MobileButton>
            <MobileButton
              disabled={busy}
              onPress={() => padRef.current?.readSignature()}
            >
              ยืนยันลายเซ็น
            </MobileButton>
          </View>
        </View>
      </MobileBottomSheet>
    </View>
  );
}
