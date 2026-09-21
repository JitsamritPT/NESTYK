import { FinancialDocumentForm } from "./FinancialDocumentForm";
import { AgreementAttachments } from "./AgreementAttachments";
import {
  ReservationLetterFields,
  emptyReservationLetterForm,
  reservationLetterFieldErrors,
  reservationIssueDate,
} from "./ReservationLetterFields";
import {
  BrokerAppointmentFields,
  emptyBrokerAppointmentForm,
  brokerAppointmentFieldErrors,
} from "./BrokerAppointmentFields";
import {
  LeaseAgreementFields,
  emptyLeaseAgreementForm,
  leaseAgreementFieldErrors,
} from "./LeaseAgreementFields";
import {
  ContractTypePicker,
  type CreateDocumentKind,
} from "./ContractTypePicker";
import React, { useContext, useEffect, useRef, useState } from "react";
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
  ModePageScrollContext,
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
  ReservationLetterInput,
  BrokerAppointmentInput,
  LeaseAgreementInput,
} from "@nestyk/types";
import {
  listAgentContracts,
  listAgreementTypes,
  listAgreementTemplates,
  getAgentContract,
  listContractCandidates,
  getReservationDefaults,
  getBrokerAppointmentLeadDefaults,
  getLeaseDefaults,
  createAgentContract,
  updateAgentContractDraft,
  cancelAgentContractDraft,
  getAgentContractDraftTemplate,
  uploadAgentContractDocument,
  signAgentContract,
  createContractSignInvite,
  previewAgentReservation,
  generateAgentReservation,
  previewAgentBrokerAppointment,
  generateAgentBrokerAppointment,
  previewAgentLeaseAgreement,
  generateAgentLeaseAgreement,
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
  const [template, setTemplate] = useState<AgreementTemplate | null>(null);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const reservation = agreementType?.formKind === "reservation";
  const broker = agreementType?.formKind === "broker_appointment";
  const lease = agreementType?.formKind === "lease";
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
  const [menuCreate, setMenuCreate] = useState<CreateDocumentKind | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingDraft, setEditingDraft] = useState<AgentContract | null>(null);
  const [cancellingDraft, setCancellingDraft] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [financialKind, setFinancialKind] = useState<"invoice" | "receipt" | null>(null);
  const [attachmentsNonce, setAttachmentsNonce] = useState(0);
  const [focusDocuments, setFocusDocuments] = useState(false);
  const [attachmentReadiness, setAttachmentReadiness] = useState<{
    contractId: number;
    ready: boolean;
  } | null>(null);
  const pageScroll = useContext(ModePageScrollContext);
  const documentsAnchorRef = useRef<View>(null);
  useEffect(() => {
    if (!focusDocuments || financialKind) return;
    const id = requestAnimationFrame(() => {
      pageScroll?.scrollToView(documentsAnchorRef, { offset: 8, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusDocuments, pageScroll, selected?.id, financialKind]);
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
  const [letter, setLetter] = useState<ReservationLetterInput>(
    emptyReservationLetterForm(),
  );
  const [letterErrors, setLetterErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [brokerForm, setBrokerForm] = useState<BrokerAppointmentInput>(
    emptyBrokerAppointmentForm(),
  );
  const [brokerErrors, setBrokerErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [leaseForm, setLeaseForm] = useState<LeaseAgreementInput>(
    emptyLeaseAgreementForm(),
  );
  const [leaseErrors, setLeaseErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const accent = tokens.colors.roles.agent;
  const card = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const button = (
    label: string,
    onPress: () => void,
    primary = false,
    reactKey?: string | number,
  ) => (
    <Pressable
      key={reactKey}
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
      : contract.formKind === "broker_appointment"
        ? [
            {
              kind: "broker_appointment",
              name: "สัญญาแต่งตั้งนายหน้า",
              url: contract.brokerAppointmentUrl,
            },
          ]
        : [
            {
              kind: "reservation_letter",
              name: docs.reservationLetter,
              url: contract.reservationLetterUrl,
            },
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
    if (
      !previewDoc ||
      previewDoc.kind === "reservation_letter" ||
      previewDoc.kind === "broker_appointment" ||
      previewDoc.kind === "lease_agreement"
    )
      return;
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
    if (
      !selected ||
      uploadingKind ||
      kind === "reservation_letter" ||
      kind === "broker_appointment" ||
      kind === "lease_agreement"
    )
      return;
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
  }> => {
    const all = [
      {
        key: "owner" as const,
        label:
          contract.formKind === "broker_appointment" ? "ผู้ให้เช่า" : docs.owner,
        signed: contract.ownerSignedAt,
        signatureUrl: contract.ownerSignatureUrl,
      },
      {
        key: "tenant" as const,
        label: docs.tenant,
        signed: contract.tenantSignedAt,
        signatureUrl: contract.tenantSignatureUrl,
      },
      {
        key: "agent" as const,
        label:
          contract.formKind === "broker_appointment" ? "นายหน้า" : docs.agent,
        signed: contract.agentSignedAt,
        signatureUrl: contract.agentSignatureUrl,
      },
    ];
    return contract.formKind === "broker_appointment"
      ? all.filter((row) => row.key !== "tenant")
      : contract.formKind === "lease"
        ? all.filter((row) => row.key !== "agent")
        : all;
  };
  const signingLocked = (status: AgentContractStatus) =>
    status === "cancelled" ||
    status === "expired" ||
    status === "terminated" ||
    status === "active" ||
    status === "awaiting_payment" ||
    status === "awaiting_payment_verification";
  const reservationLocked =
    !!selected &&
    selected.formKind === "reservation" &&
    selected.reservationLetterStatus === "ready";
  const brokerLocked =
    !!selected &&
    selected.formKind === "broker_appointment" &&
    selected.brokerAppointmentStatus === "ready";
  const leaseLocked =
    !!selected &&
    selected.formKind === "lease" &&
    selected.leaseAgreementStatus === "ready";
  const draftCancelled = selected?.status === "cancelled";
  const documentLocked = reservationLocked || brokerLocked || leaseLocked || draftCancelled;
  const attachmentsRequired =
    !!selected &&
    (selected.formKind === "reservation" || selected.formKind === "lease");
  const attachmentsReady =
    !attachmentsRequired ||
    (attachmentReadiness?.contractId === selected.id &&
      attachmentReadiness.ready);
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
    if (
      !parties.length ||
      busy ||
      signing.current ||
      documentLocked ||
      !attachmentsReady
    )
      return;
    setError("");
    setSignPadKey((key) => key + 1);
    setSignParties(parties);
  }
  async function shareSignInvite(party: "owner" | "tenant") {
    if (!selected || busy || documentLocked || !attachmentsReady) return;
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
  async function openBrokerAppointment(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const latest = await (
        generate
          ? generateAgentBrokerAppointment
          : previewAgentBrokerAppointment
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.brokerAppointmentUrl)
        throw new Error("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
      openDocumentPreview(
        "สัญญาแต่งตั้งนายหน้า",
        latest.brokerAppointmentUrl,
        "broker_appointment",
      );
      if (generate) setNotice("สร้างเอกสารพร้อมลายเซ็นครบแล้ว");
      onChanged?.();
    } catch (e) {
      setError(message(e));
    } finally {
      reservationRequest.current = false;
      setBusy(false);
      setPdfAction(null);
    }
  }
  async function openLeaseAgreement(generate: boolean) {
    if (!selected || reservationRequest.current) return;
    reservationRequest.current = true;
    setBusy(true);
    setPdfAction(generate ? "generate" : "preview");
    setError("");
    try {
      const latest = await (
        generate ? generateAgentLeaseAgreement : previewAgentLeaseAgreement
      )(selected.id);
      setSelected(latest);
      setContracts((current) =>
        current.map((item) => (item.id === latest.id ? latest : item)),
      );
      if (!latest.leaseDocumentUrl)
        throw new Error("ไม่สามารถเปิดเอกสารได้ กรุณาลองอีกครั้ง");
      openDocumentPreview(
        docs.leaseAgreement,
        latest.leaseDocumentUrl,
        "lease_agreement",
      );
      if (generate) setNotice("สร้างเอกสารสัญญาเช่าพร้อมลายเซ็นครบแล้ว");
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
    setEditingDraft(null);
    setCancellingDraft(false);
    setRenewing(source);
    setAgreementType(type);
    setChoosingType(false);
    setCreating(true);
    setTemplate(null);
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
    setLetter(emptyReservationLetterForm());
    setLetterErrors({});
    setBrokerForm(emptyBrokerAppointmentForm());
    setBrokerErrors({});
    setLeaseForm(emptyLeaseAgreementForm());
    setLeaseErrors({});
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
      setTemplate(available[0] ?? null);
      setCandidates(people);
      const initialLead = source?.leadId ?? tenant?.leadId ?? people[0]?.leadId ?? null;
      if (initialLead) setLeadId(initialLead);
      if (type.formKind === "reservation" && initialLead) {
        try {
          const defaults = await getReservationDefaults(initialLead);
          setLetter(defaults);
          setForm((current) => ({
            ...current,
            startDate: defaults.issueDate || current.startDate,
            moveInDate: defaults.termFrom || current.moveInDate,
            reservationFee: defaults.reservationPayment || current.reservationFee,
          }));
        } catch {
          /* keep empty letter; user can fill manually */
        }
      }
      if (type.formKind === "broker_appointment" && initialLead) {
        try {
          const defaults = await getBrokerAppointmentLeadDefaults(initialLead);
          setBrokerForm(defaults);
          setForm((current) => ({
            ...current,
            startDate: defaults.issueDate || current.startDate,
          }));
        } catch {
          /* keep empty */
        }
      }
      if (type.formKind === "lease" && initialLead) {
        try {
          const defaults = await getLeaseDefaults(initialLead);
          if (source?.data?.leaseAgreement && typeof source.data.leaseAgreement === "object") {
            setLeaseForm({
              ...emptyLeaseAgreementForm(),
              ...(source.data.leaseAgreement as LeaseAgreementInput),
              landlordSignaturePng: "",
              tenantSignaturePng: "",
            });
          } else {
            setLeaseForm(defaults);
          }
          setForm((current) => ({
            ...current,
            startDate: defaults.termFrom || current.startDate,
            endDate: defaults.termTo || current.endDate,
            monthlyRent: defaults.monthlyRent || current.monthlyRent,
            deposit: defaults.depositAmount || current.deposit,
          }));
        } catch {
          /* keep empty */
        }
      }
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
  async function editDraft(contract: AgentContract) {
    setBusy(true);
    setError("");
    try {
      const draftTemplate = await getAgentContractDraftTemplate(contract.id);
      const latest = await getAgentContract(contract.id);
      setEditingDraft(latest);
      setRenewing(null);
      setAgreementType({ code: latest.agreementTypeCode, nameTh: latest.agreementTypeName,
        nameEn: latest.agreementTypeName, icon: "key", formKind: latest.formKind });
      setTemplate(draftTemplate);
      setLeadId(latest.leadId);
      setCandidates([{ leadId: latest.leadId, tenant: latest.tenant, property: latest.property, room: latest.room }]);
      setForm({ startDate: latest.startDate, endDate: latest.endDate ?? "", moveInDate: latest.moveInDate ?? "",
        monthlyRent: String(latest.monthlyRent ?? ""), deposit: String(latest.deposit ?? ""),
        reservationFee: String(latest.reservationFee ?? ""), notes: latest.notes ?? "" });
      setLetter({ ...emptyReservationLetterForm(), ...(latest.data.reservationLetter as Partial<ReservationLetterInput> ?? {}) });
      setBrokerForm({ ...emptyBrokerAppointmentForm(), ...(latest.data.brokerAppointment as Partial<BrokerAppointmentInput> ?? {}) });
      setLeaseForm({ ...emptyLeaseAgreementForm(), ...(latest.data.leaseAgreement as Partial<LeaseAgreementInput> ?? {}) });
      setLetterErrors({}); setBrokerErrors({}); setLeaseErrors({});
      setExtraFields(Object.fromEntries(Object.keys((draftTemplate.dataSchema.properties ?? {}) as object)
        .filter(key => !standardFields.has(key) && latest.data[key] != null)
        .map(key => [key, String(latest.data[key])])));
      setCancellingDraft(false);
      setCreating(true);
      setChoosingType(false);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function cancelDraft() {
    if (!selected || busy || saving.current || !cancelReason.trim()) return;
    saving.current = true;
    setBusy(true); setError("");
    try {
      const latest = await cancelAgentContractDraft(selected.id, cancelReason);
      setSelected(latest);
      setContracts(rows => rows.map(row => row.id === latest.id ? latest : row));
      setCancellingDraft(false); setCancelReason("");
      setNotice("ยกเลิกฉบับร่างแล้ว สามารถสร้างสัญญาใหม่ได้");
      onChanged?.();
    } catch (e) { setError(message(e)); }
    finally { saving.current = false; setBusy(false); }
  }
  async function save() {
    if (saving.current || busy) return;
    if (!template) {
      setError("กรุณาโหลดแม่แบบสัญญาให้สำเร็จก่อนบันทึก");
      return;
    }
    const savedReservation = editingDraft?.data?.reservationLetter as
      | ReservationLetterInput
      | undefined;
    const reservationLetter = reservation
      ? {
          ...letter,
          documentNo: savedReservation?.documentNo ?? "",
          issueDate: reservationIssueDate(savedReservation?.issueDate),
        }
      : letter;
    if (reservation) {
      if (!leadId) {
        setError("กรุณาเลือกผู้เช่า");
        return;
      }
      const fieldErrors = reservationLetterFieldErrors(reservationLetter);
      if (Object.keys(fieldErrors).length) {
        setLetterErrors(fieldErrors);
        setError("กรุณากรอกข้อมูลหนังสือจองที่จำเป็นให้ครบ");
        return;
      }
      setLetterErrors({});
    } else if (broker) {
      if (!leadId) {
        setError("กรุณาเลือกผู้เช่า");
        return;
      }
      const fieldErrors = brokerAppointmentFieldErrors(brokerForm);
      if (Object.keys(fieldErrors).length) {
        setBrokerErrors(fieldErrors);
        setError("กรุณากรอกข้อมูลแต่งตั้งนายหน้าให้ครบ");
        return;
      }
      setBrokerErrors({});
    } else if (lease) {
      if (!leadId) {
        setError("กรุณาเลือกผู้เช่า");
        return;
      }
      const fieldErrors = leaseAgreementFieldErrors(leaseForm);
      if (Object.keys(fieldErrors).length) {
        setLeaseErrors(fieldErrors);
        setError("กรุณากรอกข้อมูลสัญญาเช่าให้ครบ");
        return;
      }
      setLeaseErrors({});
    } else if (
      !leadId ||
      !form.startDate ||
      !form.endDate ||
      !form.monthlyRent.trim() ||
      !form.deposit.trim()
    ) {
      setError("กรุณาเลือกผู้เช่าและกรอกวันที่กับจำนวนเงินให้ครบ");
      return;
    }
    if (
      customFields.some(
        ([key, field]) =>
          key !== "reservationLetter" &&
          key !== "brokerAppointment" &&
          key !== "leaseAgreement" &&
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
      const extra = Object.fromEntries(
        customFields
          .filter(
            ([key]) =>
              key !== "reservationLetter" &&
              key !== "brokerAppointment" &&
              key !== "leaseAgreement" &&
              extraFields[key] != null &&
              extraFields[key] !== "",
          )
          .map(([key, field]) => [
            key,
            field.type === "number" || field.type === "integer"
              ? Number(extraFields[key])
              : field.type === "boolean"
                ? extraFields[key] === "true"
                : extraFields[key],
          ]),
      );
      const startDate = reservation
        ? reservationLetter.issueDate.trim()
        : broker
          ? brokerForm.issueDate.trim()
          : lease
            ? leaseForm.termFrom.trim()
            : form.startDate.trim();
      const moveInDate = reservation
        ? (reservationLetter.termFrom || reservationLetter.issueDate).trim()
        : undefined;
      const reservationFee = reservation
        ? Number(String(letter.reservationPayment).replace(/,/g, ""))
        : undefined;
      const leaseRent = lease
        ? Number(String(leaseForm.monthlyRent).replace(/,/g, ""))
        : Number(form.monthlyRent);
      const leaseDeposit = lease
        ? Number(String(leaseForm.depositAmount).replace(/,/g, ""))
        : Number(form.deposit);
      const persist = editingDraft ? (input: Parameters<typeof createAgentContract>[0]) => updateAgentContractDraft(editingDraft.id, input, editingDraft.data.draftRevision ?? null) : createAgentContract;
      const contract = await persist({
        leadId,
        startDate,
        ...(reservation
          ? { moveInDate, reservationFee }
          : broker
            ? {}
            : {
                endDate: lease
                  ? leaseForm.termTo.trim()
                  : form.endDate.trim(),
                monthlyRent: leaseRent,
                deposit: leaseDeposit,
              }),
        agreementTypeCode: agreementType?.code,
        templateId: template.id,
        ...(renewing ? { previousAgreementId: renewing.id } : {}),
        data: {
          ...extra,
          ...(reservation ? { reservationLetter } : {}),
          ...(broker ? { brokerAppointment: brokerForm } : {}),
          ...(lease ? { leaseAgreement: leaseForm } : {}),
        },
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
      setNotice(editingDraft ? "บันทึกการแก้ไขแล้ว กรุณาสร้างลิงก์ลงนามใหม่หากเคยแชร์ไว้" : "บันทึกฉบับร่างแล้ว");
      setEditingDraft(null);
      onChanged?.();
      setLeadId(null);
      setLetter(emptyReservationLetterForm());
      setLetterErrors({});
      setBrokerForm(emptyBrokerAppointmentForm());
      setBrokerErrors({});
      setLeaseForm(emptyLeaseAgreementForm());
      setLeaseErrors({});
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
    setEditingDraft(null);
    setCancellingDraft(false);
    setCancelReason("");
    setRenewing(null);
    setCreating(false);
    setFinancialKind(null);
    setMenuCreate(null);
    setFocusDocuments(false);
    setError("");
    setNotice("");
  };

  function reservationHosts() {
    return contracts.filter(
      (c) =>
        c.formKind === "reservation" &&
        c.reservationLetterStatus !== "ready" &&
        !["cancelled", "expired", "terminated"].includes(c.status),
    );
  }

  async function onCreateKind(kind: CreateDocumentKind) {
    setError("");
    setNotice("");
    if (kind === "reservation" || kind === "lease" || kind === "broker_appointment") {
      setBusy(true);
      try {
        const types = await listAgreementTypes();
        const type = types.find((row) => row.formKind === kind || row.code === kind);
        if (!type) throw new Error("ไม่พบประเภทสัญญานี้ในระบบ");
        setChoosingType(false);
        setMenuCreate(null);
        await beginContract(type);
      } catch (e) {
        setError(message(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    setChoosingType(false);
    setMenuCreate(kind);
  }

  if (choosingType)
    return (
      <ContractTypePicker
        onBack={() => setChoosingType(false)}
        onSelect={(kind) => {
          void onCreateKind(kind);
        }}
      />
    );
  if (menuCreate === "agent_commission")
    return (
      <View style={s.root}>
        {button("← เลือกประเภทสัญญา", () => {
          setMenuCreate(null);
          setChoosingType(true);
        })}
        <Text style={[s.heading, title]}>
          ข้อตกลงแบ่งค่าคอมมิชชั่นระหว่างเอเจนต์
        </Text>
        <Text style={[s.body, muted]}>
          กำลังเตรียมแม่แบบ PDF — จะเปิดให้กรอกฟอร์มสร้างเอกสารเร็วๆ นี้
        </Text>
      </View>
    );
  if (menuCreate === "invoice" || menuCreate === "receipt")
    return (
      <FinancialDocumentForm
        key={`menu:${menuCreate}`}
        kind={menuCreate}
        hosts={reservationHosts()}
        onBack={() => {
          setMenuCreate(null);
          setChoosingType(true);
        }}
        onCreated={(row) => {
          setSelected(row);
          setContracts((rows) =>
            rows.map((existing) => (existing.id === row.id ? row : existing)),
          );
          setMenuCreate(null);
          setFocusDocuments(true);
          setNotice(docs.financial.success);
          onChanged?.();
        }}
      />
    );
  if (creating)
    return (
      <View style={s.root}>
        {button(renewing || editingDraft ? "← กลับไปสัญญาเดิม" : "← เลือกประเภทสัญญา", () => {
          if (busy) return;
          setCreating(false);
          if (!renewing && !editingDraft) setChoosingType(true);
          setEditingDraft(null);
          setRenewing(null);
          setError("");
        })}
        <Text style={[s.heading, title]}>
          {editingDraft ? "แก้ไขฉบับร่าง · " : renewing ? "ต่ออายุ" : "สร้าง"}
          {agreementType?.nameTh || "สัญญาเช่า"}
        </Text>
        <Text style={[s.body, muted]}>
          {editingDraft ? "แก้ไขเงื่อนไขได้โดยคงผู้เช่า ห้อง และเลขสัญญาเดิม เมื่อบันทึกจะล้าง PDF และเอกสารการเงินเดิมเพื่อให้สร้างจากข้อมูลล่าสุด" : "เลือกผู้เช่าและห้องเพื่อเตรียมฉบับร่างสัญญา"}
        </Text>
        {errorView}
        {busy && <ActivityIndicator color={accent} />}
        {renewing && (
          <Text style={[s.body, muted]}>
            ต่อจาก {renewing.contractNo} ·
            กรุณาตรวจสอบเงื่อนไขและระบุวันสิ้นสุดใหม่
          </Text>
        )}
        {!template &&
          !busy &&
          button("โหลดแบบสัญญาอีกครั้ง", () => {
            if (agreementType) void beginContract(agreementType, renewing);
          })}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>ผู้เช่าและห้อง</Text>
          {candidates.map((c) => (
            <Pressable
              key={c.leadId}
              disabled={busy || !!editingDraft}
              accessibilityRole="radio"
              accessibilityState={{ checked: leadId === c.leadId }}
              onPress={() => {
                setLeadId(c.leadId);
                if (reservation) {
                  void getReservationDefaults(c.leadId)
                    .then((defaults) => {
                      setLetter(defaults);
                      setForm((current) => ({
                        ...current,
                        startDate: defaults.issueDate || current.startDate,
                        moveInDate: defaults.termFrom || current.moveInDate,
                        reservationFee:
                          defaults.reservationPayment || current.reservationFee,
                      }));
                    })
                    .catch(() => undefined);
                }
                if (broker) {
                  void getBrokerAppointmentLeadDefaults(c.leadId)
                    .then((defaults) => {
                      setBrokerForm(defaults);
                      setForm((current) => ({
                        ...current,
                        startDate: defaults.issueDate || current.startDate,
                      }));
                    })
                    .catch(() => undefined);
                }
                if (lease) {
                  void getLeaseDefaults(c.leadId)
                    .then((defaults) => {
                      setLeaseForm(defaults);
                      setForm((current) => ({
                        ...current,
                        startDate: defaults.termFrom || current.startDate,
                        endDate: defaults.termTo || current.endDate,
                        monthlyRent: defaults.monthlyRent || current.monthlyRent,
                        deposit: defaults.depositAmount || current.deposit,
                      }));
                    })
                    .catch(() => undefined);
                }
              }}
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
          {!renewing && !editingDraft &&
            button("โหลดรายชื่ออีกครั้ง", () => {
              void loadCandidates();
            })}
        </View>
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>
            {reservation
              ? "รายละเอียดหนังสือจอง"
              : broker
                ? "รายละเอียดแต่งตั้งนายหน้า"
                : lease
                  ? "รายละเอียดสัญญาเช่า"
                  : "เงื่อนไขการเช่า"}
          </Text>
          {reservation ? (
            <>
              <ReservationLetterFields
                value={letter}
                onChange={(next) => {
                  setLetter(next);
                  if (Object.keys(letterErrors).length)
                    setLetterErrors(reservationLetterFieldErrors(next));
                }}
                disabled={busy}
                errors={letterErrors}
              />
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={[s.body, title]}>หมายเหตุ (ไม่บังคับ)</Text>
                <MobileInput
                  value={form.notes}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, notes: value }))
                  }
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </View>
            </>
          ) : broker ? (
            <>
              <BrokerAppointmentFields
                value={brokerForm}
                onChange={(next) => {
                  setBrokerForm(next);
                  if (Object.keys(brokerErrors).length)
                    setBrokerErrors(brokerAppointmentFieldErrors(next));
                }}
                disabled={busy}
                errors={brokerErrors}
              />
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={[s.body, title]}>หมายเหตุ (ไม่บังคับ)</Text>
                <MobileInput
                  value={form.notes}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, notes: value }))
                  }
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </View>
            </>
          ) : lease ? (
            <>
              <LeaseAgreementFields
                value={leaseForm}
                onChange={(next) => {
                  setLeaseForm(next);
                  if (Object.keys(leaseErrors).length)
                    setLeaseErrors(leaseAgreementFieldErrors(next));
                }}
                disabled={busy}
                errors={leaseErrors}
              />
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={[s.body, title]}>หมายเหตุ (ไม่บังคับ)</Text>
                <MobileInput
                  value={form.notes}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, notes: value }))
                  }
                  placeholder="รายละเอียดเพิ่มเติม"
                />
              </View>
            </>
          ) : (
            (
              [
                ["startDate", "วันเริ่มสัญญา (ค.ศ.)", "2026-10-01"],
                ["endDate", "วันสิ้นสุดสัญญา (ค.ศ.)", "2027-09-30"],
                ["monthlyRent", "ค่าเช่าต่อเดือน (บาท)", "15000"],
                ["deposit", "เงินประกัน (บาท)", "30000"],
                ["notes", "หมายเหตุ (ไม่บังคับ)", "รายละเอียดเพิ่มเติม"],
              ] as Array<[keyof typeof form, string, string]>
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
                    key === "monthlyRent" || key === "deposit"
                      ? "decimal-pad"
                      : "default"
                  }
                />
              </View>
            ))
          )}
          {customFields
            .filter(
              ([key]) =>
                key !== "reservationLetter" &&
                key !== "brokerAppointment" &&
                key !== "leaseAgreement",
            )
            .map(([key, field]) => (
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
                    false,
                    `${key}-${String(option)}`,
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
  if (selected && financialKind && !reservationLocked && !draftCancelled)
    return <FinancialDocumentForm key={`${selected.id}:${financialKind}`} contractId={selected.id} kind={financialKind}
      onBack={() => setFinancialKind(null)}
      onCreated={row => {
        setSelected(row);
        setContracts(rows => rows.map(existing => existing.id === row.id ? row : existing));
        setFinancialKind(null);
        setFocusDocuments(true);
        setNotice(docs.financial.success);
        onChanged?.();
      }} />;
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
              : selected.formKind === "broker_appointment"
                ? "แต่งตั้งนายหน้า"
                : "ค่าเช่าต่อเดือน"}
          </Text>
          <Text style={[s.heading, title]}>
            {selected.formKind === "broker_appointment"
              ? selected.contractNo
              : money(
                  selected.formKind === "reservation"
                    ? selected.reservationFee
                    : selected.monthlyRent,
                )}
          </Text>
          {selected.formKind === "lease" && (
            <Text style={[s.body, muted]}>
              เงินประกัน {money(selected.deposit)}
            </Text>
          )}
          <Text style={[s.body, muted]}>
            {selected.formKind === "reservation"
              ? `วันที่จอง ${date(selected.bookingDate)} · วันที่เข้าอยู่ ${date(selected.moveInDate)}`
              : selected.formKind === "broker_appointment"
                ? `วันที่ ${date(selected.startDate)}`
                : `${date(selected.startDate)} – ${date(selected.endDate)}`}
          </Text>
          {!!selected.notes && (
            <Text style={[s.body, muted]}>{selected.notes}</Text>
          )}
        </View>
        {selected.status === "draft" && !selected.ownerSignedAt && !selected.tenantSignedAt && !selected.agentSignedAt && !documentLocked && (
          <View style={[s.card, card]}>
            {button("แก้ไขฉบับร่าง", () => { void editDraft(selected); })}
            {button("ยกเลิกฉบับร่าง", () => { setCancellingDraft(true); setCancelReason(""); setError(""); })}
            {cancellingDraft && <>
              <Text style={[s.body, title]}>ยืนยันยกเลิก {selected.contractNo}</Text>
              <Text style={[s.small, muted]}>รายการจะยังอยู่ในประวัติ ลิงก์ลงนามเดิมจะใช้ไม่ได้ และสามารถสร้างสัญญาใหม่ได้</Text>
              <MobileInput label="เหตุผลที่ยกเลิก" value={cancelReason} onChangeText={setCancelReason} editable={!busy} maxLength={1000}
                placeholder="เหตุผลที่ยกเลิก" accessibilityLabel="เหตุผลที่ยกเลิกฉบับร่าง" multiline />
              <MobileButton disabled={busy || !cancelReason.trim()} onPress={() => { void cancelDraft(); }}>ยืนยันยกเลิกฉบับร่าง</MobileButton>
              {button("เก็บฉบับร่างไว้", () => { setCancellingDraft(false); setCancelReason(""); })}
            </>}
          </View>
        )}
        {selected.status === "cancelled" && !!selected.data.draftCancellation && (
          <Text style={[s.body, muted]}>เหตุผลที่ยกเลิก: {String((selected.data.draftCancellation as { reason?: string }).reason ?? "")}</Text>
        )}
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
          selected.formKind === "lease" ||
          selected.formKind === "broker_appointment") && (
          <View ref={documentsAnchorRef} collapsable={false} style={[s.card, card]}>
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
                      ดูหนังสือจอง
                    </MobileButton>
                    <Text style={[s.small, muted]}>
                      {generated
                        ? "สร้างเอกสารพร้อมลายเซ็นครบ 3 ฝ่ายแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้"
                        : complete
                          ? "ลงนามครบแล้ว ยืนยันและสร้างเอกสารได้ที่ด้านล่าง"
                          : "เอกสารตัวอย่างเปิดดูได้ก่อนลงนาม เมื่อเซ็นครบ 3 ฝ่ายจึงสร้างเอกสารพร้อมลายเซ็นได้"}
                    </Text>
                  </View>
                );
              }
              if (slot.kind === "broker_appointment") {
                const complete =
                  selected.brokerAppointmentStatus === "ready_to_generate" ||
                  selected.brokerAppointmentStatus === "ready";
                const generated = selected.brokerAppointmentStatus === "ready";
                return (
                  <View key={slot.kind} style={[s.documentItem, { borderColor: theme.border }]}>
                    <View style={s.documentHead}>
                      <View style={[s.documentStatus, { borderColor: generated ? "#198460" : theme.textSecondary, backgroundColor: generated ? "#19846018" : theme.background }]}>
                        <Text style={[s.body, { color: generated ? "#198460" : theme.textSecondary }]}>{generated ? "✓" : "○"}</Text>
                      </View>
                      <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                    </View>
                    {generated && (
                      <Text style={[s.body, title]}>
                        {`broker-${selected.contractNo}.pdf`}
                      </Text>
                    )}
                    <MobileButton
                      variant="outline"
                      disabled={busy}
                      isLoading={pdfAction === "preview"}
                      onPress={() => void openBrokerAppointment(false)}
                    >
                      ดูสัญญาแต่งตั้งนายหน้า
                    </MobileButton>
                    <Text style={[s.small, muted]}>
                      {generated
                        ? "สร้างเอกสารพร้อมลายเซ็นครบแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้"
                        : complete
                          ? "ลงนามครบแล้ว ยืนยันและสร้างเอกสารได้ที่ด้านล่าง"
                          : "เอกสารตัวอย่างเปิดดูได้ก่อนลงนาม เมื่อเซ็นครบผู้ให้เช่าและนายหน้าจึงสร้างเอกสารได้"}
                    </Text>
                  </View>
                );
              }
              if (slot.kind === "lease_agreement") {
                if (
                  selected.leaseAgreementStatus != null ||
                  selected.data?.leaseAgreement != null
                ) {
                  const complete =
                    selected.leaseAgreementStatus === "ready_to_generate" ||
                    selected.leaseAgreementStatus === "ready";
                  const generated = selected.leaseAgreementStatus === "ready";
                  return (
                    <View
                      key={slot.kind}
                      style={[s.documentItem, { borderColor: theme.border }]}
                    >
                      <View style={s.documentHead}>
                        <View
                          style={[
                            s.documentStatus,
                            {
                              borderColor: generated
                                ? "#198460"
                                : theme.textSecondary,
                              backgroundColor: generated
                                ? "#19846018"
                                : theme.background,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              s.body,
                              {
                                color: generated
                                  ? "#198460"
                                  : theme.textSecondary,
                              },
                            ]}
                          >
                            {generated ? "✓" : "○"}
                          </Text>
                        </View>
                        <Text style={[s.documentTitle, title]}>{slot.name}</Text>
                      </View>
                      {generated && (
                        <Text style={[s.body, title]}>
                          {`lease-${selected.contractNo}.pdf`}
                        </Text>
                      )}
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        isLoading={pdfAction === "preview"}
                        onPress={() => void openLeaseAgreement(false)}
                      >
                        ดูสัญญาเช่า
                      </MobileButton>
                      <Text style={[s.small, muted]}>
                        {generated
                          ? "สร้างเอกสารพร้อมลายเซ็นครบแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้"
                          : complete
                            ? "ลงนามครบแล้ว ยืนยันและสร้างเอกสารได้ที่ด้านล่าง"
                            : "เอกสารตัวอย่างเปิดดูได้ก่อนลงนาม เมื่อเซ็นครบผู้ให้เช่าและผู้เช่าจึงสร้างเอกสารได้"}
                      </Text>
                    </View>
                  );
                }
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
                    <>
                      <View style={[s.documentFile, { backgroundColor: theme.background }]}>
                        <Text style={[s.body, title]} numberOfLines={2}>{fileName}</Text>
                      </View>
                      <MobileButton
                        variant="outline"
                        disabled={busy}
                        onPress={() =>
                          openDocumentPreview(fileName, slot.url!, slot.kind)
                        }
                      >
                        ดู
                      </MobileButton>
                    </>
                  ) : documentLocked ? (
                    <Text style={[s.small, muted]}>
                      ยังไม่ได้แนบเอกสารสำหรับรายการนี้
                    </Text>
                  ) : (
                    <>
                      <Text style={[s.small, muted]}>
                        ยังไม่ได้แนบเอกสารสำหรับรายการนี้
                      </Text>
                      <MobileButton
                        disabled={busy}
                        isLoading={uploadingKind === slot.kind}
                        onPress={() => setPickKind(slot.kind)}
                      >
                        แนบเอกสาร
                      </MobileButton>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
        {(selected.formKind === "reservation" ||
          selected.formKind === "lease") && (
          <AgreementAttachments
            key={selected.id}
            contractId={selected.id}
            formKind={selected.formKind}
            onReadinessChange={setAttachmentReadiness}
            refreshKey={`${selected.status}:${selected.ownerSignedAt}:${selected.tenantSignedAt}:${selected.agentSignedAt}:${selected.reservationLetterStatus}:${selected.leaseAgreementStatus}:${attachmentsNonce}`}
          />
        )}
        <View style={[s.card, card]}>
          <Text style={[s.subtitle, title]}>{docs.signatories}</Text>
          {attachmentsRequired && !attachmentsReady ? (
            <Text style={[s.small, muted]}>
              แนบเอกสารที่จำเป็นให้ครบก่อนลงนาม
            </Text>
          ) : null}
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
              {!party.signed &&
              !signingLocked(selected.status) &&
              !documentLocked ? (
                <View style={s.partyActions}>
                  {(party.key === "owner" || party.key === "tenant") && (
                    <MobileButton
                      variant="outline"
                      style={s.shareButton}
                      disabled={busy || !attachmentsReady}
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
                    disabled={busy || !attachmentsReady}
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
              <>
                <Text style={[s.small, muted]}>
                  สร้างเอกสารหนังสือจองแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openReservation(false)}
                >
                  ดูเอกสารฉบับสมบูรณ์
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  แนบหลักฐานกรรมสิทธิ์ และลงนามครบทั้ง 3 ฝ่าย แล้วกดยืนยันเพื่อสร้างเอกสาร
                </Text>
                <MobileButton
                  disabled={
                    busy ||
                    selected.reservationLetterStatus !== "ready_to_generate" ||
                    attachmentReadiness?.contractId !== selected.id ||
                    !attachmentReadiness.ready
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openReservation(true)}
                >
                  ยืนยันและสร้างเอกสาร
                </MobileButton>
              </>
            )}
          </View>
        )}
        {selected.formKind === "broker_appointment" && (
          <View style={[s.card, card]}>
            {selected.brokerAppointmentStatus === "ready" ? (
              <>
                <Text style={[s.small, muted]}>
                  สร้างเอกสารแต่งตั้งนายหน้าแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openBrokerAppointment(false)}
                >
                  ดูเอกสารฉบับสมบูรณ์
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  ลงนามครบทั้งผู้ให้เช่าและนายหน้า แล้วกดยืนยันเพื่อสร้างเอกสาร
                </Text>
                <MobileButton
                  disabled={
                    busy ||
                    selected.brokerAppointmentStatus !== "ready_to_generate"
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openBrokerAppointment(true)}
                >
                  ยืนยันและสร้างเอกสาร
                </MobileButton>
              </>
            )}
          </View>
        )}
        {selected.formKind === "lease" &&
          selected.leaseAgreementStatus != null && (
          <View style={[s.card, card]}>
            {selected.leaseAgreementStatus === "ready" ? (
              <>
                <Text style={[s.small, muted]}>
                  สร้างเอกสารสัญญาเช่าแล้ว — ดูได้อย่างเดียว แก้ไขไม่ได้
                </Text>
                <MobileButton
                  disabled={busy}
                  isLoading={pdfAction === "preview"}
                  onPress={() => void openLeaseAgreement(false)}
                >
                  ดูเอกสารฉบับสมบูรณ์
                </MobileButton>
              </>
            ) : (
              <>
                <Text style={[s.small, muted]}>
                  ลงนามครบทั้งผู้ให้เช่าและผู้เช่า แล้วกดยืนยันเพื่อสร้างเอกสาร
                </Text>
                <MobileButton
                  disabled={
                    busy ||
                    selected.leaseAgreementStatus !== "ready_to_generate" ||
                    !attachmentsReady
                  }
                  isLoading={pdfAction === "generate"}
                  onPress={() => void openLeaseAgreement(true)}
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
                  {(previewDoc.kind === "invoice" ||
                    previewDoc.kind === "receipt") &&
                    !reservationLocked && !draftCancelled && (
                      <MobileButton
                        disabled={busy}
                        onPress={() => {
                          const kind = previewDoc.kind as "invoice" | "receipt";
                          setPreviewDoc(null);
                          setFinancialKind(kind);
                        }}
                      >
                        {docs.financial.edit}
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
              setFocusDocuments(false);
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
                : contract.formKind === "broker_appointment"
                  ? `วันที่ออกเอกสาร ${date(contract.startDate)}`
                  : `${date(contract.startDate)} – ${date(contract.endDate)}`}
            </Text>
            <View style={s.row}>
              <Text style={[s.body, title]}>
                {contract.formKind === "reservation"
                  ? `เงินจอง ${money(contract.reservationFee)}`
                  : contract.formKind === "broker_appointment"
                    ? contract.monthlyRent
                      ? `ค่าเช่า ${money(contract.monthlyRent)} / เดือน`
                      : "แต่งตั้งนายหน้า"
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
  documentActions: { gap: 8 },
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
