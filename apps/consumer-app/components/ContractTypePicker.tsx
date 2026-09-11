import React, { useEffect, useState } from "react";
import type { AgreementType } from "@nestyk/types";
import { listAgreementTypes } from "../lib/agent-contracts-api";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MobileButton,
  MobileIcon,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";

export function ContractTypePicker({
  onSelect,
  onBack,
}: {
  onSelect: (type: AgreementType) => void;
  onBack: () => void;
}) {
  const { theme } = useMobileTheme();
  const [contractTypes, setTypes] = useState<AgreementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listAgreementTypes()
      .then((rows) => {
        if (!cancelled) setTypes(rows);
      })
      .catch(() => {
        if (!cancelled) setError("โหลดประเภทสัญญาไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  return (
    <View style={styles.root}>
      <MobileButton variant="outline" onPress={onBack}>
        ‹ กลับไปหน้าสัญญา
      </MobileButton>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.textHeading }]}>
          เลือกประเภทสัญญา
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          ต้องการสร้างสัญญาอะไร?
        </Text>
      </View>
      {loading && <ActivityIndicator />}
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={{ color: theme.textHeading }}>
            {error}
          </Text>
          <MobileButton
            variant="outline"
            onPress={() => setRetry((n) => n + 1)}
          >
            ลองอีกครั้ง
          </MobileButton>
        </View>
      )}
      {!loading && !error && !contractTypes.length && (
        <Text style={{ color: theme.textSecondary }}>
          ยังไม่มีประเภทสัญญาที่เปิดใช้งาน
        </Text>
      )}
      <View style={styles.grid}>
        {(!loading && !error ? contractTypes : []).map((type) => (
          <Pressable
            key={type.code}
            accessibilityRole="button"
            accessibilityLabel={`สร้าง${type.nameTh}`}
            onPress={() => onSelect(type)}
            style={({ pressed }) => [
              styles.tile,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <MobileIcon
              name={
                type.icon === "calendar"
                  ? "calendar"
                  : type.icon === "key"
                    ? "key"
                    : "note"
              }
              size={30}
              color="#FFFFFF"
              weight="regular"
            />
            <Text style={styles.label}>{type.nameTh}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 22, paddingBottom: 24 },
  heading: { gap: 6 },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
  },
  description: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 23,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "31%",
    maxWidth: 160,
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#008CC4",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 12,
  },
  label: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    color: "#FFFFFF",
  },
});
