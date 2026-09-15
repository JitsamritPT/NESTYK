import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import {
  MobileBottomSheet,
  MobileButton,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgreementAttachment,
  AgreementAttachmentChecklist,
  AgreementDocumentSubject,
} from "@nestyk/types";
import {
  listAgreementAttachments,
  removeAgreementAttachment,
  openAgreementAttachment,
  reuseAgreementAttachment,
  uploadAgreementAttachment,
} from "../lib/agent-contracts-api";
import { ContractDocumentPreview } from "./ContractDocumentPreview";

const subjects: Record<AgreementDocumentSubject, string> = {
  tenant: "ผู้เช่า",
  owner: "ผู้ให้เช่า",
  property: "ห้อง / ทรัพย์สิน",
  representative: "ผู้รับมอบอำนาจ",
};
type Requirement = AgreementAttachmentChecklist["requirements"][number];
type Sheet =
  | { kind: "pickType"; requirement: Requirement }
  | { kind: "extraUpload" }
  | { kind: "reuse"; document: AgreementAttachment }
  | null;

function typeName(
  code: string,
  types: AgreementAttachmentChecklist["documentTypes"],
) {
  return types.find((t) => t.code === code)?.nameTh ?? code;
}

function currentDocForRequirement(
  requirement: Requirement,
  documents: AgreementAttachment[],
) {
  return documents.find(
    (d) =>
      d.isCurrent &&
      d.subject === requirement.subject &&
      requirement.documentTypeCodes.includes(d.documentTypeCode),
  );
}

function matchedCurrentIds(
  requirements: Requirement[],
  documents: AgreementAttachment[],
) {
  const ids = new Set<number>();
  for (const requirement of requirements) {
    const doc = currentDocForRequirement(requirement, documents);
    if (doc) ids.add(doc.id);
  }
  return ids;
}

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useMobileTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        {
          borderColor: selected ? "#FFBF19" : theme.border,
          backgroundColor: selected ? "#FFE29A" : theme.surface,
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
    >
      <Text
        style={[
          s.chipText,
          { color: selected ? "#202631" : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AgreementAttachments({
  contractId,
  refreshKey,
  onReadinessChange,
}: {
  contractId: number;
  refreshKey?: string;
  onReadinessChange?: (value: { contractId: number; ready: boolean }) => void;
}) {
  const { theme } = useMobileTheme();
  const [state, setState] = useState<AgreementAttachmentChecklist | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [extraSubject, setExtraSubject] =
    useState<AgreementDocumentSubject>("tenant");
  const [extraType, setExtraType] = useState("national_id");
  const running = useRef(false);
  const picking = useRef(false);
  const request = useRef(0);
  useEffect(() => {
    onReadinessChange?.({ contractId, ready: !busy && !!state?.readyToSign });
  }, [contractId, busy, state?.readyToSign, onReadinessChange]);
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };

  const progress = useMemo(() => {
    if (!state?.requirements.length) return null;
    const done = state.requirements.filter((r) =>
      currentDocForRequirement(r, state.documents),
    ).length;
    return { done, total: state.requirements.length };
  }, [state]);

  const extraDocs = useMemo(() => {
    if (!state) return [];
    const matched = matchedCurrentIds(state.requirements, state.documents);
    return state.documents.filter((d) => d.isCurrent && !matched.has(d.id));
  }, [state]);

  async function load() {
    const n = ++request.current;
    setError("");
    setBusy(true);
    try {
      const next = await listAgreementAttachments(contractId);
      if (n === request.current) setState(next);
    } catch (e) {
      if (n === request.current)
        setError(e instanceof Error ? e.message : "โหลดเอกสารไม่สำเร็จ");
    } finally {
      if (n === request.current) setBusy(false);
    }
  }

  useEffect(() => {
    setState(null);
    void load();
    return () => {
      request.current++;
    };
  }, [contractId, refreshKey]);

  async function act(action: () => Promise<void>) {
    if (running.current || busy) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function pickAndUpload(input: {
    subject: AgreementDocumentSubject;
    documentTypeCode: string;
    supersedesDocumentId?: number;
  }) {
    await act(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024)
        throw new Error("ไฟล์ต้องไม่เกิน 10 MB");
      setState(
        await uploadAgreementAttachment(
          contractId,
          {
            subject: input.subject,
            documentTypeCode: input.documentTypeCode,
            supersedesDocumentId: input.supersedesDocumentId,
          },
          {
            uri: file.uri,
            name: file.name,
            mimeType: file.mimeType ?? "application/octet-stream",
            file: file.file,
          },
        ),
      );
    });
  }

  function queuePickAndUpload(
    input: {
      subject: AgreementDocumentSubject;
      documentTypeCode: string;
      supersedesDocumentId?: number;
    },
    afterSheet = false,
  ) {
    if (picking.current || running.current || busy) return;
    picking.current = true;
    if (afterSheet) setSheet(null);
    setTimeout(() => {
      void (async () => {
        try {
          await pickAndUpload(input);
        } finally {
          picking.current = false;
        }
      })();
    }, afterSheet ? 400 : 0);
  }

  function startUploadForRequirement(requirement: Requirement) {
    if (requirement.documentTypeCodes.length === 1) {
      queuePickAndUpload({
        subject: requirement.subject,
        documentTypeCode: requirement.documentTypeCodes[0]!,
        supersedesDocumentId: currentDocForRequirement(
          requirement,
          state?.documents ?? [],
        )?.id,
      });
      return;
    }
    setSheet({ kind: "pickType", requirement });
  }

  async function openDoc(document: AgreementAttachment) {
    await act(async () => {
      const result = await openAgreementAttachment(contractId, document.id);
      setPreview({ name: document.fileName, url: result.url });
    });
  }

  function renderDocActions(
    document: AgreementAttachment,
    requirement?: Requirement,
  ) {
    const replace = () => {
      if (requirement) startUploadForRequirement(requirement);
      else
        queuePickAndUpload({
          subject: document.subject,
          documentTypeCode: document.documentTypeCode,
          supersedesDocumentId: document.id,
        });
    };
    return (
      <View style={s.actions}>
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => {
            void openDoc(document);
          }}
        >
          ดู
        </MobileButton>
        {state?.editable && document.isCurrent && (
          <MobileButton variant="outline" disabled={busy} onPress={replace}>
            อัปโหลดใหม่
          </MobileButton>
        )}
      </View>
    );
  }

  function renderRequirement(requirement: Requirement) {
    if (!state) return null;
    const doc = currentDocForRequirement(requirement, state.documents);
    const options = requirement.documentTypeCodes
      .map((code) => typeName(code, state.documentTypes))
      .join(" หรือ ");
    const complete = !!doc;
    const statusColor = complete ? "#198460" : theme.textSecondary;

    return (
      <View
        key={requirement.groupKey}
        style={[s.requirement, { borderColor: theme.border }]}
      >
        <View style={s.requirementHead}>
          <View
            style={[
              s.statusDot,
              {
                backgroundColor: `${statusColor}18`,
                borderColor: statusColor,
              },
            ]}
          >
            <Text style={[s.statusMark, { color: statusColor }]}>
              {complete ? "✓" : "○"}
            </Text>
          </View>
          <View style={s.requirementCopy}>
            <Text style={[s.requirementTitle, ink]}>{requirement.label}</Text>
            <Text style={[s.requirementHint, muted]}>{options}</Text>
          </View>
        </View>
        {doc ? (
          <View style={[s.docBox, { backgroundColor: theme.background }]}>
            <View style={s.docHead}>
              <Text style={[s.docName, ink]} numberOfLines={2}>
                {doc.fileName}
              </Text>

            </View>
            <Text style={[s.docMeta, muted]}>
              {subjects[doc.subject]} ·{" "}
              {typeName(doc.documentTypeCode, state.documentTypes)} ·{" "}
              {new Date(doc.createdAt).toLocaleDateString("th-TH")}
            </Text>

            {renderDocActions(doc, requirement)}
          </View>
        ) : (
          <>
            <Text style={[s.requirementHint, muted]}>
              ยังไม่ได้แนบเอกสารสำหรับรายการนี้
            </Text>
            {state.editable && (
              <MobileButton
                disabled={busy}
                onPress={() => startUploadForRequirement(requirement)}
              >
                แนบเอกสาร
              </MobileButton>
            )}
          </>
        )}
      </View>
    );
  }

  function renderExtraDoc(document: AgreementAttachment) {
    if (!state) return null;
    return (
      <View
        key={document.id}
        style={[s.extraFileRow, { backgroundColor: theme.background }]}
      >
          <Text style={[s.extraFileName, ink]} numberOfLines={1} ellipsizeMode="middle">
            {document.fileName}
          </Text>

          {state.editable && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`เอาไฟล์ ${document.fileName} ออก`}
              disabled={busy}
              style={({ pressed }) => [s.removeFileButton, { opacity: busy || pressed ? 0.5 : 1 }]}
              onPress={() => {
                void act(async () => {
                  setState(await removeAgreementAttachment(contractId, document.id));
                });
              }}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M6 6L18 18M18 6L6 18" stroke={theme.textSecondary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          )}
      </View>
    );
  }

  return (
    <View
      style={[
        s.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={s.header}>
        <Text style={[s.heading, ink]}>เอกสารประกอบสัญญา</Text>
        {progress && (
          <View style={[s.progressPill, { backgroundColor: "#FFE29A" }]}>
            <Text style={s.progressText}>
              {progress.done}/{progress.total} แนบแล้ว
            </Text>
          </View>
        )}
      </View>

      {busy && !state && <ActivityIndicator />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#C43D4C" }}>
          {error}
        </Text>
      )}

      {!state ? (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => {
            void load();
          }}
        >
          โหลดเอกสารอีกครั้ง
        </MobileButton>
      ) : (
        <>
          <Text style={[s.summary, muted]}>
            {!state.editable
              ? state.documents.length
                ? "เริ่มลงนามหรือปิดสัญญาแล้ว จึงแนบหรือแก้ไขเอกสารไม่ได้ สามารถเปิดดูไฟล์ที่แนบไว้ได้"
                : "ฉบับนี้ไม่มีเอกสารแนบ และเริ่มลงนามหรือปิดสัญญาแล้ว จึงแนบเพิ่มไม่ได้ ต้องแนบเอกสารก่อนเริ่มลงนาม"
              : state.readyToSign
                ? "เอกสารที่จำเป็นครบแล้ว พร้อมลงนาม"
                : progress && progress.done === progress.total
                  ? "แนบเอกสารที่จำเป็นครบแล้ว"
                : state.requirements.length
                  ? "แนบเอกสารที่จำเป็นให้ครบก่อนลงนาม"
                  : "แม่แบบนี้ไม่บังคับเอกสาร สามารถแนบเพิ่มได้ตามต้องการ"}
          </Text>

          {state.requirements.map(renderRequirement)}

          {(extraDocs.length > 0 || state.editable) && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, ink]}>เอกสารเพิ่มเติม</Text>
              {extraDocs.length === 0 ? (
                <Text style={[s.requirementHint, muted]}>
                  ยังไม่มีเอกสารเพิ่มเติม
                </Text>
              ) : (
                extraDocs.map(renderExtraDoc)
              )}
              {state.editable && (
                <MobileButton
                  variant="outline"
                  disabled={busy}
                  onPress={() => {
                    setExtraSubject("tenant");
                    setExtraType(state.documentTypes.some((t) => t.code === "other") ? "other" : state.documentTypes[0]?.code ?? "national_id");
                    setSheet({ kind: "extraUpload" });
                  }}
                >
                  แนบเอกสารเพิ่ม
                </MobileButton>
              )}
            </View>
          )}

          {state.editable && state.reusableDocuments.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, ink]}>ใช้จากสัญญาก่อนหน้า</Text>
              <Text style={[s.requirementHint, muted]}>
                เลือกเอกสารที่ยังเป็นปัจจุบันเพื่อแนบในสัญญานี้
              </Text>
              {state.reusableDocuments.map((document) => (
                <View
                  key={document.id}
                  style={[s.reuseRow, { borderColor: theme.border }]}
                >
                  <View style={s.grow}>
                    <Text style={[s.docName, ink]} numberOfLines={1}>
                      {document.fileName}
                    </Text>
                    <Text style={[s.docMeta, muted]}>
                      {subjects[document.subject]} ·{" "}
                      {typeName(document.documentTypeCode, state.documentTypes)}
                    </Text>
                  </View>
                  <MobileButton
                    variant="outline"
                    disabled={busy}
                    onPress={() => setSheet({ kind: "reuse", document })}
                  >
                    ใช้เอกสารนี้
                  </MobileButton>
                </View>
              ))}
            </View>
          )}


        </>
      )}

      <MobileBottomSheet
        visible={sheet?.kind === "pickType"}
        onClose={() => setSheet(null)}
      >
        <View style={s.sheet}>
          <Text style={[s.sheetTitle, ink]}>เลือกประเภทเอกสาร</Text>
          <Text style={[s.requirementHint, muted]}>
            {sheet?.kind === "pickType" ? sheet.requirement.label : ""}
          </Text>
          {sheet?.kind === "pickType" &&
            sheet.requirement.documentTypeCodes.map((code) => (
              <MobileButton
                key={code}
                disabled={busy}
                onPress={() => {
                  queuePickAndUpload(
                    {
                      subject: sheet.requirement.subject,
                      documentTypeCode: code,
                      supersedesDocumentId: currentDocForRequirement(
                        sheet.requirement,
                        state?.documents ?? [],
                      )?.id,
                    },
                    true,
                  );
                }}
              >
                {typeName(code, state?.documentTypes ?? [])}
              </MobileButton>
            ))}
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            ยกเลิก
          </MobileButton>
        </View>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={sheet?.kind === "extraUpload"}
        onClose={() => setSheet(null)}
      >
        <ScrollView style={s.sheet} contentContainerStyle={{ gap: 12 }}>
          <Text style={[s.sheetTitle, ink]}>แนบเอกสารเพิ่ม</Text>
          <Text style={[s.requirementHint, muted]}>เอกสารของ</Text>
          <View style={s.chips}>
            {(Object.keys(subjects) as AgreementDocumentSubject[]).map(
              (value) => (
                <Chip
                  key={value}
                  label={subjects[value]}
                  selected={extraSubject === value}
                  onPress={() => setExtraSubject(value)}
                />
              ),
            )}
          </View>
          <Text style={[s.requirementHint, muted]}>ประเภทเอกสาร</Text>
          <View style={s.chips}>
            {state?.documentTypes.map((t) => (
              <Chip
                key={t.code}
                label={t.nameTh}
                selected={extraType === t.code}
                onPress={() => setExtraType(t.code)}
              />
            ))}
          </View>
          <Text style={[s.requirementHint, muted]}>
            PDF, JPEG หรือ PNG · ไม่เกิน 10 MB
          </Text>
          <MobileButton
            disabled={busy}
            onPress={() => {
              queuePickAndUpload(
                {
                  subject: extraSubject,
                  documentTypeCode: extraType,
                },
                true,
              );
            }}
          >
            เลือกไฟล์และแนบ
          </MobileButton>
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            ยกเลิก
          </MobileButton>
        </ScrollView>
      </MobileBottomSheet>

      <MobileBottomSheet
        visible={sheet?.kind === "reuse"}
        onClose={() => setSheet(null)}
      >
        <View style={s.sheet}>
          <Text style={[s.sheetTitle, ink]}>
            ใช้เอกสารจากสัญญาก่อนหน้า
          </Text>
          {sheet?.kind === "reuse" && (
            <Text style={[s.requirementHint, muted]}>
              {sheet.document.fileName}
            </Text>
          )}
          <Text style={[s.requirementHint, muted]}>
            ยืนยันว่าเอกสารนี้ยังเป็นปัจจุบันเพื่อแนบสำเนาในสัญญานี้
          </Text>
          <MobileButton
            disabled={busy}
            onPress={() => {
              if (sheet?.kind !== "reuse") return;
              void act(async () => {
                setState(
                  await reuseAgreementAttachment(
                    contractId,
                    sheet.document.id,
                  ),
                );
                setSheet(null);
              });
            }}
          >
            ยืนยันใช้เอกสาร
          </MobileButton>
          <MobileButton variant="outline" onPress={() => setSheet(null)}>
            ยกเลิก
          </MobileButton>
        </View>
      </MobileBottomSheet>

      <Modal
        visible={!!preview}
        onRequestClose={() => setPreview(null)}
        animationType="slide"
      >
        <View style={[s.modal, { backgroundColor: theme.surface }]}>
          <Text style={[s.heading, ink]}>{preview?.name}</Text>
          <MobileButton variant="outline" onPress={() => setPreview(null)}>
            ปิดเอกสาร
          </MobileButton>
          {preview && <ContractDocumentPreview url={preview.url} />}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 14, borderWidth: 1, borderRadius: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  progressPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: "#202631",
    fontWeight: "600",
  },
  summary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  requirement: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  requirementHead: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusMark: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  requirementCopy: { flex: 1, gap: 2, minWidth: 0 },
  requirementTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  requirementHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
  },
  extraFileRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
    borderRadius: 12,
  },
  extraFileName: {
    flex: 1,
    minWidth: 0,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  removeFileButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  docBox: { gap: 8, padding: 12, borderRadius: 12 },
  docHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  docName: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  docMeta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
  },
  actions: { gap: 8 },
  reuseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
  },
  sheet: { padding: 20, gap: 12 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  modal: { flex: 1, padding: 20, paddingTop: 50, gap: 12 },
});
