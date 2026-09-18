import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MobileBrandLoader, MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract, AgentTenant } from "@nestyk/types";
import { useLocale } from "@nestyk/i18n";
import { getAgentTenant, listAgentTenants, updateAgentTenant } from "../lib/agent-tenants-api";
import { TenantForm } from "./TenantForm";
import { ContractsScreen } from "./ContractsScreen";

type Filter = "all" | "signing" | "active";
const filters: Record<Filter, string> = {
  all: "ทั้งหมด",
  active: "ผู้เช่าแล้ว",
  signing: "กำลังทำสัญญา",
};
// A completed tenancy remains a tenant record, including after its lease ends.
const stateOf = (t: AgentTenant): Exclude<Filter, "all"> =>
  t.contracts.some(
    (c) =>
      c.formKind !== "reservation" &&
      ["active", "expired", "terminated"].includes(c.status),
  )
    ? "active"
    : "signing";
const statusColor = {
  signing: "#B57506",
  active: "#198460",
};
const statusLabel = {
  signing: "กำลังทำสัญญา",
  active: "ผู้เช่าแล้ว",
};
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => Array.from(n)[0])
    .join("")
    .toUpperCase();
const date = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const daysLeft = (c: AgentContract) => {
  if (c.formKind === "reservation" || c.status !== "active" || !c.endDate)
    return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${c.endDate}T00:00:00Z`) - today) / 86400000);
};
const renewal = (t: AgentTenant) =>
  t.contracts.some((c) => {
    const days = daysLeft(c);
    return days != null && days >= 0 && days <= 30;
  });

export function AgentTenantsScreen({
  searchOpen = false,
  onSearchOpenChange,
  workFilter = null,
}: {
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  workFilter?:
    | "overdue_payment"
    | "awaiting_signature"
    | "renewal"
    | "lead_follow_up"
    | null;
} = {}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const headerSearch = onSearchOpenChange != null;
  const [items, setItems] = useState<AgentTenant[]>([]);
  const [selected, setSelected] = useState<AgentTenant | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"overview" | "contracts">("overview");
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabPosition = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(tabPosition, {
      toValue: tab === "overview" ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [tab, tabPosition]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    identityNumber: "",
    nationality: "",
    note: "",
  });
  useEffect(() => {
    if (workFilter === "awaiting_signature") setFilter("signing");
    else if (workFilter === "renewal" || workFilter === "overdue_payment")
      setFilter("all");
  }, [workFilter]);
  const refreshVersion = useRef(0);
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };

  useEffect(() => {
    if (loading && !items.length) setGateOpen(false);
  }, [loading, items.length]);

  async function reload() {
    const version = ++refreshVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = await listAgentTenants();
      if (version === refreshVersion.current) setItems(data);
    } catch (e) {
      if (version === refreshVersion.current)
        setError(e instanceof Error ? e.message : "โหลดผู้เช่าไม่สำเร็จ");
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    return () => {
      refreshVersion.current++;
    };
  }, []);
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={action}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primary ? "#FFBF19" : theme.surface,
          borderColor: primary ? "#FFBF19" : theme.border,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text
        style={[s.body, { color: primary ? "#202631" : theme.textHeading }]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const badge = (t: AgentTenant) => (
    <Text
      style={[
        s.badge,
        {
          color: statusColor[stateOf(t)],
          backgroundColor: `${statusColor[stateOf(t)]}15`,
        },
      ]}
    >
      {statusLabel[stateOf(t)]}
    </Text>
  );
  const avatar = (name: string, large = false) => (
    <View
      style={[s.avatar, large && { width: 66, height: 66, borderRadius: 33 }]}
    >
      <Text style={[s.avatarText, large && { fontSize: 24 }]}>
        {initials(name)}
      </Text>
    </View>
  );
  async function open(t: AgentTenant) {
    if (opening) return;
    setOpening(true);
    setError("");
    setNotice("");
    setEditing(false);
    try {
      setSelected(await getAgentTenant(t.id));
      setTab("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดรายละเอียดไม่สำเร็จ");
    } finally {
      setOpening(false);
    }
  }
  async function refreshTenant(id: number) {
    try {
      const latest = await getAgentTenant(id);
      setSelected((current) => (current?.id === id ? latest : current));
      setItems((current) => current.map((t) => (t.id === id ? latest : t)));
    } catch {
      setError(
        "สัญญาบันทึกแล้ว แต่โหลดข้อมูลผู้เช่าล่าสุดไม่สำเร็จ กรุณาออกจากเมนูผู้เช่าแล้วเข้าใหม่",
      );
    }
  }
  function beginEdit(tenant: AgentTenant) {
    setEditForm({
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email || "",
      identityNumber: tenant.identityNumber || "",
      nationality: tenant.nationality || "",
      note: tenant.note || "",
    });
    setEditing(true);
    setError("");
    setNotice("");
  }
  async function saveEdit() {
    if (!selected || savingEdit) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      setError("กรุณากรอกชื่อและเบอร์โทร");
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      const latest = await updateAgentTenant(selected.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        identityNumber: editForm.identityNumber.trim(),
        nationality: editForm.nationality.trim(),
        note: editForm.note.trim(),
      });
      setSelected(latest);
      setItems((current) =>
        current.map((t) => (t.id === latest.id ? latest : t)),
      );
      setEditing(false);
      setNotice("บันทึกข้อมูลผู้เช่าแล้ว");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSavingEdit(false);
    }
  }
  if (!gateOpen && !creating && !selected) {
    return (
      <MobileBrandLoader
        fill
        size="md"
        done={!loading}
        onComplete={() => setGateOpen(true)}
      />
    );
  }
  if (creating)
    return (
      <TenantForm
        onBack={() => setCreating(false)}
        onCreated={(tenant) => {
          setItems((current) => [
            tenant,
            ...current.filter((t) => t.id !== tenant.id),
          ]);
          setCreating(false);
          setSelected(tenant);
          setTab("overview");
          setError("");
          setNotice("สร้างผู้เช่าแล้ว พร้อมเริ่มเตรียมสัญญา");
        }}
      />
    );
  if (selected) {
    return (
      <View style={s.root}>
        {button("← ผู้เช่าทั้งหมด", () => {
          setSelected(null);
          setEditing(false);
          setNotice("");
          setError("");
        })}
        {!!notice && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: "#198460" }]}
          >
            {notice}
          </Text>
        )}
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: "#C43D4C" }]}
          >
            {error}
          </Text>
        )}
        <View style={[s.card, panel]}>
          <View style={s.person}>
            {avatar(selected.name, true)}
            <View style={s.grow}>
              <Text style={[s.heading, title]}>{selected.name}</Text>
              {badge(selected)}
              <Text style={[s.small, muted]}>
                ผู้เช่าตั้งแต่ {date(selected.createdAt)}
              </Text>
            </View>
          </View>
        </View>
        <View
          onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}
          style={[s.tabs, { borderColor: theme.border }]}
        >
          {(["overview", "contracts"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => {
                setEditing(false);
                setTab(key);
              }}
              style={s.tab}
            >
              <Text style={[s.body, tab === key ? title : muted]}>
                {key === "overview"
                  ? "ข้อมูลผู้เช่า"
                  : `สัญญา (${selected.contracts.length})`}
              </Text>
            </Pressable>
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              s.tabIndicator,
              {
                width: tabsWidth / 2,
                transform: [
                  {
                    translateX: tabPosition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, tabsWidth / 2],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
        {tab === "contracts" ? (
          <ContractsScreen
            key={selected.id}
            tenant={selected}
            onChanged={() => {
              void refreshTenant(selected.id);
            }}
          />
        ) : editing ? (
          <View style={[s.card, panel]}>
            {(
              [
                ["name", "ชื่อ–นามสกุล *", "ชื่อที่ใช้ในสัญญา"],
                ["phone", "เบอร์โทร *", "เบอร์โทรที่ติดต่อได้"],
                ["email", "อีเมล", "name@example.com"],
                [
                  "identityNumber",
                  "เลขบัตรประชาชน / พาสปอร์ต",
                  "เช่น 1-2345-67890-12-3 หรือ A1234567",
                ],
                ["nationality", "สัญชาติ", "เช่น ไทย"],
                ["note", "หมายเหตุ", "ข้อมูลเพิ่มเติมเกี่ยวกับผู้เช่า"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <View key={key} style={{ gap: 6 }}>
                <Text style={[s.body, title]}>{label}</Text>
                <MobileInput
                  accessibilityLabel={label}
                  value={editForm[key]}
                  onChangeText={(value) =>
                    setEditForm((current) => ({ ...current, [key]: value }))
                  }
                  placeholder={placeholder}
                  maxLength={
                    key === "note"
                      ? 500
                      : key === "phone"
                        ? 50
                        : key === "identityNumber"
                          ? 100
                          : key === "nationality"
                            ? 120
                            : 255
                  }
                  keyboardType={
                    key === "phone"
                      ? "phone-pad"
                      : key === "email"
                        ? "email-address"
                        : "default"
                  }
                  autoCapitalize={
                    key === "email" || key === "identityNumber"
                      ? "none"
                      : "sentences"
                  }
                  editable={!savingEdit}
                />
              </View>
            ))}
            <Text style={[s.small, muted]}>
              โครงการและห้องไม่สามารถแก้จากหน้านี้
              {selected.property
                ? ` · ${selected.property}${selected.room ? ` · ห้อง ${selected.room}` : ""}`
                : ""}
            </Text>
            {button(
              savingEdit ? "กำลังบันทึก…" : "บันทึก",
              () => {
                void saveEdit();
              },
              true,
              savingEdit,
            )}
            {button(
              "ยกเลิก",
              () => {
                if (savingEdit) return;
                setEditing(false);
                setError("");
              },
              false,
              savingEdit,
            )}
          </View>
        ) : (
          <View style={[s.card, panel]}>
            {(
              [
                ["เบอร์โทร", selected.phone],
                ["อีเมล", selected.email || "ไม่ระบุ"],
                [
                  "เลขบัตรประชาชน / พาสปอร์ต",
                  selected.identityNumber || "ไม่ระบุ",
                ],
                ["สัญชาติ", selected.nationality || "ไม่ระบุ"],
                ["โครงการ", selected.property],
                ["ห้อง", selected.room || "ไม่ระบุ"],
                ["ที่อยู่", selected.fullAddress || "ไม่ระบุ"],
                ["หมายเหตุ", selected.note || "ไม่ระบุ"],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={{ gap: 3 }}>
                <Text style={[s.small, muted]}>{label}</Text>
                <Text selectable style={[s.body, title]}>
                  {value}
                </Text>
              </View>
            ))}
            {button("แก้ไขข้อมูลผู้เช่า", () => beginEdit(selected), true)}
          </View>
        )}
      </View>
    );
  }
  const visible = items.filter((t) => {
    if (filter !== "all" && stateOf(t) !== filter) return false;
    if (workFilter === "renewal" && !renewal(t)) return false;
    if (workFilter === "awaiting_signature" && stateOf(t) !== "signing")
      return false;
    return `${t.name} ${t.phone} ${t.property} ${t.room || ""} ${t.contracts.map((c) => `${c.property} ${c.room || ""} ${c.contractNo}`).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });
  return (
    <View style={s.root}>
      <Text style={[s.subtitle, title]}>ดูแลทุกสัญญาในที่เดียว</Text>
      {button(
        "＋ สร้างผู้เช่า",
        () => {
          setCreating(true);
          setError("");
        },
        true,
      )}
      {(headerSearch ? searchOpen || !!query.trim() : true) ? (
        <MobileInput
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาผู้เช่า โครงการ หรือเลขสัญญา"
          autoFocus={headerSearch && searchOpen && !query.trim()}
          onBlur={
            headerSearch
              ? () => {
                  if (!query.trim()) onSearchOpenChange?.(false);
                }
              : undefined
          }
        />
      ) : null}
      <View style={s.filters}>
        {(Object.keys(filters) as Filter[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === key }}
            onPress={() => setFilter(key)}
            style={[
              s.chip,
              {
                borderColor: filter === key ? "#FFBF19" : theme.border,
                backgroundColor: filter === key ? "#FFE29A" : theme.surface,
              },
            ]}
          >
            <Text
              style={[
                s.small,
                { color: filter === key ? "#202631" : theme.textSecondary },
              ]}
            >
              {filters[key]}{" "}
              {loading
                ? "–"
                : items.filter((t) => key === "all" || stateOf(t) === key)
                    .length}
            </Text>
          </Pressable>
        ))}
      </View>
      {opening ? (
        <ActivityIndicator color={tokens.colors.roles.agent} />
      ) : null}
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, { color: "#C43D4C" }]}>
          {error}
        </Text>
      )}
      {!loading && !error && (
        <>
          {visible.map((t) => (
            <Pressable
              key={t.id}
              disabled={opening}
              accessibilityRole="button"
              accessibilityLabel={`ดูผู้เช่า ${t.name}`}
              onPress={() => {
                void open(t);
              }}
              style={({ pressed }) => [
                s.card,
                panel,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={s.person}>
                {avatar(t.name)}
                <View style={s.grow}>
                  <View style={s.row}>
                    <Text style={[s.subtitle, title]}>{t.name}</Text>
                    {badge(t)}
                  </View>
                  <Text style={[s.body, muted]}>
                    {t.property}
                    {t.room ? ` · ห้อง ${t.room}` : ""}
                  </Text>
                  <Text style={[s.small, muted]}>
                    {t.contracts.length
                      ? `${t.contracts.filter((c) => c.status === "active").length} สัญญาที่มีผล · ${t.contracts.length} สัญญาทั้งหมด`
                      : "ยังไม่มีสัญญา"}
                  </Text>
                </View>
                <Text style={[s.subtitle, muted]}>›</Text>
              </View>
              <View style={[s.footer, { borderColor: theme.border }]}>
                <Text
                  style={[
                    s.small,
                    { color: renewal(t) ? "#B57506" : theme.textSecondary },
                  ]}
                >
                  {renewal(t)
                    ? "◷  มีสัญญาใกล้ครบกำหนด"
                    : stateOf(t) === "signing"
                      ? "ข้อมูลผู้เช่าพร้อม · เตรียมสัญญาต่อได้"
                      : `สัญญาของ ${t.name}`}
                </Text>
                <Text style={[s.small, title]}>ดูรายละเอียด →</Text>
              </View>
            </Pressable>
          ))}
          {!visible.length && (
            <View style={[s.card, panel]}>
              <Text style={[s.subtitle, title]}>
                {items.length
                  ? "ไม่พบผู้เช่าที่ตรงกัน"
                  : "เริ่มต้นผู้เช่าคนแรก"}
              </Text>
              <Text style={[s.body, muted]}>
                {items.length
                  ? "ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก"
                  : "เลือก Lead แล้วเติมข้อมูลผู้เช่า รายชื่อจะมาแสดงที่นี่"}
              </Text>
              {items.length > 0 &&
                button("ล้างตัวกรอง", () => {
                  setQuery("");
                  setFilter("all");
                })}
            </View>
          )}
          <Text style={[s.small, muted, { textAlign: "center" }]}>
            แสดง {visible.length} จาก {items.length} คน
          </Text>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    gap: 16,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 25,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 25,
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
  card: { borderWidth: 1, borderRadius: 17, padding: 16, gap: 15 },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, gap: 4, minWidth: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7,
    flexWrap: "wrap",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8EFF7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    color: "#243549",
    fontFamily: tokens.typography.native.headingTh,
  },
  badge: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  filters: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  renewal: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  footer: { borderTopWidth: 1, paddingTop: 12, gap: 5 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
  },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", padding: 12, paddingBottom: 15 },
  tabIndicator: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFBF19",
  },
});
