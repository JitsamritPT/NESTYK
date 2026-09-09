import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { FacilityOption } from "@nestyk/types";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
} from "@nestyk/ui/native";

export function RoomFacilitiesEditor({
  options,
  selected,
  onChange,
  custom,
  onCustomChange,
  loading,
  error,
  onRetry,
  color,
}: {
  options: FacilityOption[];
  selected: FacilityOption[];
  onChange: (value: FacilityOption[]) => void;
  custom: string;
  onCustomChange: (value: string) => void;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  color: string;
}) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const key = (f: FacilityOption) => `${f.groupCode ?? ""}:${f.code}`;
  const chosen = new Set(selected.map(key));
  const all = [
    ...options,
    ...selected.filter((f) => !options.some((o) => key(o) === key(f))),
  ];
  const groups = [...new Set(all.map((f) => f.groupCode ?? "other"))];
  const icons = {
    popular: "sparkle",
    in_room_home: "home",
    safety_security: "shield",
    services_facilities: "grid",
  } as const;
  return (
    <View style={styles.body}>
      <Text style={styles.hint}>{cr.facilitiesHint}</Text>
      {loading && <ActivityIndicator color={color} />}
      {!!error && (
        <>
          <Text style={styles.error}>{error}</Text>
          <MobileButton variant="outline" onPress={onRetry}>
            {t.agent.listings.retry}
          </MobileButton>
        </>
      )}
      {groups.map((groupCode) => {
        const items = all.filter((f) => (f.groupCode ?? "other") === groupCode);
        const checked = items.filter((f) => chosen.has(key(f))).length;
        const allChecked = checked === items.length;
        return (
          <View key={groupCode} style={styles.group}>
            <View style={styles.header}>
              <MobileIcon
                name={icons[groupCode as keyof typeof icons] ?? "grid"}
                color={color}
                size={22}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.heading}>
                  {t.masters.facilityGroups[groupCode] ?? groupCode}
                </Text>
                <Text style={styles.hint}>
                  {checked}/{items.length}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChange(
                    allChecked
                      ? selected.filter(
                          (f) => !items.some((o) => key(o) === key(f)),
                        )
                      : [
                          ...selected,
                          ...items.filter((f) => !chosen.has(key(f))),
                        ],
                  )
                }
                style={styles.selectAll}
              >
                <Text style={[styles.action, { color }]}>
                  {allChecked ? cr.unselectAll : cr.selectAll}
                </Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {items.map((item) => {
                const isSelected = chosen.has(key(item));
                return (
                  <Pressable
                    key={key(item)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() =>
                      onChange(
                        isSelected
                          ? selected.filter((f) => key(f) !== key(item))
                          : [...selected, item],
                      )
                    }
                    style={[
                      styles.chip,
                      isSelected && {
                        borderColor: color,
                        backgroundColor: `${color}0D`,
                      },
                    ]}
                  >
                    <MobileIcon
                      name={isSelected ? "check" : "grid"}
                      color={isSelected ? color : tokens.colors.textSecondary}
                      size={17}
                    />
                    <View style={{ flexShrink: 1 }}>
                      <Text style={[styles.label, isSelected && { color }]}>
                        {t.masters.facilities[item.code] ?? item.code}
                      </Text>
                      {item.isExtraCharge && (
                        <Text style={styles.hint}>{cr.extraCharge}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      <MobileInput
        label={cr.customFacilities}
        helperText={cr.customFacilitiesHint}
        value={custom}
        onChangeText={onCustomChange}
        multiline
        style={{ height: 100, textAlignVertical: "top" }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  body: { gap: 18 },
  group: {
    gap: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: tokens.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.textHeading,
  },
  hint: { fontSize: 12, lineHeight: 18, color: tokens.colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 12,
    minHeight: 48,
    flexBasis: "46%",
    flexGrow: 1,
  },
  label: { fontSize: 14, lineHeight: 21, color: tokens.colors.textHeading },
  action: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  selectAll: { paddingVertical: 8, paddingHorizontal: 4 },
  error: { color: tokens.colors.error, fontSize: 13, lineHeight: 20 },
});
