import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { AppIconName } from "@nestyk/ui/native";
import type {
  AgreementAttachmentChecklist,
  AgreementDocumentSubject,
  PartyContract,
} from "@nestyk/types";
import {
  listMyAttachments,
  openMyAttachment,
  openMyContractDocument,
  signMyContract,
  uploadMyAttachment,
  openMyFinancialDocument,
  uploadMyReservationPaymentSlip,
} from "../lib/party-contracts-api";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import { ReservationPaymentCard } from "./ReservationPaymentCard";
import { bookingPaymentBlocksSigning, BOOKING_PAYMENT_BEFORE_SIGNING } from "../lib/contract-signing";

const CONTRACT_ICON: Record<PartyContract["formKind"], AppIconName> = {
  reservation: "calendar",
  lease: "key",
  broker_appointment: "handshake",
};

const PARTY_LABEL = {
  owner: "ผู้ให้เช่า",
  tenant: "ผู้เช่า",
  agent: "นายหน้า",
} as const;

const STATUS_LABEL: Record<PartyContract["status"], string> = {
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

function statusColor(status: PartyContract["status"]) {
  if (status === "active") return "#278268";
  if (status.startsWith("awaiting")) return "#BB7914";
  return "#788193";
}

function money(value: number | null) {
  return value == null
    ? "ยังไม่ระบุ"
    : `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

function dateLabel(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "ยังไม่ระบุ";
}

function signerKeys(row: PartyContract): Array<keyof typeof PARTY_LABEL> {
  if (row.formKind === "lease") return ["owner", "tenant"];
  if (row.formKind === "broker_appointment") return ["owner", "agent"];
  return ["owner", "tenant", "agent"];
}

function signedAt(row: PartyContract, party: keyof typeof PARTY_LABEL) {
  if (party === "owner") return row.ownerSignedAt;
  if (party === "tenant") return row.tenantSignedAt;
  return row.agentSignedAt;
}

export function PartyContractDetail({
  contract,
  accentColor = tokens.colors.roles.owner,
  onUpdated,
  reloadToken = 0,
  onReloadSettled,
  refreshError,
  refreshing = false,
}: {
  contract: PartyContract;
  accentColor?: string;
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
  refreshError?: string;
  refreshing?: boolean;
  onUpdated: (next: PartyContract) => void;
}) {
  const { theme } = useMobileTheme();
  const [attachments, setAttachments] = useState<AgreementAttachmentChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [slipSourceOpen, setSlipSourceOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [signing, setSigning] = useState<"owner" | "tenant" | null>(null);
  const [signPadKey, setSignPadKey] = useState(0);
  const padRef = useRef<ContractSignaturePadHandle>(null);

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };
  const card = { backgroundColor: theme.card, borderColor: theme.border };
  const mine = contract.myParties;
  const ownRequirements = (attachments?.requirements ?? []).filter((row) =>
    mine.includes(row.subject as "owner" | "tenant"),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listMyAttachments(contract.id)
      .then((next) => {
        if (!cancelled) setAttachments(next);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error && e.message ? e.message : "โหลดเอกสารไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          onReloadSettled?.(reloadToken);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contract.id, reloadToken, onReloadSettled]);

  useEffect(() => {
    if (!signing) return;
    const timer = setTimeout(() => padRef.current?.reinitialize?.(), 320);
    return () => clearTimeout(timer);
  }, [signing, signPadKey]);

  async function upload(
    subject: AgreementDocumentSubject,
    documentTypeCode: string,
    supersedesDocumentId?: number,
  ) {
    setPicking(documentTypeCode);
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024)
        throw new Error("ไฟล์ต้องไม่เกิน 10 MB");
      setBusy(true);
      setAttachments(
        await uploadMyAttachment(
          contract.id,
          { subject, documentTypeCode, supersedesDocumentId },
          {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType ?? "application/octet-stream",
            file: file.file,
          },
        ),
      );
      setNotice("แนบเอกสารแล้ว");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "แนบเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
      setPicking(null);
    }
  }

  async function openDocument() {
    setPreviewBusy(true);
    setError("");
    setPreviewTitle("เอกสารสัญญา");
    try {
      const ready =
        contract.formKind === "reservation"
          ? contract.reservationLetterUrl
          : contract.formKind === "broker_appointment"
            ? contract.brokerAppointmentUrl
            : contract.leaseDocumentUrl;
      if (ready) {
        setPreviewUrl(ready);
        return;
      }
      const doc = await openMyContractDocument(contract.id);
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "เปิดสัญญาไม่สำเร็จ");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function openFile(documentId: number) {
    setBusy(true);
    setError("");
    setPreviewTitle("เอกสารแนบ");
    try {
      const doc = await openMyAttachment(contract.id, documentId);
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "เปิดเอกสารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function openPaymentDocument(kind: "invoice" | "receipt" | "payment-slip") {
    setPreviewBusy(true);
    setError("");
    try {
      const doc = await openMyFinancialDocument(contract.id, kind);
      setPreviewTitle(kind === "invoice" ? "ใบแจ้งหนี้ค่าจอง" : kind === "receipt" ? "ใบเสร็จค่าจอง" : "สลิปชำระค่าจอง");
      setPreviewUrl(doc.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดเอกสารไม่สำเร็จ");
    } finally {
      setPreviewBusy(false);
    }
  }

  function chooseSlipSource(source: "documents" | "photos") {
    setSlipSourceOpen(false);
    setTimeout(() => void uploadPaymentSlip(source), 400);
  }

  async function uploadPaymentSlip(source: "documents" | "photos") {
    if (busy || picking) return;
    setPicking("payment-slip");
    setError("");
    setNotice("");
    try {
      let file: { uri: string; name: string; mimeType: string; file?: File };
      if (source === "photos") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("กรุณาอนุญาตให้เข้าถึงรูปภาพเพื่อแนบสลิป");
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 1, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่เกิน 10 MB");
        file = { uri: asset.uri, name: asset.fileName || "slip.jpg", mimeType: asset.mimeType || "image/jpeg", file: asset.file };
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true, multiple: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.size && asset.size > 10 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่เกิน 10 MB");
        file = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", file: asset.file };
      }
      setBusy(true);
      const updated = await uploadMyReservationPaymentSlip(contract.id, file);
      onUpdated(updated);
      setNotice("ส่งสลิปแล้ว รอเอเจนต์ตรวจสอบและออกใบเสร็จ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setBusy(false);
      setPicking(null);
    }
  }

  async function submit(image: string) {
    if (!signing || busy) return;
    if (bookingPaymentBlocksSigning(contract, signing)) {
      setError(BOOKING_PAYMENT_BEFORE_SIGNING);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await signMyContract(contract.id, signing, image);
      onUpdated(saved);
      setSigning(null);
      setNotice("บันทึกลายเซ็นแล้ว");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "ลงนามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const canSignNow = [
    "draft",
    "awaiting_signatures",
    "awaiting_agent_review",
  ].includes(contract.status);
  const signParty = canSignNow
    ? mine.find((party) => !signedAt(contract, party))
    : undefined;
  const paymentBlocksSigning = bookingPaymentBlocksSigning(contract, signParty);
  const partyReady = ownRequirements
    .filter((row) => row.subject === signParty)
    .every((row) => row.complete);

  return (
    <View style={styles.root}>
      {!!notice && <Text style={[styles.copy, { color: theme.textHeading }]}>{notice}</Text>}
      {!!refreshError && <Text accessibilityRole="alert" style={styles.error}>{refreshError}</Text>}
      {!!error && !signing && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={[styles.card, card]}>
        <Text style={[styles.eyebrow, { color: tokens.colors.brand[500] }]}>E-CONTRACT</Text>
        <View style={styles.cardHeader}>
          <Text style={[styles.heading, title, styles.flex]}>{contract.property}</Text>
          <View style={[styles.badge, { backgroundColor: `${statusColor(contract.status)}15` }]}>
            <Text style={[styles.badgeLabel, { color: statusColor(contract.status) }]}>
              {STATUS_LABEL[contract.status]}
            </Text>
          </View>
        </View>
        <View style={styles.contractLine}>
          <View style={[styles.kindIcon, { backgroundColor: `${accentColor}18` }]}>
            <MobileIcon name={CONTRACT_ICON[contract.formKind]} size={18} color={accentColor} />
          </View>
          <Text style={[styles.copy, title, styles.contractNoText]}>
            เลขที่สัญญา {contract.contractNo}
          </Text>
        </View>
        <Text style={[styles.copy, body]}>
          {contract.tenant}
          {contract.room ? ` · ห้อง ${contract.room}` : ""}
        </Text>
        <Text style={[styles.copy, body]}>
          {contract.agreementTypeName}
          {contract.formKind === "reservation"
            ? ` · เงินจอง ${money(contract.reservationFee)}`
            : contract.formKind === "lease"
              ? ` · ค่าเช่า ${money(contract.monthlyRent)}`
              : ""}
        </Text>
        <Text style={[styles.copy, body]}>
          {contract.formKind === "reservation"
            ? `วันที่จอง ${dateLabel(contract.bookingDate)} · วันที่เข้าอยู่ ${dateLabel(contract.moveInDate)}`
            : contract.formKind === "broker_appointment"
              ? `วันที่ ${dateLabel(contract.startDate)}`
              : `${dateLabel(contract.startDate)} – ${dateLabel(contract.endDate)}`}
        </Text>
        <MobileButton
          variant="outline"
          disabled={previewBusy}
          isLoading={previewBusy}
          onPress={() => void openDocument()}
        >
          ดูเอกสารสัญญา
        </MobileButton>
      </View>

      {contract.formKind === "reservation" && (
        <ReservationPaymentCard
          contract={contract}
          busy={busy || previewBusy || refreshing || picking != null}
          onOpen={(kind) => void openPaymentDocument(kind)}
          onUpload={mine.includes("tenant") ? () => setSlipSourceOpen(true) : undefined}
        />
      )}

      <View style={[styles.card, card]}>
        <Text style={[styles.contractNo, title]}>เอกสารที่จำเป็นของฉัน</Text>
        {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
        {!loading && !ownRequirements.length ? (
          <Text style={[styles.copy, body]}>ไม่มีเอกสารที่ฝ่ายคุณต้องแนบ</Text>
        ) : null}
        {ownRequirements.map((requirement) => {
          const doc = attachments?.documents.find(
            (item) =>
              item.isCurrent &&
              item.subject === requirement.subject &&
              requirement.documentTypeCodes.includes(item.documentTypeCode),
          );
          const typeLabel = requirement.documentTypeCodes
            .map(
              (code) =>
                attachments?.documentTypes.find((type) => type.code === code)?.nameTh ??
                code,
            )
            .join(" หรือ ");
          return (
            <View key={requirement.groupKey} style={styles.requirement}>
              <Text style={[styles.copy, title]}>
                {requirement.complete ? "✓ " : "○ "}
                {requirement.label}
              </Text>
              <Text style={[styles.copy, body]}>{typeLabel}</Text>
              {doc ? (
                <MobileButton
                  variant="outline"
                  disabled={busy || refreshing}
                  onPress={() => void openFile(doc.id)}
                >
                  ดู {doc.fileName}
                </MobileButton>
              ) : null}
              {attachments?.editable ? (
                <MobileButton
                  disabled={busy || refreshing}
                  isLoading={picking != null && busy}
                  onPress={() => {
                    const current = doc?.id;
                    if (requirement.documentTypeCodes.length === 1) {
                      void upload(
                        requirement.subject,
                        requirement.documentTypeCodes[0]!,
                        current,
                      );
                      return;
                    }
                    setPicking(requirement.groupKey);
                  }}
                >
                  {doc ? "อัปโหลดใหม่" : "แนบเอกสาร"}
                </MobileButton>
              ) : null}
              {picking === requirement.groupKey ? (
                <View style={styles.typeRow}>
                  {requirement.documentTypeCodes.map((code) => (
                    <MobileButton
                      key={code}
                      variant="outline"
                      disabled={busy || refreshing}
                      onPress={() => {
                        setPicking(null);
                        void upload(requirement.subject, code, doc?.id);
                      }}
                    >
                      {attachments?.documentTypes.find((type) => type.code === code)?.nameTh ??
                        code}
                    </MobileButton>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.card, card]}>
        <Text style={[styles.contractNo, title]}>การลงนาม</Text>
        {signerKeys(contract).map((party) => {
          const signed = signedAt(contract, party);
          return (
            <Text key={party} style={[styles.copy, signed ? styles.signed : body]}>
              {PARTY_LABEL[party]}
              {signed ? " · ลงนามแล้ว" : " · ยังไม่ลงนาม"}
            </Text>
          );
        })}
        {signParty && attachments && !partyReady ? (
          <Text style={[styles.copy, body]}>แนบเอกสารของคุณให้ครบก่อนลงนาม</Text>
        ) : null}
        {signParty ? (
          <>
            {paymentBlocksSigning && (
              <Text style={[styles.copy, body]}>{BOOKING_PAYMENT_BEFORE_SIGNING}</Text>
            )}
            <MobileButton
              disabled={busy || refreshing || loading || !attachments || !partyReady || paymentBlocksSigning}
              onPress={() => {
                setError("");
                setNotice("");
                setSignPadKey((key) => key + 1);
                setSigning(signParty);
              }}
            >
              ลงนาม{PARTY_LABEL[signParty]}
            </MobileButton>
          </>
        ) : null}
      </View>

      <MobileBottomSheet visible={slipSourceOpen} onClose={() => setSlipSourceOpen(false)} maxHeight="50%">
        <View style={{ gap: 12, padding: 16 }}>
          <Text style={[styles.contractNo, title]}>แนบสลิปชำระค่าจอง</Text>
          <MobileButton onPress={() => chooseSlipSource("photos")}>เลือกจากรูปภาพ</MobileButton>
          <MobileButton variant="outline" onPress={() => chooseSlipSource("documents")}>เลือกจากไฟล์</MobileButton>
          <MobileButton variant="outline" onPress={() => setSlipSourceOpen(false)}>ยกเลิก</MobileButton>
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={previewUrl != null}
        onClose={() => setPreviewUrl(null)}
        maxHeight="94%"
        sheetStyle={styles.previewSheet}
      >
        <View style={styles.previewHeader}>
          <Text style={[styles.contractNo, title]}>{previewTitle} · {contract.contractNo}</Text>
          <MobileButton variant="outline" onPress={() => setPreviewUrl(null)}>
            ปิด
          </MobileButton>
        </View>
        {previewUrl ? (
          <View style={styles.preview}>
            <ContractDocumentPreview url={previewUrl} />
          </View>
        ) : null}
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={signing != null}
        onClose={() => !busy && setSigning(null)}
        maxHeight="90%"
        sheetStyle={styles.signSheet}
      >
        {signing ? (
          <>
            <Text style={[styles.heading, title]}>ลงนาม{PARTY_LABEL[signing]}</Text>
            <Text style={[styles.copy, body]}>
              {contract.contractNo} · {contract.property}
              {contract.room ? ` ห้อง ${contract.room}` : ""}
            </Text>
            <Text style={[styles.copy, body]}>วาดลายเซ็นในกรอบ แล้วกดยืนยัน</Text>
            {!!error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <ContractSignaturePad
              key={`${signPadKey}-${signing}`}
              ref={padRef}
              onOK={(image) => {
                void submit(image);
              }}
              onEmpty={() => setError("กรุณาวาดลายเซ็นก่อนยืนยัน")}
            />
            <View style={styles.signActions}>
              <MobileButton
                variant="outline"
                style={styles.signButton}
                disabled={busy || refreshing}
                onPress={() => padRef.current?.clearSignature()}
              >
                ล้างลายเซ็น
              </MobileButton>
              <MobileButton
                style={styles.signButton}
                disabled={busy || refreshing}
                isLoading={busy}
                onPress={() => {
                  if (!busy) padRef.current?.readSignature();
                }}
              >
                ยืนยันลายเซ็น
              </MobileButton>
            </View>
          </>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  heading: { fontSize: 22, lineHeight: 33 },
  eyebrow: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1,
  },
  contractNo: { fontSize: 16, lineHeight: 24 },
  copy: { fontSize: 14, lineHeight: 22, fontFamily: tokens.typography.native.body },
  signed: { color: "#166534", fontFamily: tokens.typography.native.body },
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  contractLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contractNoText: { flex: 1 },
  flex: { flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  requirement: { gap: 6, paddingTop: 8 },
  typeRow: { gap: 8 },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  preview: { flex: 1, minHeight: 280 },
  signSheet: { paddingHorizontal: 20, gap: 12, flexGrow: 0 },
  signActions: { flexDirection: "row", gap: 10 },
  signButton: { flex: 1 },
});
