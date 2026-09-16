import { AgreementAttachments } from "./AgreementAttachments";
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
  Platform,
  Share,
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
  AgreementTemplate,
  AgentContract,
  AgentContractDocumentKind,
  AgentContractSignParty,
  AgentContractStatus,
  ContractCandidate,
  AgentTenant,
} from "@nestyk/types";
import {
  listAgentContracts,
  listAgreementTemplates,
  getAgentContract,
  listContractCandidates,
  createAgentContract,
  uploadAgentContractDocument,
  signAgentContract,
  createContractSignInvite,
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
  const [renewing, setRenewing] = useState<AgentContract | null>(null);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [template, setTemplate] = useState<AgreementTemplate | null>(null);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const reservation = agreementType?.formKind === "reservation";
  const standardFields = new Set([
    "startDate",
    "endDate",
    "moveInDate",
    "monthlyRent",
    "deposit",
    "reservationFee",
  ]);
  const customFields = Object.entries(
    (template?.dataSchema.properties ?? {}) as Record<
      string,
      { type?: string; title?: string; enum?: unknown[] }
    >,
  ).filter(([key]) => !standardFields.has(key));
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
  const picking = useRef(false);
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
  }> =>
    contract.formKind === "lease"
      ? [
          {
            kind: "lease_agreement",
            name: docs.leaseAgreement,
            url: contract.leaseDocumentUrl,
          },
        ]
      : [
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
    setTimeout(() => setPickKind(kind), 400);
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
    try {
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
            ImagePicker.UIImagePickerPreferredAssetRepresentationMode
              .Compatible,
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
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : docs.uploadError);
      return;
    }
    if (!picked) return;
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
    if (!kind || picking.current || uploadingKind) return;
    picking.current = true;
    setTimeout(() => {
      void (async () => {
        try {
          await pickAndUpload(kind, source);
        } finally {
          picking.current = false;
        }
      })();
    }, 400);
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
    return docs.signTitle.replace(
      "{name}",
      names.map((row) => row.label).join(" · ") || "",
    );
  }
  function openSignSheet(parties: AgentContractSignParty[]) {
    if (!parties.length || busy || signing.current) return;
    setError("");
    setSignPadKey((key) => key + 1);
    setSignParties(parties);
  }
  async function shareSignInvite(party: "owner" | "tenant") {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const invite = await createContractSignInvite(selected.id, party);
      if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.share && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.url);
        setNotice("คัดลอกลิงก์สำหรับลงนามแล้ว");
        return;
      }
      const result = await Share.share({ message: invite.url });
      if (Platform.OS === "web" || result?.action === Share.sharedAction) setNotice(docs.shareSignSuccess);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(
        e instanceof Error && e.message ? e.message : docs.shareSignError,
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!signParties) return;
    const timer = setTimeout(() => {
      padRef.current?.reinitialize?.();
    }, 320);
    return () => clearTimeout(timer);
  }, [signParties, signPadKey]);
  const reservationRequest = useRef(false);
  const [attachmentReadiness, setAttachmentReadiness] = useState<{ contractId: number; ready: boolean } | null>(null);
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
  async function beginContract(
    type: AgreementType,
    source: AgentContract | null = null,
  ) {
    setRenewing(source);
    setAgreementType(type);
    setChoosingType(false);
    setCreating(true);
    setTemplate(null);
    setTemplates([]);
    setExtraFields({});
    setError("");
    setBusy(true);
    setLeadId(source?.leadId ?? tenant?.leadId ?? null);
    let nextStart = "";
    if (source?.endDate) {
      const day = new Date(`${source.endDate}T00:00:00Z`);
      day.setUTCDate(day.getUTCDate() + 1);
      nextStart = day.toISOString().slice(0, 10);
    }
    setForm({
      startDate: nextStart,
      endDate: "",
      moveInDate: "",
      monthlyRent:
        source?.monthlyRent == null ? "" : String(source.monthlyRent),
      deposit: source?.deposit == null ? "" : String(source.deposit),
      reservationFee: "",
      notes: source?.notes ?? "",
    });
    try {
      const [available, people] = await Promise.all([
        listAgreementTemplates(type.code),
        source
          ? Promise.resolve([
              {
                leadId: source.leadId,
                tenant: source.tenant,
                property: source.property,
                room: source.room,
              },
            ])
          : tenant
            ? Promise.resolve([
                {
                  leadId: tenant.leadId,
                  tenant: tenant.name,
                  property: tenant.property,
                  room: tenant.room,
                },
              ])
            : listContractCandidates(),
      ]);
      setTemplates(available);
      setTemplate(available[0] ?? null);
      setCandidates(people);
      if (source && available[0]) {
        const keys = Object.keys(
          (available[0].dataSchema.properties ?? {}) as object,
        );
        setExtraFields(
          Object.fromEntries(
            keys
              .filter(
                (key) => !standardFields.has(key) && source.data[key] != null,
              )
              .map((key) => [key, String(source.data[key])]),
          ),
        );
      }
      if (!available.length)
        setError("ยังไม่มีแม่แบบที่เปิดใช้งานสำหรับสัญญานี้");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (saving.current || busy) return;
    if (!template) {
      setError("กรุณาโหลดแม่แบบสัญญาให้สำเร็จก่อนบันทึก");
      return;
    }
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
    if (
      customFields.some(
        ([, field]) =>
          !["string", "number", "integer", "boolean"].includes(
            field.type ?? "",
          ),
      )
    ) {
      setError("แบบสัญญานี้มีฟิลด์ที่ฟอร์มยังไม่รองรับ กรุณาเลือกแบบอื่น");
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
        templateId: template.id,
        ...(renewing ? { previousAgreementId: renewing.id } : {}),
        data: Object.fromEntries(
          customFields
            .filter(
              ([key]) => extraFields[key] != null && extraFields[key] !== "",
            )
            .map(([key, field]) => [
              key,
              field.type === "number" || field.type === "integer"
                ? Number(extraFields[key])
                : field.type === "boolean"
                  ? extraFields[key] === "true"
                  : extraFields[key],
            ]),
        ),
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
      setRenewing(null);
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
    setRenewing(null);
    setCreating(false);
    setError("");
    setNotice("");
  };
  if (choosingType)
    return (
      <ContractTypePicker
        onBack={() => setChoosingType(false)}
        onSelect={(type) => {
          void beginContract(type);
        }}
      />
    );
  if (creating)
    return (
      <View style={s.root}>
        {button(renewing ? "← กลับไปสัญญาเดิม" : "← เลือกประเภทสัญญา", () => {
          if (busy) return;
          setCreating(false);
          if (!renewing) setChoosingType(true);
          setRenewing(null);
          setError("");
        })}
        <Text style={[s.heading, title]}>
          {renewing ? "ต่ออายุ" : "สร้าง"}
          {agreementType?.nameTh || "สัญญาเช่า"}
        </Text>
        <Text style={[s.body, muted]}>
          เลือกผู้เช่าและห้องเพื่อเตรียมฉบับร่างสัญญา
        </Text>
        {errorView}
        {busy && <ActivityIndicator color={accent} />}
        {renewing && (
          <Text style={[s.body, muted]}>
            ต่อจาก {renewing.contractNo} ·
            กรุณาตรวจสอบเงื่อนไขและระบุวันสิ้นสุดใหม่
          </Text>
        )}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>แบบสัญญา</Text>
          {templates.map((item) =>
            button(
              `${template?.id === item.id ? "● " : "○ "}${item.name} · รุ่น ${item.version}`,
              () => {
                if (!busy) {
                  setTemplate(item);
                  setExtraFields({});
                }
              },
            ),
          )}
          {!template &&
            !busy &&
            button("โหลดแบบสัญญาอีกครั้ง", () => {
              if (agreementType) void beginContract(agreementType, renewing);
            })}
        </View>
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
          {!renewing &&
            button("โหลดรายชื่ออีกครั้ง", () => {
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
          {customFields.map(([key, field]) => (
            <View key={key} style={{ gap: 6 }}>
              <Text style={[s.body, title]}>
                {field.title || key}
                {((template?.dataSchema.required ?? []) as string[]).includes(
                  key,
                )
                  ? " *"
                  : ""}
              </Text>
              {field.enum || field.type === "boolean" ? (
                (field.enum ?? [true, false]).map((option) =>
                  button(
                    `${extraFields[key] === String(option) ? "● " : "○ "}${option === true ? "ใช่" : option === false ? "ไม่ใช่" : String(option)}`,
                    () =>
                      setExtraFields((current) => ({
                        ...current,
                        [key]:
                          current[key] === String(option) ? "" : String(option),
                      })),
                  ),
                )
              ) : (
                <MobileInput
                  value={extraFields[key] ?? ""}
                  onChangeText={(value) =>
                    setExtraFields((current) => ({ ...current, [key]: value }))
                  }
                  keyboardType={
                    field.type === "number" || field.type === "integer"
                      ? "decimal-pad"
                      : "default"
                  }
                />
              )}
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
          <Text style={[s.eyebrow, { color: accent }]}>E-CONTRACT</Text>
          <Text style={[s.heading, title]}>{selected.property}</Text>
          <Text style={[s.body, muted]}>
            เลขที่สัญญา {selected.contractNo}
          </Text>
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
        {(!!selected.previousAgreementId ||
          (selected.formKind === "lease" &&
            ["active", "expired"].includes(selected.status))) && (
        <View style={[s.card, card]}>
          {!!selected.previousAgreementId && (
            <Text style={[s.body, muted]}>
              ฉบับต่ออายุ · สัญญาก่อนหน้า #{selected.previousAgreementId} ·
              ฉบับแรก #{selected.rootAgreementId}
            </Text>
          )}
          {selected.formKind === "lease" &&
            ["active", "expired"].includes(selected.status) &&
            button("ต่ออายุสัญญา", () => {
              void beginContract(
                {
                  code: selected.agreementTypeCode,
                  nameTh: selected.agreementTypeName,
                  nameEn: selected.agreementTypeName,
                  icon: "key",
                  formKind: "lease",
                },
                selected,
              );
            })}

        </View>
        )}
        {(selected.formKind === "reservation" ||
          selected.formKind === "lease") && (
          <View style={[s.card, card]}>
            <Text style={[s.subtitle, title]}>
              {selected.formKind === "lease"
                ? docs.leaseDocuments
                : docs.documents}
            </Text>
            {selected.formKind === "lease" && (
              <Text style={[s.small, muted]}>{docs.leaseDocumentHint}</Text>
            )}
            {documentSlots(selected).map((slot) => {
              if (slot.kind === "reservation_letter") {
                const complete =
                  selected.reservationLetterStatus === "ready_to_generate" ||
                  selected.reservationLetterStatus === "ready";
                const generated = selected.reservationLetterStatus === "ready";
                return (
                  <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                    <View style={s.documentHead}>
                      <View style={[s.documentStatus, { borderColor: generated ? "#198460" : theme.textSecondary, backgroundColor: generated ? "#19846018" : theme.background }]}>
                        <Text style={[s.body, { color: generated ? "#198460" : theme.textSecondary }]}>{generated ? "✓" : "○"}</Text>
                      </View>
                      <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                    </View>
                    {generated && <Text style={[s.body, title]}>{`reservation-${selected.contractNo}.pdf`}</Text>}
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      isLoading={pdfAction === "preview"}
                      onPress={() => void openReservation(false)}
                    >
                      ดูเอกสารจอง
                    </MobileButton>
                    <Text style={[s.small, muted]}>
                      {generated
                        ? "สร้างเอกสารพร้อมลายเซ็นครบ 3 ฝ่ายแล้ว"
                        : complete
                          ? "ลงนามครบแล้ว ยืนยันและสร้างเอกสารได้ที่ด้านล่าง"
                          : "เอกสารตัวอย่างเปิดดูได้ก่อนลงนาม เมื่อเซ็นครบ 3 ฝ่ายจึงสร้างเอกสารพร้อมลายเซ็นได้"}
                    </Text>
                  </View>
                );
              }
              const hasFile = !!slot.url;
              const storedNames = selected.data.documentFileNames as Record<string, string> | undefined;
              const extension = slot.url?.split(/[?#]/)[0]?.match(/\.(pdf|jpe?g|png)$/i)?.[0] ?? "";
              const originalName = storedNames?.[slot.kind];
              const fileName = typeof originalName === "string" && originalName.trim()
                ? originalName
                : `${slot.name}${extension}`;
              const statusColor = hasFile ? "#198460" : theme.textSecondary;
              return (
                <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                  <View style={s.documentHead}>
                    <View style={[s.documentStatus, { borderColor: statusColor, backgroundColor: `${statusColor}18` }]}>
                      <Text style={[s.body, { color: statusColor }]}>{hasFile ? "✓" : "○"}</Text>
                    </View>
                    <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                  </View>
                  {hasFile && slot.url ? (
                    <View style={[s.documentFile, { backgroundColor: theme.background }]}>
                      <Text style={[s.body, title]} numberOfLines={2}>{fileName}</Text>
                      <MobileButton variant="outline" disabled={busy} onPress={() => openDocumentPreview(fileName, slot.url!, slot.kind)}>
                        ดู
                      </MobileButton>
                    </View>
                  ) : (
                    <>
                      <Text style={[s.small, muted]}>ยังไม่ได้แนบเอกสารสำหรับรายการนี้</Text>
                      <MobileButton disabled={busy} isLoading={uploadingKind === slot.kind} onPress={() => setPickKind(slot.kind)}>
                        แนบเอกสาร
                      </MobileButton>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <AgreementAttachments
          key={selected.id}
          contractId={selected.id}
          onReadinessChange={setAttachmentReadiness}
          refreshKey={`${selected.status}:${selected.ownerSignedAt}:${selected.tenantSignedAt}:${selected.agentSignedAt}`}
        />
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
                  style={s.signatureButton}
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
                <View style={s.partyActions}>
                  {(party.key === "owner" || party.key === "tenant") && (
                    <MobileButton
                      variant="outline"
                      style={s.shareButton}
                      disabled={busy}
                      onPress={() => {
                        if (party.key === "owner" || party.key === "tenant") {
                          void shareSignInvite(party.key);
                        }
                      }}
                    >
                      {docs.shareSign}
                    </MobileButton>
                  )}
                  <MobileButton
                    style={s.signatureButton}
                    disabled={busy}
                    onPress={() => openSignSheet([party.key])}
                  >
                    {docs.signFor}
                  </MobileButton>
                </View>
              ) : null}
            </View>
          ))}
        </View>
        {selected.formKind === "reservation" && (
          <View style={[s.card, card]}>
            {selected.reservationLetterStatus === "ready" ? (
              <MobileButton
                disabled={busy}
                isLoading={pdfAction === "preview"}
                onPress={() => void openReservation(false)}
              >
                ดูเอกสารฉบับสมบูรณ์
              </MobileButton>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  แนบเอกสารที่จำเป็นและลงนามครบทั้ง 3 ฝ่าย แล้วกดยืนยันเพื่อสร้างเอกสาร
                </Text>
                <MobileButton
                  disabled={busy || selected.reservationLetterStatus !== "ready_to_generate" ||
                    attachmentReadiness?.contractId !== selected.id || !attachmentReadiness.ready}
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openReservation(true)}
                >
                  ยืนยันและสร้างเอกสาร
                </MobileButton>
              </>
            )}
          </View>
        )}
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
                      อัพโหลดใหม่
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
            <Text style={[s.small, muted]}>
              เลขที่สัญญา {contract.contractNo}
            </Text>
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
    gap: 10,
    minHeight: 64,
    paddingVertical: 6,
  },
  signatureButton: { width: 96, minHeight: 46, flexShrink: 0, paddingHorizontal: 8, borderWidth: 1, borderColor: tokens.colors.brand[500] },
  shareButton: { width: 64, minHeight: 46, flexShrink: 0, paddingHorizontal: 8 },
  documentItem: { gap: 10, padding: 12, borderWidth: 1, borderRadius: 14 },
  documentHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  documentStatus: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  documentTitle: { flex: 1, fontFamily: tokens.typography.native.headingTh, fontSize: 15, lineHeight: 23 },
  documentFile: { gap: 8, padding: 12, borderRadius: 12 },
  partyActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8,
    justifyContent: "flex-end",
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
