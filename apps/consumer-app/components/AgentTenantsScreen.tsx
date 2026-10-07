import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MobileBrandLoader,
  MobileButton,
  MobileIcon,
  MobileInput,
  MobileFilterChip,
  MobileListSearchRow,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { AgentContract, AgentTenant } from "@nestyk/types";
import { useLocale } from "@nestyk/i18n";
import { getAgentTenant, listAgentTenants, updateAgentTenant } from "../lib/agent-tenants-api";
import { nextIdentityNumberDraft } from "../lib/identity-number";
import { TenantForm } from "./TenantForm";
import { ContractsScreen } from "./ContractsScreen";
import { AgentRentSlips } from "./AgentRentSlips";
import type { CreateDocumentKind } from "./ContractTypePicker";

type Filter = "all" | "signing" | "active";
const filters: Record<Filter, string> = {
  all: "ทั้งหมด",
  active: "ผู้เช่าแล้ว",
  signing: "กำลังทำสัญญา",
};
// "ผู้เช่าแล้ว" only while a residential lease contract is currently active.
const stateOf = (t: AgentTenant): Exclude<Filter, "all"> =>
  t.contracts.some((c) => c.formKind === "lease" && c.status === "active")
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

/** Detail/edit state the shell needs for its header, bottom bar and hardware back. */
export type TenantDetailState = {
  open: boolean;
  editing: boolean;
  canEdit: boolean;
  saving: boolean;
  error: string;
};
export const TENANT_DETAIL_CLOSED: TenantDetailState = {
  open: false,
  editing: false,
  canEdit: false,
  saving: false,
  error: "",
};
export type TenantDetailActions = {
  /** Cancels an edit first, otherwise closes the detail. */
  back: () => void;
  edit: () => void;
  save: () => void;
};
/** A tenant whose page opens as soon as the screen mounts, e.g. from a lead that booked a room. */
export type TenantEntry = {
  tenantId: number;
  /** Already at hand (just booked); otherwise the tenant is read by id. */
  tenant?: AgentTenant;
  /** Go straight into creating this document for the tenant. */
  startContract?: CreateDocumentKind | null;
};

export function AgentTenantsScreen({
  workFilter = null,
  reloadToken = 0,
  onReloadSettled,
  creating: creatingProp,
  onCreatingChange,
  onCreateBusy,
  createBackRef,
  createdTenant = null,
  onTenantCreated,
  entry = null,
  onEntryBack,
  detailActionsRef,
  onDetailStateChange,
}: {
  /** Controlled by the shell so its header/back/tab bar switch to the create-tenant layout. */
  creating?: boolean;
  onCreatingChange?: (creating: boolean) => void;
  onCreateBusy?: (busy: boolean) => void;
  createBackRef?: React.MutableRefObject<(() => boolean) | null>;
  /** The shell remounts this screen when the form closes; reopen the tenant just created. */
  createdTenant?: AgentTenant | null;
  onTenantCreated?: (tenant: AgentTenant) => void;
  /** Read on mount: open this tenant's page instead of the list. */
  entry?: TenantEntry | null;
  /** Back from the `entry` tenant's page: return to where the shell came from, not to the list. */
  onEntryBack?: () => void;
  detailActionsRef?: React.MutableRefObject<TenantDetailActions | null>;
  onDetailStateChange?: (state: TenantDetailState) => void;
  workFilter?:
    | "overdue_payment"
    | "awaiting_signature"
    | "renewal"
    | "lead_follow_up"
    | null;
  reloadToken?: number;
  onReloadSettled?: (token: number) => void;
} = {}) {
  const { t } = useLocale();
  const c = t.agent.tenants;
  const { theme } = useMobileTheme();
  const [items, setItems] = useState<AgentTenant[]>([]);
  const [selected, setSelected] = useState<AgentTenant | null>(
    entry?.tenant ?? createdTenant,
  );
  const [creatingLocal, setCreatingLocal] = useState(false);
  const creating = creatingProp ?? creatingLocal;
  const setCreating = onCreatingChange ?? setCreatingLocal;
  const [tab, setTab] = useState<"overview" | "contracts">(
    entry?.startContract ? "contracts" : "overview",
  );
  /** Document the contracts tab starts creating when it opens (the reservation letter after a booking). */
  const [contractStart, setContractStart] = useState<CreateDocumentKind | null>(
    entry?.startContract ?? null,
  );
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabPosition = useRef(
    new Animated.Value(tab === "overview" ? 0 : 1),
  ).current;
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
  const [notice, setNotice] = useState(
    createdTenant && !entry ? c.createdNotice : "",
  );
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
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
    let cancelled = false;
    void reload().finally(() => {
      if (!cancelled) onReloadSettled?.(reloadToken);
    });
    return () => {
      cancelled = true;
      refreshVersion.current++;
    };
  }, [reloadToken]);
  // A tenant the shell asks for by id opens the same way as a tap on its row.
  useEffect(() => {
    if (entry && !entry.tenant) void open(entry.tenantId);
    // Read once: the shell mounts this screen for the entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  async function open(id: number) {
    if (opening) return;
    setOpening(true);
    setError("");
    setNotice("");
    setEditing(false);
    try {
      setSelected(await getAgentTenant(id));
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
      firstName: tenant.firstName || tenant.name.trim().split(/\s+/)[0] || "",
      lastName: tenant.lastName || tenant.name.trim().split(/\s+/).slice(1).join(" "),
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
    if (!editForm.firstName.trim() || !editForm.phone.trim()) {
      setError("กรุณากรอกชื่อและเบอร์โทร");
      return;
    }
    setSavingEdit(true);
    setError("");
    try {
      const latest = await updateAgentTenant(selected.id, {
        name: [editForm.firstName.trim(), editForm.lastName.trim()].filter(Boolean).join(" "),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
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
  const detailOpen = !creating && !!selected;
  useEffect(() => {
    onDetailStateChange?.(
      detailOpen
        ? {
            open: true,
            editing,
            canEdit: tab === "overview" && !editing,
            saving: savingEdit,
            error: editing ? error : "",
          }
        : TENANT_DETAIL_CLOSED,
    );
  }, [detailOpen, editing, tab, savingEdit, error, onDetailStateChange]);
  useEffect(
    () => () => onDetailStateChange?.(TENANT_DETAIL_CLOSED),
    [onDetailStateChange],
  );
  useEffect(() => {
    if (!detailActionsRef) return;
    detailActionsRef.current = {
      back: () => {
        if (savingEdit) return;
        setError("");
        if (editing) {
          setEditing(false);
          return;
        }
        if (onEntryBack && entry && selected?.id === entry.tenantId) {
          onEntryBack();
          return;
        }
        setSelected(null);
        setNotice("");
      },
      edit: () => {
        if (selected) beginEdit(selected);
      },
      save: () => {
        void saveEdit();
      },
    };
  });
  useEffect(
    () => () => {
      if (detailActionsRef) detailActionsRef.current = null;
    },
    [detailActionsRef],
  );
  if (!gateOpen && !creating && !selected) {
    return (
      <MobileBrandLoader
        fill
        size="md"
        done={!loading && !opening}
        onComplete={() => setGateOpen(true)}
      />
    );
  }
  if (creating)
    return (
      <TenantForm
        onBusy={onCreateBusy}
        backRef={createBackRef}
        onCreated={(tenant) => {
          setItems((current) => [
            tenant,
            ...current.filter((t) => t.id !== tenant.id),
          ]);
          onTenantCreated?.(tenant);
          setCreating(false);
          setSelected(tenant);
          setTab("overview");
          setError("");
          setNotice(c.createdNotice);
        }}
      />
    );
  if (selected) {
    return (
      <View style={s.root}>
        {!!notice && (
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: "#198460" }]}
          >
            {notice}
          </Text>
        )}
        {!!error && !editing && (
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
        {tab === "overview" && !editing && !selected.contracts.length && (
          <View style={[s.card, panel]}>
            <Text style={[s.subtitle, title]}>{c.nextStepTitle}</Text>
            <Text style={[s.body, muted]}>
              {selected.email ? c.nextStepBody : c.reservedNeedsEmail}
            </Text>
            <MobileButton
              onPress={() => {
                if (!selected.email) {
                  beginEdit(selected);
                  return;
                }
                setNotice("");
                setContractStart("reservation");
                setTab("contracts");
              }}
            >
              {selected.email ? c.makeReservation : c.addEmail}
            </MobileButton>
          </View>
        )}
        {tab === "contracts" ? (
          <ContractsScreen
            key={selected.id}
            tenant={selected}
            startCreate={contractStart}
            onStartCreateHandled={() => setContractStart(null)}
            onChanged={() => {
              void refreshTenant(selected.id);
            }}
          />
        ) : editing ? (
          <View style={[s.card, panel]}>
            {(
              [
                ["firstName", "ชื่อ *", "ชื่อ"],
                ["lastName", "นามสกุล", "ไม่บังคับ"],
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
                    setEditForm((current) => ({
                      ...current,
                      [key]: key === "identityNumber" ? nextIdentityNumberDraft(value) : value,
                    }))
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
                    key === "email"
                      ? "none"
                      : key === "identityNumber"
                        ? "characters"
                        : "sentences"
                  }
                  autoCorrect={key === "identityNumber" ? false : undefined}
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
      <AgentRentSlips reloadToken={reloadToken} />
      <MobileListSearchRow
        value={query}
        onChangeText={setQuery}
        placeholder={c.search}
        onClear={() => setQuery("")}
        clearAccessibilityLabel={c.clearSearch}
      />
      <View style={s.filters}>
        {(Object.keys(filters) as Filter[]).map((key) => (
          <MobileFilterChip
            key={key}
            label={filters[key]}
            count={
              loading
                ? "–"
                : items.filter((t) => key === "all" || stateOf(t) === key)
                    .length
            }
            selected={filter === key}
            onPress={() => setFilter(key)}
          />
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
                void open(t.id);
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
              <Text style={[s.body, muted, { textAlign: "center" }]}>
                {t.common.noData}
              </Text>
              {items.length > 0 ? (
                <MobileButton
                  variant="outline"
                  onPress={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  {c.clearFilters}
                </MobileButton>
              ) : null}
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

/** Save / cancel for tenant edit mode, rendered in the shell's bottom bar so it stays reachable. */
export function TenantEditBar({
  saving,
  error,
  onCancel,
  onSave,
}: {
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useLocale();
  const c = t.agent.tenants;
  const { theme } = useMobileTheme();
  return (
    <View style={[s.editBar, { borderTopColor: theme.border }]}>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[s.editBarError, { color: tokens.colors.danger }]}
        >
          {error}
        </Text>
      )}
      <View style={s.editBarRow}>
        <MobileButton
          variant="outline"
          onPress={onCancel}
          disabled={saving}
          style={s.editBarCancel}
        >
          {c.cancel}
        </MobileButton>
        <MobileButton
          onPress={onSave}
          disabled={saving}
          isLoading={saving}
          style={s.editBarSave}
        >
          <View style={s.editBarSaveInner}>
            <MobileIcon name="check" size={18} color={tokens.colors.primary} />
            <Text style={s.editBarSaveText}>{c.save}</Text>
          </View>
        </MobileButton>
      </View>
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
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
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
  editBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editBarError: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  editBarRow: { flexDirection: "row", gap: 10 },
  editBarCancel: { flex: 1, minHeight: 50, borderRadius: 12 },
  editBarSave: { flex: 2, minHeight: 50, borderRadius: 12 },
  editBarSaveInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBarSaveText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.primary,
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
