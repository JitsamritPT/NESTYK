import React from "react";
import {
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
  type AppIconName,
} from "@nestyk/ui/native";

/** Create-menu options shown under 「เลือกประเภทสัญญา」. */
export type CreateDocumentKind =
  | "reservation"
  | "lease"
  | "invoice"
  | "receipt"
  | "broker_appointment"
  | "agent_commission";

const CREATE_OPTIONS: Array<{
  kind: CreateDocumentKind;
  label: string;
  icon: AppIconName;
}> = [
  { kind: "reservation", label: "หนังสือจองห้อง", icon: "calendar" },
  { kind: "lease", label: "สัญญาเช่า", icon: "key" },
  { kind: "invoice", label: "ใบแจ้งหนี้", icon: "note" },
  { kind: "receipt", label: "ใบเสร็จ", icon: "note" },
  { kind: "broker_appointment", label: "แต่งตั้งนายหน้า", icon: "handshake" },
  {
    kind: "agent_commission",
    label: "ข้อตกลงแบ่งค่าคอมมิชชั่นระหว่างเอเจนต์",
    icon: "users",
  },
];

export function ContractTypePicker({
  onSelect,
  onBack,
}: {
  onSelect: (kind: CreateDocumentKind) => void;
  onBack: () => void;
}) {
  const { theme } = useMobileTheme();
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
          ต้องการสร้างเอกสารอะไร?
        </Text>
      </View>
      <View style={styles.grid}>
        {CREATE_OPTIONS.map((option) => (
          <Pressable
            key={option.kind}
            accessibilityRole="button"
            accessibilityLabel={`สร้าง${option.label}`}
            onPress={() => onSelect(option.kind)}
            style={({ pressed }) => [
              styles.tile,
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <MobileIcon
              name={option.icon}
              size={30}
              color="#FFFFFF"
              weight="regular"
            />
            <Text style={styles.label}>{option.label}</Text>
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
    gap: 10,
  },
  label: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: "#FFFFFF",
  },
});
