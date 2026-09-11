import { getAgentContract } from '../lib/agent-contracts-api';
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
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract, AgentTenant } from "@nestyk/types";
import { getAgentTenant, listAgentTenants } from "../lib/agent-tenants-api";
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

export function AgentTenantsScreen() {
  const { theme } = useMobileTheme();
  const [items, setItems] = useState<AgentTenant[]>([]);
  const [selected, setSelected] = useState<AgentTenant | null>(null);
  const [initialContract, setInitialContract] = useState<AgentContract | null>(null);
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
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refreshVersion = useRef(0);
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
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
    const current =
      selected.contracts.find((c) => c.status === "active") ||
      selected.contracts.find(
        (c) => c.status === "draft" || c.status.startsWith("awaiting"),
      );
    return (
      <View style={s.root}>
        {button("← ผู้เช่าทั้งหมด", () => {
          setSelected(null);
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
          <Text style={[s.body, muted]}>
            {selected.property}
            {selected.room ? ` · ห้อง ${selected.room}` : ""}
          </Text>
        </View>
        <View onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)} style={[s.tabs, { borderColor: theme.border }]}>
          {(["overview", "contracts"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => { setInitialContract(null); setTab(key); }}
              style={s.tab}
            >
              <Text style={[s.body, tab === key ? title : muted]}>
                {key === "overview"
                  ? "ภาพรวม"
                  : `สัญญา (${selected.contracts.length})`}
              </Text>
            </Pressable>
          ))}
          <Animated.View
            pointerEvents="none"
            style={[s.tabIndicator, {
              width: tabsWidth / 2,
              transform: [{ translateX: tabPosition.interpolate({ inputRange: [0, 1], outputRange: [0, tabsWidth / 2] }) }],
            }]}
          />
        </View>
        {tab === "contracts" ? (
          <ContractsScreen
            key={selected.id}
            tenant={selected}
            initialContract={initialContract}
            onChanged={() => {
              void refreshTenant(selected.id);
            }}
          />
        ) : (
          <>
            <View style={[s.card, panel]}>
              <Text style={[s.subtitle, title]}>ข้อมูลผู้เช่า</Text>
              {(
                [
                  ["เบอร์โทร", selected.phone],
                  ["อีเมล", selected.email || "ไม่ระบุ"],
                  ["Lead ต้นทาง", `#${selected.leadId}`],
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
            </View>
            <View style={[s.card, panel]}>
              <View style={s.row}>
                <Text style={[s.subtitle, title]}>
                  {current ? current.agreementTypeName : "พร้อมสร้างสัญญา"}
                </Text>
                {current && (
                  <Text style={[s.small, muted]}>{current.contractNo}</Text>
                )}
              </View>
              {current ? (
                <>
                  <Text style={[s.body, title]}>
                    {current.property}
                    {current.room ? ` · ห้อง ${current.room}` : ""}
                  </Text>
                  <Text style={[s.body, muted]}>
                    {date(current.startDate)} –{" "}
                    {current.endDate
                      ? date(current.endDate)
                      : "ไม่ระบุวันสิ้นสุด"}
                  </Text>
                  <Text style={[s.body, title]}>
                    {current.formKind === "reservation" ? "เงินจอง" : "ค่าเช่า"}{" "}
                    {(current.formKind === "reservation"
                      ? current.reservationFee
                      : current.monthlyRent) == null
                      ? "ยังไม่ระบุ"
                      : `฿${(current.formKind === "reservation" ? current.reservationFee! : current.monthlyRent!).toLocaleString("th-TH")}${current.formKind === "reservation" ? "" : " / เดือน"}`}
                  </Text>
                  {daysLeft(current) != null && daysLeft(current)! <= 30 && (
                    <Text style={[s.small, { color: "#B57506" }]}>
                      {daysLeft(current)! < 0
                        ? "เลยวันสิ้นสุดตามสัญญา กรุณาตรวจสอบสถานะ"
                        : `ครบกำหนดใน ${daysLeft(current)} วัน`}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={[s.body, muted]}>
                  ข้อมูลผู้เช่าพร้อมแล้ว เริ่มกำหนดระยะเวลาเช่า ค่าเช่า
                  และเงินประกันได้เลย
                </Text>
              )}
              {button(
                current ? "ดูสัญญา" : "ไปสร้างสัญญา",
                async () => {
                  if (!current) { setInitialContract(null); setTab("contracts"); return; }
                  setOpening(true); setError("");
                  try {
                    const contract = await getAgentContract(current.id);
                    setInitialContract(contract);
                    setTab("contracts");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "โหลดสัญญาไม่สำเร็จ กรุณาลองอีกครั้ง");
                  } finally { setOpening(false); }
                },
                true,
                opening,
              )}
            </View>
            <Text style={[s.small, muted, { textAlign: "center" }]}>
              ทุกสัญญาของผู้เช่าคนนี้จะอยู่ในแท็บสัญญา
            </Text>
          </>
        )}
      </View>
    );
  }
  const visible = items.filter(
    (t) =>
      (filter === "all" || stateOf(t) === filter) &&
      `${t.name} ${t.phone} ${t.property} ${t.room || ""} ${t.contracts.map((c) => `${c.property} ${c.room || ""} ${c.contractNo}`).join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
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
      <MobileInput
        value={query}
        onChangeText={setQuery}
        placeholder="ค้นหาผู้เช่า โครงการ หรือเลขสัญญา"
      />
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
      {loading || opening ? <ActivityIndicator /> : null}
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
  tabIndicator: { position: "absolute", left: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: "#FFBF19" },
});
