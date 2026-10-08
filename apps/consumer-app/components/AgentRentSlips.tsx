import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "@nestyk/i18n";
import { MobileBottomSheet, MobileButton, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { TenantBill } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { confirmAgentRentSlip, listAgentRentSlips, openAgentRentSlip, returnAgentRentSlip } from "../lib/tenant-bills-api";
import { ContractDocumentPreview } from "./ContractDocumentPreview";

export function AgentRentSlips({ reloadToken = 0 }: { reloadToken?: number }) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.agent.dashboard;
  const { month, amount } = billFormatters(locale);
  const [rows, setRows] = useState<TenantBill[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [decision, setDecision] = useState<{ bill: TenantBill; kind: "confirm" | "return" } | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAgentRentSlips()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : copy.rentSlipsLoadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, copy.rentSlipsLoadFailed]);

  if (!rows.length && !error && !notice) return null;

  async function submit(next: { bill: TenantBill; kind: "confirm" | "return" }) {
    if (confirmingId != null) return;
    setError("");
    setNotice("");
    setConfirmingId(next.bill.id);
    try {
      if (next.kind === "confirm") await confirmAgentRentSlip(next.bill.id);
      else await returnAgentRentSlip(next.bill.id, returnReason.trim());
      setRows((current) => current.filter((row) => row.id !== next.bill.id));
      setNotice(next.kind === "confirm" ? copy.rentSlipsConfirmed : copy.rentSlipsReturned);
      setReturnReason("");
      setDecision(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.rentSlipsLoadFailed);
    } finally {
      setConfirmingId(null);
    }
  }

  async function viewSlip(bill: TenantBill) {
    setError("");
    try {
      const { url } = await openAgentRentSlip(bill.id);
      setPreview({ url, title: bill.documentNo });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.rentSlipsLoadFailed);
    }
  }

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.heading, title]}>{copy.rentSlipsTitle}</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {rows.map((bill) => (
        <View key={bill.id} style={styles.item}>
          <View style={styles.grow}>
            <Text style={[styles.copy, title]} numberOfLines={1}>
              {bill.tenantName || copy.rentSlipsTitle}
            </Text>
            <Text style={[styles.caption, body]}>
              {t.owner.bills.rentFor.replace("{month}", month(bill.period))} · {amount(bill.amount)}
            </Text>
          </View>
          <View style={styles.actions}>
            <MobileButton variant="outline" disabled={confirmingId != null} onPress={() => void viewSlip(bill)}>{t.owner.bills.viewSlip}</MobileButton>
            <MobileButton variant="outline" disabled={confirmingId != null} onPress={() => { setReturnReason(""); setDecision({ bill, kind: "return" }); }}>
              {copy.rentSlipsReturn}
            </MobileButton>
            <MobileButton disabled={confirmingId != null} onPress={() => setDecision({ bill, kind: "confirm" })}>
              {copy.rentSlipsConfirm}
            </MobileButton>
          </View>
        </View>
      ))}
      <MobileBottomSheet
        visible={decision != null}
        avoidKeyboard
        onClose={() => {
          if (confirmingId == null) {
            setReturnReason("");
            setDecision(null);
          }
        }}
      >
        <View style={styles.decision}>
          <Text style={[styles.heading, title]}>
            {decision?.kind === "return" ? copy.rentSlipsReturnTitle : copy.rentSlipsConfirmTitle}
          </Text>
          <Text style={[styles.copy, body]}>
            {decision?.kind === "return" ? copy.rentSlipsReturnBody : copy.rentSlipsConfirmBody}
          </Text>
          {decision?.kind === "return" ? (
            <MobileInput
              label={copy.rentSlipsReturnReason}
              placeholder={copy.rentSlipsReturnReasonPlaceholder}
              value={returnReason}
              onChangeText={setReturnReason}
              multiline
              maxLength={500}
              required
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <MobileButton
              style={styles.decisionButton}
              variant="outline"
              disabled={confirmingId != null}
              onPress={() => setDecision(null)}
            >
              {copy.rentSlipsCancel}
            </MobileButton>
            <MobileButton
              style={styles.decisionButton}
              isLoading={confirmingId != null}
              disabled={decision == null || confirmingId != null || (decision.kind === "return" && !returnReason.trim())}
              onPress={() => {
                if (decision) void submit(decision);
              }}
            >
              {decision?.kind === "return" ? copy.rentSlipsReturn : copy.rentSlipsConfirm}
            </MobileButton>
          </View>
        </View>
      </MobileBottomSheet>
      <MobileBottomSheet visible={preview != null} onClose={() => setPreview(null)} maxHeight="90%">
        <View style={styles.previewSheet}>
          <Text style={[styles.copy, title]} numberOfLines={1}>{preview?.title}</Text>
          <MobileButton variant="outline" onPress={() => setPreview(null)}>{t.owner.bills.close}</MobileButton>
          {preview ? (
            <View style={styles.preview}>
              <ContractDocumentPreview url={preview.url} />
            </View>
          ) : null}
        </View>
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  heading: { fontSize: 16, lineHeight: 24 },
  item: { gap: 8 },
  grow: { gap: 2 },
  copy: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  decision: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  decisionButton: { flexGrow: 1, flexBasis: 120 },
  notice: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, color: "#166534" },
  error: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, color: tokens.colors.danger },
  previewSheet: { height: "90%", paddingHorizontal: 16, gap: 8 },
  preview: { flex: 1, minHeight: 280 },
});
