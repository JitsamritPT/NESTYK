import { ContractTypePicker } from "./ContractTypePicker";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type {
  AgreementType,
  AgentContract,
  AgentContractStatus,
  ContractCandidate,
  AgentTenant,
} from "@nestyk/types";
import {
  listAgentContracts,
  getAgentContract,
  listContractCandidates,
  createAgentContract,
} from "../lib/agent-contracts-api";

const labels: Record<AgentContractStatus, string> = {
  draft: "ฉบับร่าง",
  awaiting_signatures: "รอลงนาม",
  awaiting_agent_review: "รอตรวจสัญญา",
  awaiting_payment: "รอชำระเงิน",
  awaiting_payment_verification: "รอตรวจชำระเงิน",
  active: "มีผลแล้ว",
  cancelled: "ยกเลิก",
  expired: "หมดอายุ",
  terminated: "สิ้นสุดสัญญา",
};
const color = (status: AgentContractStatus) =>
  status === "active"
    ? "#278268"
    : status.startsWith("awaiting")
      ? "#BB7914"
      : "#788193";
const money = (value: number | null) =>
  value == null
    ? "ยังไม่ระบุ"
    : `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const date = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "ยังไม่ระบุ";
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง";

export function ContractsScreen({
  tenant,
  initialContract,
  onChanged,
}: { tenant?: AgentTenant; initialContract?: AgentContract | null; onChanged?: () => void } = {}) {
  const { theme } = useMobileTheme();
  const [contracts, setContracts] = useState<AgentContract[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [retry, setRetry] = useState(0);
  const listRequest = useRef(0);
  useEffect(() => {
    const request = ++listRequest.current;
    setLoadingList(true); setListError('');
    listAgentContracts().then(rows => {
      if (request === listRequest.current) setContracts(rows.filter(row => !tenant || row.tenantId === tenant.id));
    }).catch(e => {
      if (request === listRequest.current) setListError(message(e));
    }).finally(() => {
      if (request === listRequest.current) setLoadingList(false);
    });
    return () => { listRequest.current++; };
  }, [tenant?.id, retry]);
  const [selected, setSelected] = useState<AgentContract | null>(initialContract ?? null);
  const [agreementType, setAgreementType] = useState<AgreementType | null>(
    null,
  );
  const reservation = agreementType?.formKind === "reservation";
  const [choosingType, setChoosingType] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [candidates, setCandidates] = useState<ContractCandidate[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    monthlyRent: "",
    deposit: "",
    reservationFee: "",
    notes: "",
  });
  const accent = tokens.colors.roles.agent;
  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      accessibilityState={{ disabled: busy }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? accent : theme.background,
          borderColor: primary ? accent : theme.border,
          opacity: pressed || busy ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[s.body, { color: primary ? "#fff" : theme.textHeading }]}>
        {label}
      </Text>
    </Pressable>
  );
  const errorView = error ? (
    <Text accessibilityRole="alert" style={[s.body, { color: "#C74747" }]}>
      {error}
    </Text>
  ) : null;
  async function loadCandidates() {
    setBusy(true);
    setError("");
    try {
      setCandidates(
        tenant
          ? [
              {
                leadId: tenant.leadId,
                tenant: tenant.name,
                property: tenant.property,
                room: tenant.room,
              },
            ]
          : await listContractCandidates(),
      );
      if (tenant) setLeadId(tenant.leadId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (saving.current) return;
    if (
      !leadId ||
      !form.startDate ||
      !form.endDate ||
      (reservation
        ? !form.reservationFee.trim()
        : !form.monthlyRent.trim() || !form.deposit.trim())
    ) {
      setError("กรุณาเลือกผู้เช่าและกรอกวันที่กับจำนวนเงินให้ครบ");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const contract = await createAgentContract({
        leadId,
        startDate: form.startDate.trim(),
        endDate: form.endDate.trim(),
        agreementTypeCode: agreementType?.code,
        ...(reservation
          ? { reservationFee: Number(form.reservationFee) }
          : {
              monthlyRent: Number(form.monthlyRent),
              deposit: Number(form.deposit),
            }),
        notes: form.notes,
      });
      listRequest.current++;
      setLoadingList(false); setListError('');
      setContracts(current => [contract, ...current.filter(item => item.id !== contract.id)]);
      setCreating(false);
      setSelected(contract);
      setNotice("บันทึกฉบับร่างแล้ว");
      onChanged?.();
      setLeadId(null);
      setForm({
        startDate: "",
        endDate: "",
        monthlyRent: "",
        deposit: "",
        reservationFee: "",
        notes: "",
      });
    } catch (e) {
      setError(message(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const back = () => {
    setSelected(null);
    setCreating(false);
    setError("");
    setNotice("");
  };
  if (choosingType)
    return (
      <ContractTypePicker
        onBack={() => setChoosingType(false)}
        onSelect={(type) => {
          setAgreementType(type);
          setChoosingType(false);
          setCreating(true);
          setError("");
          void loadCandidates();
        }}
      />
    );
  if (creating)
    return (
      <View style={s.root}>
        {button("← เลือกประเภทสัญญา", () => {
          setCreating(false);
          setChoosingType(true);
          setError("");
        })}
        <Text style={[s.heading, title]}>
          สร้าง{agreementType?.nameTh || "สัญญาเช่า"}
        </Text>
        <Text style={[s.body, muted]}>
          เลือกผู้เช่าและห้องเพื่อเตรียมฉบับร่างสัญญา
        </Text>
        {errorView}
        {busy && <ActivityIndicator color={accent} />}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>ผู้เช่าและห้อง</Text>
          {candidates.map((c) => (
            <Pressable
              key={c.leadId}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ checked: leadId === c.leadId }}
              onPress={() => setLeadId(c.leadId)}
              style={[
                s.facts,
                {
                  borderWidth: 1,
                  borderColor: leadId === c.leadId ? accent : theme.border,
                },
              ]}
            >
              <Text style={[s.body, title]}>
                {leadId === c.leadId ? "● " : "○ "}
                {c.tenant}
              </Text>
              <Text style={[s.small, muted]}>
                {c.property}
                {c.room ? ` · ห้อง ${c.room}` : ""}
              </Text>
            </Pressable>
          ))}
          {!busy && !candidates.length && (
            <Text style={[s.body, muted]}>
              {error
                ? "ยังโหลดผู้เช่าไม่ได้"
                : "ยังไม่มีผู้เช่าที่พร้อมทำสัญญา ต้องมี Lead สถานะจองแล้ว พร้อมข้อมูลผู้เช่าและห้องที่คุณจัดการ"}
            </Text>
          )}
          {button("โหลดรายชื่ออีกครั้ง", () => {
            void loadCandidates();
          })}
        </View>
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>
            {reservation ? "รายละเอียดการจองห้อง" : "เงื่อนไขการเช่า"}
          </Text>
          {(
            (reservation
              ? [
                  ["startDate", "วันที่จอง (ค.ศ.)", "2026-10-01"],
                  ["endDate", "วันสิ้นสุดการจอง (ค.ศ.)", "2026-10-15"],
                  ["reservationFee", "เงินจอง (บาท)", "5000"],
                  ["notes", "เงื่อนไขการจอง / หมายเหตุ", "รายละเอียดเพิ่มเติม"],
                ]
              : [
                  ["startDate", "วันเริ่มสัญญา (ค.ศ.)", "2026-10-01"],
                  ["endDate", "วันสิ้นสุดสัญญา (ค.ศ.)", "2027-09-30"],
                  ["monthlyRent", "ค่าเช่าต่อเดือน (บาท)", "15000"],
                  ["deposit", "เงินประกัน (บาท)", "30000"],
                  ["notes", "หมายเหตุ (ไม่บังคับ)", "รายละเอียดเพิ่มเติม"],
                ]) as Array<[keyof typeof form, string, string]>
          ).map(([key, label, placeholder]) => (
            <View key={key} style={{ gap: 6 }}>
              <Text style={[s.body, title]}>{label}</Text>
              <MobileInput
                value={form[key]}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, [key]: value }))
                }
                placeholder={placeholder}
                keyboardType={
                  key === "monthlyRent" ||
                  key === "deposit" ||
                  key === "reservationFee"
                    ? "decimal-pad"
                    : "default"
                }
              />
            </View>
          ))}
          {button(
            busy ? "กำลังดำเนินการ…" : "บันทึกฉบับร่าง",
            () => {
              void save();
            },
            true,
          )}
          <Text style={[s.small, muted]}>
            บันทึกเป็นฉบับร่าง ยังไม่ส่งเอกสารให้คู่สัญญาลงนาม
          </Text>
        </View>
      </View>
    );
  if (selected)
    return (
      <View style={s.root}>
        {button("← กลับไปหน้าสัญญา", back)}
        {!!notice && (
          <Text accessibilityRole="alert" style={[s.body, { color: accent }]}>
            {notice}
          </Text>
        )}
        <View style={[s.card, card]}>
          <Text style={[s.eyebrow, { color: accent }]}>
            E-CONTRACT / {selected.contractNo}
          </Text>
          <Text style={[s.heading, title]}>{selected.property}</Text>
          <Text style={[s.body, muted]}>
            {selected.tenant}
            {selected.room ? ` · ห้อง ${selected.room}` : ""}
          </Text>
          <Text style={[s.body, { color: color(selected.status) }]}>
            {labels[selected.status]}
          </Text>
          <View style={[s.divider, { borderColor: theme.border }]} />
          <Text style={[s.small, muted]}>
            {selected.agreementTypeName} ·{" "}
            {selected.formKind === "reservation"
              ? "เงินจอง"
              : "ค่าเช่าต่อเดือน"}
          </Text>
          <Text style={[s.heading, title]}>
            {money(
              selected.formKind === "reservation"
                ? selected.reservationFee
                : selected.monthlyRent,
            )}
          </Text>
          {selected.formKind !== "reservation" && (
            <Text style={[s.body, muted]}>
              เงินประกัน {money(selected.deposit)}
            </Text>
          )}
          <Text style={[s.body, muted]}>
            {date(selected.startDate)} – {date(selected.endDate)}
          </Text>
          {!!selected.notes && (
            <Text style={[s.body, muted]}>{selected.notes}</Text>
          )}
        </View>
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>การลงนามของคู่สัญญา</Text>
          {(
            [
              ["ผู้ให้เช่า", selected.ownerSignedAt],
              ["ผู้เช่า", selected.tenantSignedAt],
            ] as const
          ).map(([party, signed]) => (
            <View key={party} style={s.row}>
              <Text style={[s.body, title]}>{party}</Text>
              <Text style={[s.small, muted]}>
                {signed
                  ? `✓ ${new Date(signed).toLocaleString("th-TH")}`
                  : selected.status === "draft"
                    ? "ยังไม่ส่งลงนาม"
                    : "ยังไม่มีข้อมูลการลงนาม"}
              </Text>
            </View>
          ))}
          <Text style={[s.small, muted]}>
            การส่งเอกสารและลงนามออนไลน์ยังไม่เปิดใช้งาน
          </Text>
        </View>
      </View>
    );
  return (
    <View style={s.root}>
      <View
        style={[
          s.hero,
          { backgroundColor: tenant ? theme.surface : "#172F2B" },
        ]}
      >
        <Text style={[s.eyebrow, { color: tenant ? accent : "#AAD8BD" }]}>
          NESTYK E-CONTRACT
        </Text>
        <Text
          style={[s.heroTitle, { color: tenant ? theme.textHeading : "#fff" }]}
        >
          {tenant ? "สัญญาของผู้เช่า" : "ทุกสัญญา จัดการในที่เดียว"}
        </Text>
        <Text
          style={[s.body, { color: tenant ? theme.textSecondary : "#C6D9D0" }]}
        >
          เตรียมสัญญาเช่า และติดตามสถานะเอกสาร
        </Text>
        {button(
          "＋ สร้างสัญญา",
          () => {
            setChoosingType(true);
            setNotice("");
            setError("");
          },
          true,
        )}
      </View>
      {errorView}
      <Text style={[s.subtitle, title]}>สัญญาที่สร้างแล้ว{!loadingList && !listError ? ` (${contracts.length})` : ''}</Text>
      {(loadingList || busy) && <ActivityIndicator color={accent} />}
      {!!listError && <View style={[s.card, card]}>
        <Text accessibilityRole="alert" style={[s.body, muted]}>{listError}</Text>
        {button('ลองโหลดอีกครั้ง', () => setRetry(value => value + 1))}
      </View>}
      {!loadingList && !listError && contracts.map(contract => <Pressable
        key={contract.id}
        accessibilityRole="button"
        accessibilityLabel={`ดู${contract.agreementTypeName} ${contract.contractNo}`}
        disabled={busy}
        onPress={async () => {
          setBusy(true); setError(''); setNotice('');
          try {
            const latest = await getAgentContract(contract.id);
            setSelected(latest);
            setContracts(current => current.map(item => item.id === latest.id ? latest : item));
          } catch (e) { setError(message(e)); }
          finally { setBusy(false); }
        }}
        style={({ pressed }) => [s.card, card, { opacity: pressed || busy ? 0.65 : 1 }]}
      >
        <View style={s.row}>
          <Text style={[s.subtitle, title]}>{contract.agreementTypeName}</Text>
          <Text style={[s.badge, { color: color(contract.status), backgroundColor: `${color(contract.status)}15` }]}>{labels[contract.status]}</Text>
        </View>
        <Text style={[s.small, muted]}>{contract.contractNo}</Text>
        <Text style={[s.body, title]}>{contract.property}{contract.room ? ` · ห้อง ${contract.room}` : ''}</Text>
        <Text style={[s.small, muted]}>{date(contract.startDate)} – {date(contract.endDate)}</Text>
        <View style={s.row}>
          <Text style={[s.body, title]}>{contract.formKind === 'reservation' ? `เงินจอง ${money(contract.reservationFee)}` : `${money(contract.monthlyRent)} / เดือน`}</Text>
          <Text style={[s.small, { color: accent }]}>ดูสัญญา →</Text>
        </View>
      </Pressable>)}
      {!loadingList && !listError && !contracts.length && <Text style={[s.body, muted]}>ยังไม่มีสัญญาที่สร้างไว้</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  root: { gap: 16, paddingBottom: 24 },
  hero: { borderRadius: 22, padding: 24, gap: 12 },
  heroTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 25,
    lineHeight: 37,
  },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 23,
  },
  small: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 20,
  },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  card: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, padding: 12, borderWidth: 1, borderRadius: 16, gap: 3 },
  count: { fontSize: 28, fontFamily: tokens.typography.native.headingTh },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  badge: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  facts: { borderRadius: 10, padding: 12, gap: 3 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  divider: { borderTopWidth: 1, marginVertical: 6 },
});
