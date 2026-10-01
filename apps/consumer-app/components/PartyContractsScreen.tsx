import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  MobileBottomSheet,
  MobileButton,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { PartyContract } from "@nestyk/types";
import { listMyContracts, signMyContract } from "../lib/party-contracts-api";
import {
  ContractSignaturePad,
  type ContractSignaturePadHandle,
} from "./ContractSignaturePad";

const PARTY_LABEL = { owner: "ผู้ให้เช่า", tenant: "ผู้เช่า" } as const;

export function PartyContractsScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useMobileTheme();
  const [rows, setRows] = useState<PartyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState<{
    contract: PartyContract;
    party: "owner" | "tenant";
  } | null>(null);
  const padRef = useRef<ContractSignaturePadHandle>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await listMyContracts());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "โหลดสัญญาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(image: string) {
    if (!signing || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await signMyContract(signing.contract.id, signing.party, image);
      setRows((current) => current.map((row) => (row.id === saved.id ? saved : row)));
      setSigning(null);
      setNotice("บันทึกลายเซ็นแล้ว");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "ลงนามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const title = { color: theme.textHeading, fontFamily: tokens.typography.native.headingTh };
  const body = { color: theme.textSecondary, fontFamily: tokens.typography.native.body };

  return (
    <View style={styles.root}>
      <MobileButton variant="outline" onPress={onBack}>
        ‹ กลับ
      </MobileButton>
      <Text style={[styles.heading, title]}>สัญญาที่ส่งมาให้ฉัน</Text>
      {!!notice && <Text style={[styles.copy, { color: theme.textHeading }]}>{notice}</Text>}
      {!!error && !signing && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
      {!loading && !rows.length && !error ? (
        <Text style={[styles.copy, body]}>ยังไม่มีสัญญาที่ส่งเข้าบัญชีนี้</Text>
      ) : null}
      {rows.map((row) => (
        <View
          key={row.id}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={[styles.contractNo, title]}>{row.contractNo}</Text>
          <Text style={[styles.copy, body]}>
            {row.agreementTypeName} · {row.property}
            {row.room ? ` ห้อง ${row.room}` : ""}
          </Text>
          <Text style={[styles.copy, body]}>ผู้เช่า {row.tenant}</Text>
          {row.myParties.map((party) => {
            const signed =
              party === "owner" ? row.ownerSignedAt : row.tenantSignedAt;
            return (
              <View key={party} style={styles.partyRow}>
                <Text style={[styles.copy, body]}>
                  {PARTY_LABEL[party]}
                  {signed ? " · ลงนามแล้ว" : " · ยังไม่ลงนาม"}
                </Text>
                {!signed && row.status !== "cancelled" ? (
                  <MobileButton
                    disabled={busy}
                    onPress={() => {
                      setError("");
                      setNotice("");
                      setSigning({ contract: row, party });
                    }}
                  >
                    ลงนาม
                  </MobileButton>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      <MobileBottomSheet
        visible={signing != null}
        onClose={() => !busy && setSigning(null)}
        maxHeight="90%"
      >
        <Text style={[styles.heading, title]}>
          ลงนาม{signing ? PARTY_LABEL[signing.party] : ""}
        </Text>
        <Text style={[styles.copy, body]}>วาดลายเซ็นในกรอบ แล้วกดยืนยัน</Text>
        {!!error && signing ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {signing ? (
          <ContractSignaturePad
            ref={padRef}
            onOK={(image) => {
              void submit(image);
            }}
            onEmpty={() => setError("กรุณาวาดลายเซ็นก่อนยืนยัน")}
          />
        ) : null}
        <View style={styles.actions}>
          <MobileButton
            variant="outline"
            disabled={busy}
            onPress={() => padRef.current?.clearSignature()}
          >
            ล้างลายเซ็น
          </MobileButton>
          <MobileButton disabled={busy} onPress={() => padRef.current?.readSignature()}>
            ยืนยันลายเซ็น
          </MobileButton>
        </View>
      </MobileBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 24 },
  heading: { fontSize: 20, lineHeight: 30 },
  contractNo: { fontSize: 16, lineHeight: 24 },
  copy: { fontSize: 14, lineHeight: 22 },
  error: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C74747",
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actions: { flexDirection: "row", gap: 10 },
});
