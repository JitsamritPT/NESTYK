import { ContractTypePicker } from "./ContractTypePicker";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import type {
  AgreementType,
  AgentContract,
  AgentContractDocumentKind,
  AgentContractSignParty,
  AgentContractStatus,
  ContractCandidate,
  AgentTenant,
} from "@nestyk/types";
import {
  listAgentContracts,
  getAgentContract,
  listContractCandidates,
  createAgentContract,
  uploadAgentContractDocument,
  signAgentContract,
  previewAgentReservation,
  generateAgentReservation,
} from "../lib/agent-contracts-api";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";

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
}: {
  tenant?: AgentTenant;
  initialContract?: AgentContract | null;
  onChanged?: () => void;
} = {}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const docs = t.agent.contracts;
  const [contracts, setContracts] = useState<AgentContract[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [retry, setRetry] = useState(0);
  const listRequest = useRef(0);
  useEffect(() => {
    const request = ++listRequest.current;
    setLoadingList(true);
    setListError("");
    listAgentContracts()
      .then((rows) => {
        if (request === listRequest.current)
          setContracts(
            rows.filter((row) => !tenant || row.tenantId === tenant.id),
          );
      })
      .catch((e) => {
        if (request === listRequest.current) setListError(message(e));
      })
      .finally(() => {
        if (request === listRequest.current) setLoadingList(false);
      });
    return () => {
      listRequest.current++;
    };
  }, [tenant?.id, retry]);
  const [selected, setSelected] = useState<AgentContract | null>(
    initialContract ?? null,
  );
  const [agreementType, setAgreementType] = useState<AgreementType | null>(
    null,
  );
  const reservation = agreementType?.formKind === "reservation";
  const [choosingType, setChoosingType] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingKind, setUploadingKind] =
    useState<AgentContractDocumentKind | null>(null);
  const [pickKind, setPickKind] = useState<AgentContractDocumentKind | null>(
    null,
  );
  const [signParties, setSignParties] = useState<
    AgentContractSignParty[] | null
  >(null);
  const [viewSignature, setViewSignature] = useState<{
    label: string;
    url: string;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    name: string;
    url: string;
    kind: AgentContractDocumentKind;
  } | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);
  const saving = useRef(false);
  const signing = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [candidates, setCandidates] = useState<ContractCandidate[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    moveInDate: "",
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
  useEffect(() => {
    if (!initialContract?.id) return;
    let cancelled = false;
    getAgentContract(initialContract.id)
      .then((row) => {
        if (!cancelled) setSelected(row);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialContract?.id]);
  const documentSlots = (
    contract: AgentContract,
  ): Array<{
    kind: AgentContractDocumentKind;
    name: string;
    url: string | null;
  }> => [
    {
      kind: "reservation_letter",
      name: docs.reservationLetter,
      url: contract.reservationLetterUrl,
    },
    { kind: "invoice", name: docs.invoice, url: contract.invoiceUrl },
    { kind: "receipt", name: docs.receipt, url: contract.receiptUrl },
  ];
  function openDocumentPreview(
    name: string,
    url: string,
    kind: AgentContractDocumentKind,
  ) {
    setError("");
    setPreviewDoc({ name, url, kind });
  }
  function replaceFromPreview() {
    if (!previewDoc || previewDoc.kind === "reservation_letter") return;
    const kind = previewDoc.kind;
    setPreviewDoc(null);
    setTimeout(() => setPickKind(kind), 280);
  }
  async function openDocumentExternally(url: string) {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError(docs.previewError);
    }
  }
  async function pickAndUpload(
    kind: AgentContractDocumentKind,
    source: "documents" | "photos",
  ) {
    if (!selected || uploadingKind || kind === "reservation_letter") return;
    let picked: {
      uri: string;
      name: string;
      mimeType: string;
      file?: File;
    } | null = null;
    if (source === "photos") {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(docs.photosPermission);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.8,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      picked = {
        uri: asset.uri,
        name: asset.fileName || `${kind}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        file: "file" in asset ? asset.file : undefined,
      };
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;
      picked = {
        uri: asset.uri,
        name: asset.name || `${kind}.pdf`,
        mimeType: asset.mimeType || "application/octet-stream",
        file: "file" in asset ? asset.file : undefined,
      };
    }
    setUploadingKind(kind);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latest = await uploadAgentContractDocument(
        selected.id,
        kind,
        picked,
      );
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      setNotice(docs.uploadSuccess);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : docs.uploadError);
    } finally {
      setUploadingKind(null);
      setBusy(false);
    }
  }
  function choosePickSource(source: "documents" | "photos") {
    const kind = pickKind;
    setPickKind(null);
    if (!kind) return;
    setTimeout(() => {
      void pickAndUpload(kind, source);
    }, 280);
  }
  const partyMeta = (
    contract: AgentContract,
  ): Array<{
    key: AgentContractSignParty;
    label: string;
    signed: string | null;
    signatureUrl: string | null;
  }> => [
    {
      key: "owner",
      label: docs.owner,
      signed: contract.ownerSignedAt,
      signatureUrl: contract.ownerSignatureUrl,
    },
    {
      key: "tenant",
      label: docs.tenant,
      signed: contract.tenantSignedAt,
      signatureUrl: contract.tenantSignatureUrl,
    },
    {
      key: "agent",
      label: docs.agent,
      signed: contract.agentSignedAt,
      signatureUrl: contract.agentSignatureUrl,
    },
  ];
  const signingLocked = (status: AgentContractStatus) =>
    status === "cancelled" ||
    status === "expired" ||
    status === "terminated" ||
    status === "active" ||
    status === "awaiting_payment" ||
    status === "awaiting_payment_verification";
  function signSheetTitle(parties: AgentContractSignParty[]) {
    const names = partyMeta(selected!).filter((row) =>
      parties.includes(row.key),
    );
    if (names.length === 1)
      return docs.signTitle.replace("{name}", names[0].label);
    if (names.length === 3) return docs.signTitleAll;
    return docs.signTitle.replace(
      "{name}",
      names.map((row) => row.label).join(" · "),
    );
  }
  function openSignSheet(parties: AgentContractSignParty[]) {
    if (!parties.length || busy || signing.current) return;
    setError("");
    setSignPadKey((key) => key + 1);
    setSignParties(parties);
  }
  useEffect(() => {
    if (!signParties) return;
    const timer = setTimeout(() => {
      padRef.current?.reinitialize?.();
    }, 320);
    return () => clearTimeout(timer);
  }, [signParties, signPadKey]);
  const reservationRequest = useRef(false);
  const [pdfAction, setPdfAction] = useState<"preview" | "generate" | null>(
    null,
  );
  async function openReservation(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const latest = await (
        generate ? generateAgentReservation : previewAgentReservation
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.reservationLetterUrl)
        throw new Error("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
      openDocumentPreview(
        docs.reservationLetter,
        latest.reservationLetterUrl,
        "reservation_letter",
      );
      if (generate) setNotice("สร้างเอกสารพร้อมลายเซ็นครบ 3 ฝ่ายแล้ว");
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      reservationRequest.current = false;
      setBusy(false);
      setPdfAction(null);
    }
  }
  async function submitSignature(image: string) {
    if (!selected || !signParties?.length || signing.current) return;
    signing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const latest = await signAgentContract(selected.id, {
        parties: signParties,
        signaturePng: image,
      });
      setSignParties(null);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      setNotice(docs.signSuccess);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : docs.signError);
    } finally {
      signing.current = false;
      setBusy(false);
    }
  }
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
      !(reservation ? form.moveInDate : form.endDate) ||
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
        ...(reservation
          ? { moveInDate: form.moveInDate.trim() }
          : { endDate: form.endDate.trim() }),
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
      setLoadingList(false);
      setListError("");
      setContracts((current) => [
        contract,
        ...current.filter((item) => item.id !== contract.id),
      ]);
      setCreating(false);
      setSelected(contract);
      setNotice("บันทึกฉบับร่างแล้ว");
      onChanged?.();
      setLeadId(null);
      setForm({
        startDate: "",
        endDate: "",
        moveInDate: "",
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
                  ["moveInDate", "วันที่เข้าอยู่ (ค.ศ.)", "2026-10-15"],
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
        {errorView}
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
            {selected.formKind === "reservation"
              ? `วันที่จอง ${date(selected.bookingDate)} · วันที่เข้าอยู่ ${date(selected.moveInDate)}`
              : `${date(selected.startDate)} – ${date(selected.endDate)}`}
          </Text>
          {!!selected.notes && (
            <Text style={[s.body, muted]}>{selected.notes}</Text>
          )}
        </View>
        {selected.formKind === "reservation" && (
          <View style={[s.card, card]}>
            <Text style={[s.subtitle, title]}>{docs.documents}</Text>
            {documentSlots(selected).map((slot) => {
              if (slot.kind === "reservation_letter") {
                const complete =
                  selected.reservationLetterStatus === "ready_to_generate" ||
                  selected.reservationLetterStatus === "ready";
                const generated = selected.reservationLetterStatus === "ready";
                return (
                  <View key={slot.kind} style={{ gap: 8 }}>
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      isLoading={pdfAction === "preview"}
                      onPress={() => void openReservation(false)}
                    >
                      ดูเอกสารจอง
                    </MobileButton>
                    {complete && !generated && (
                      <MobileButton
                        disabled={busy}
                        isLoading={pdfAction === "generate"}
                        onPress={() => void openReservation(true)}
                      >
                        สร้างเอกสาร
                      </MobileButton>
                    )}
                    <Text style={[s.small, muted]}>
                      {generated
                        ? "เอกสารตัวอย่างพร้อมลายเซ็นครบ 3 ฝ่าย"
                        : complete
                          ? "ลงนามครบแล้ว กดสร้างเอกสารเพื่อแปะลายเซ็นลง PDF ตัวอย่าง"
                          : "เอกสารตัวอย่างเปิดดูได้ก่อนลงนาม เมื่อเซ็นครบ 3 ฝ่ายจึงสร้างเอกสารพร้อมลายเซ็นได้"}
                    </Text>
                  </View>
                );
              }
              const hasFile = !!slot.url;
              return hasFile && slot.url ? (
                <MobileButton
                  key={slot.kind}
                  variant="outline"
                  disabled={busy}
                  onPress={() => {
                    openDocumentPreview(slot.name, slot.url!, slot.kind);
                  }}
                >
                  {docs.preview.replace("{name}", slot.name)}
                </MobileButton>
              ) : (
                <MobileButton
                  key={slot.kind}
                  variant="primary"
                  disabled={busy}
                  isLoading={uploadingKind === slot.kind}
                  onPress={() => setPickKind(slot.kind)}
                >
                  {docs.upload.replace("{name}", slot.name)}
                </MobileButton>
              );
            })}
          </View>
        )}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>{docs.signatories}</Text>
          {partyMeta(selected).map((party) => (
            <View key={party.key} style={s.signRow}>
              <View style={s.sourceCopy}>
                <Text style={[s.body, title]}>{party.label}</Text>
                <Text style={[s.small, muted]}>
                  {party.signed
                    ? `✓ ${new Date(party.signed).toLocaleString("th-TH")}`
                    : docs.unsigned}
                </Text>
              </View>
              {party.signed && party.signatureUrl ? (
                <MobileButton
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    setViewSignature({
                      label: party.label,
                      url: party.signatureUrl!,
                    })
                  }
                >
                  {docs.viewSignature}
                </MobileButton>
              ) : null}
              {!party.signed && !signingLocked(selected.status) ? (
                <MobileButton
                  variant="outline"
                  disabled={busy}
                  onPress={() => openSignSheet([party.key])}
                >
                  {docs.signFor}
                </MobileButton>
              ) : null}
            </View>
          ))}
          {partyMeta(selected).some((party) => !party.signed) &&
          !signingLocked(selected.status) ? (
            <MobileButton
              disabled={busy}
              onPress={() =>
                openSignSheet(
                  partyMeta(selected)
                    .filter((party) => !party.signed)
                    .map((party) => party.key),
                )
              }
            >
              {docs.signForAll}
            </MobileButton>
          ) : null}
        </View>
        <Modal
          visible={previewDoc != null}
          onRequestClose={() => setPreviewDoc(null)}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <SafeAreaView
              style={{ flex: 1, backgroundColor: theme.background }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  gap: 12,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ปิดเอกสาร"
                  onPress={() => setPreviewDoc(null)}
                  style={{ padding: 8 }}
                >
                  <Text style={title}>ปิด</Text>
                </Pressable>
                <Text style={[s.sheetTitle, title]}>
                  {previewDoc
                    ? docs.previewTitle.replace("{name}", previewDoc.name)
                    : docs.preview}
                </Text>
              </View>
              {previewDoc ? (
                <ContractDocumentPreview
                  key={previewDoc.url}
                  url={previewDoc.url}
                />
              ) : null}
              {previewDoc ? (
                <View style={[s.previewActions, { padding: 12 }]}>
                  {previewDoc.kind !== "reservation_letter" && (
                    <MobileButton
                      disabled={busy}
                      isLoading={uploadingKind === previewDoc.kind}
                      onPress={replaceFromPreview}
                    >
                      {docs.replace.replace("{name}", previewDoc.name)}
                    </MobileButton>
                  )}
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => {
                      void openDocumentExternally(previewDoc.url);
                    }}
                  >
                    {docs.openExternally}
                  </MobileButton>
                </View>
              ) : null}
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
        <MobileBottomSheet
          visible={viewSignature != null}
          onClose={() => setViewSignature(null)}
          maxHeight={480}
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>
            {viewSignature
              ? docs.viewSignatureTitle.replace("{name}", viewSignature.label)
              : docs.viewSignature}
          </Text>
          {viewSignature ? (
            <View style={s.signaturePreview}>
              <Image
                source={{ uri: viewSignature.url }}
                style={s.signatureImage}
                contentFit="contain"
                accessibilityLabel={docs.viewSignatureTitle.replace(
                  "{name}",
                  viewSignature.label,
                )}
              />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${accent}22` }}
            onPress={() => setViewSignature(null)}
            style={({ pressed }) => [
              s.sheetCancel,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.sheetCancelLabel, muted]}>{t.common.cancel}</Text>
          </Pressable>
        </MobileBottomSheet>
        <MobileBottomSheet
          visible={pickKind != null}
          onClose={() => setPickKind(null)}
          maxHeight={420}
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>{docs.pickSourceTitle}</Text>
          <Text style={[s.sheetHint, muted]}>{docs.pickSourceHint}</Text>
          {[
            {
              source: "documents" as const,
              icon: "note" as const,
              label: docs.pickFromDocuments,
              hint: docs.pickFromDocumentsHint,
            },
            {
              source: "photos" as const,
              icon: "camera" as const,
              label: docs.pickFromPhotos,
              hint: docs.pickFromPhotosHint,
            },
          ].map((option) => (
            <Pressable
              key={option.source}
              accessibilityRole="button"
              android_ripple={{ color: `${accent}22` }}
              onPress={() => choosePickSource(option.source)}
              style={({ pressed }) => [
                s.sourceCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={[s.sourceIcon, { backgroundColor: `${accent}18` }]}>
                <MobileIcon
                  name={option.icon}
                  size={22}
                  color={accent}
                  weight="bold"
                />
              </View>
              <View style={s.sourceCopy}>
                <Text style={[s.sourceLabel, title]}>{option.label}</Text>
                <Text style={[s.sourceHint, muted]}>{option.hint}</Text>
              </View>
              <MobileIcon name="chevron-right" size={18} tone="muted" />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: `${accent}22` }}
            onPress={() => setPickKind(null)}
            style={({ pressed }) => [
              s.sheetCancel,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.sheetCancelLabel, muted]}>{t.common.cancel}</Text>
          </Pressable>
        </MobileBottomSheet>
        <MobileBottomSheet
          visible={signParties != null}
          onClose={() => !busy && setSignParties(null)}
          maxHeight="90%"
          sheetStyle={s.sheetPanel}
        >
          <Text style={[s.sheetTitle, title]}>
            {signParties ? signSheetTitle(signParties) : docs.signatories}
          </Text>
          <Text style={[s.sheetHint, muted]}>{docs.signHint}</Text>
          {!!error && signParties ? (
            <Text
              accessibilityRole="alert"
              style={[s.body, { color: "#C74747", marginBottom: 8 }]}
            >
              {error}
            </Text>
          ) : null}
          {signParties ? (
            <ContractSignaturePad
              key={`${signPadKey}-${signParties.join("-")}`}
              ref={padRef}
              onOK={(image) => {
                void submitSignature(image);
              }}
              onEmpty={() => setError(docs.signEmpty)}
            />
          ) : null}
          <View style={s.signActions}>
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() => padRef.current?.clearSignature()}
            >
              {docs.clearSignature}
            </MobileButton>
            <MobileButton
              disabled={busy}
              isLoading={busy}
              onPress={() => {
                if (busy || signing.current) return;
                padRef.current?.readSignature();
              }}
            >
              {docs.confirmSignature}
            </MobileButton>
          </View>
        </MobileBottomSheet>
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
      <Text style={[s.subtitle, title]}>
        สัญญาที่สร้างแล้ว
        {!loadingList && !listError ? ` (${contracts.length})` : ""}
      </Text>
      {(loadingList || busy) && <ActivityIndicator color={accent} />}
      {!!listError && (
        <View style={[s.card, card]}>
          <Text accessibilityRole="alert" style={[s.body, muted]}>
            {listError}
          </Text>
          {button("ลองโหลดอีกครั้ง", () => setRetry((value) => value + 1))}
        </View>
      )}
      {!loadingList &&
        !listError &&
        contracts.map((contract) => (
          <Pressable
            key={contract.id}
            accessibilityRole="button"
            accessibilityLabel={`ดู${contract.agreementTypeName} ${contract.contractNo}`}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              setNotice("");
              try {
                const latest = await getAgentContract(contract.id);
                setSelected(latest);
                setContracts((current) =>
                  current.map((item) =>
                    item.id === latest.id ? latest : item,
                  ),
                );
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
            style={({ pressed }) => [
              s.card,
              card,
              { opacity: pressed || busy ? 0.65 : 1 },
            ]}
          >
            <View style={s.row}>
              <Text style={[s.subtitle, title]}>
                {contract.agreementTypeName}
              </Text>
              <Text
                style={[
                  s.badge,
                  {
                    color: color(contract.status),
                    backgroundColor: `${color(contract.status)}15`,
                  },
                ]}
              >
                {labels[contract.status]}
              </Text>
            </View>
            <Text style={[s.small, muted]}>{contract.contractNo}</Text>
            <Text style={[s.body, title]}>
              {contract.property}
              {contract.room ? ` · ห้อง ${contract.room}` : ""}
            </Text>
            <Text style={[s.small, muted]}>
              {contract.formKind === "reservation"
                ? `วันที่จอง ${date(contract.bookingDate)} · วันที่เข้าอยู่ ${date(contract.moveInDate)}`
                : `${date(contract.startDate)} – ${date(contract.endDate)}`}
            </Text>
            <View style={s.row}>
              <Text style={[s.body, title]}>
                {contract.formKind === "reservation"
                  ? `เงินจอง ${money(contract.reservationFee)}`
                  : `${money(contract.monthlyRent)} / เดือน`}
              </Text>
              <Text style={[s.small, { color: accent }]}>ดูสัญญา →</Text>
            </View>
          </Pressable>
        ))}
      {!loadingList && !listError && !contracts.length && (
        <Text style={[s.body, muted]}>ยังไม่มีสัญญาที่สร้างไว้</Text>
      )}
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
  sheetPanel: { paddingHorizontal: 20, flexGrow: 0 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 4,
  },
  sheetHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceCopy: { flex: 1, minWidth: 0, gap: 2 },
  previewActions: { gap: 10, marginBottom: 4 },
  signaturePreview: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
    marginBottom: 8,
  },
  signatureImage: {
    width: "100%",
    height: 220,
  },
  signRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signActions: { marginTop: 16, gap: 10 },
  sourceLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
  },
  sourceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  sheetCancel: {
    marginTop: 4,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetCancelLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
  },
});
