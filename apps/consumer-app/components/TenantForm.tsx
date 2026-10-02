import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileInput,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgentTenant,
  TenantLeadOption,
  TenantRoomOption,
} from "@nestyk/types";
import {
  createAgentTenant,
  tenantLeadOptions,
  tenantRoomOptions,
} from "../lib/agent-tenants-api";

export function TenantForm({
  onCreated,
  onBusy,
  backRef,
}: {
  onCreated: (tenant: AgentTenant) => void;
  onBusy?: (busy: boolean) => void;
  /** Shell header / hardware back: returns true when it stepped back, false on the first step. */
  backRef?: React.MutableRefObject<(() => boolean) | null>;
}) {
  const { t } = useLocale();
  const c = t.agent.tenants;
  const { theme } = useMobileTheme();
  const [step, setStep] = useState(1);
  const scroll = useRef<ScrollView>(null);
  const [lead, setLead] = useState<TenantLeadOption | null>(null);
  const [room, setRoom] = useState<TenantRoomOption | null>(null);
  const [leads, setLeads] = useState<TenantLeadOption[]>([]);
  const [rooms, setRooms] = useState<TenantRoomOption[]>([]);
  const [search, setSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    note: "",
    identityNumber: "",
    nationality: "",
  });
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };
  useEffect(() => {
    if (step === 3) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const timer = setTimeout(async () => {
      try {
        if (step === 1) {
          const data = await tenantLeadOptions(search);
          if (!cancelled) setLeads(data);
        } else {
          const data = await tenantRoomOptions(roomSearch);
          if (!cancelled) setRooms(data);
        }
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, search, roomSearch, retry]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  useEffect(() => {
    if (!backRef) return;
    backRef.current = () => {
      if (saving.current) return true;
      if (step === 1) return false;
      setError("");
      setStep(step - 1);
      return true;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, step]);
  const goToStep = (next: number) => {
    setError("");
    setStep(next);
  };
  function review() {
    if (!form.firstName.trim() || !form.phone.trim() || !room) {
      setError("กรุณากรอกชื่อ เบอร์โทร และเลือกห้องที่เช่า");
      return;
    }
    const digits = form.phone.replace(/\D/g, "");
    if (
      !/^[+\d\s().-]+$/.test(form.phone) ||
      digits.length < 7 ||
      digits.length > 15
    ) {
      setError("กรุณาตรวจสอบเบอร์โทร");
      return;
    }
    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setError("กรุณาตรวจสอบอีเมล");
      return;
    }
    setError("");
    setStep(3);
  }
  async function save() {
    if (saving.current || !lead || !room) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await createAgentTenant({
          leadId: lead.id,
          rentRoomId: room.id,
          name: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" "),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone,
          email: form.email,
          note: form.note,
          identityNumber: form.identityNumber,
          nationality: form.nationality,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const steps = [c.stepLead, c.stepProfile, c.stepReview];
  const primary =
    step === 1
      ? {
          label: c.next,
          onPress: () => goToStep(2),
          disabled: !lead || loading || !!loadError,
        }
      : step === 2
        ? { label: c.review, onPress: review, disabled: false }
        : {
            label: c.confirmCreate,
            onPress: () => {
              void save();
            },
            disabled: false,
          };
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.tabsWrap}>
        <View
          style={[s.tabs, { borderColor: theme.border }]}
          accessibilityRole="tablist"
        >
          {steps.map((label, i) => {
            const n = i + 1;
            const on = step === n;
            const done = n < step;
            return (
              <Pressable
                key={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: !done }}
                disabled={!done || busy}
                onPress={() => goToStep(n)}
                android_ripple={{ color: tokens.colors.brand[100], borderless: false }}
                style={({ pressed }) => [
                  s.tab,
                  on && s.tabOn,
                  pressed && Platform.OS === "ios" && s.tabPressed,
                ]}
              >
                <Text
                  style={[
                    s.tabText,
                    {
                      color: on
                        ? tokens.colors.primary
                        : done
                          ? theme.textHeading
                          : theme.textSecondary,
                    },
                    on && s.tabTextOn,
                  ]}
                  numberOfLines={1}
                >
                  {n}. {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.form}
      >
      <Text style={[s.body, muted]}>{c.createIntro}</Text>
      {step !== 3 && !!loadError && (
        <View style={[s.panel, panel]}>
          <Text
            accessibilityRole="alert"
            style={[s.body, { color: tokens.colors.danger }]}
          >
            {loadError}
          </Text>
          <MobileButton variant="outline" onPress={() => setRetry((n) => n + 1)}>
            ลองโหลดอีกครั้ง
          </MobileButton>
        </View>
      )}
      {step === 1 && (
        <>
          <MobileInput
            value={search}
            onChangeText={setSearch}
            placeholder="ค้นหาชื่อหรือเบอร์โทรของ Lead"
          />
          <Text style={[s.small, muted]}>
            แสดงสูงสุด 30 รายการ · เฉพาะ Lead
            ที่ยังไม่ได้เป็นผู้เช่าและยังไม่ปิดเป็นไม่สำเร็จ
          </Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            !loadError && (
              <>
                {leads.map((l) => (
                  <Pressable
                    key={l.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: lead?.id === l.id }}
                    onPress={() => {
                      if (lead?.id !== l.id) {
                        setLead(l);
                        setForm({
                          firstName:
                            l.firstName || l.name.trim().split(/\s+/)[0] || "",
                          lastName:
                            l.lastName ||
                            l.name.trim().split(/\s+/).slice(1).join(" "),
                          phone: l.phone,
                          email: l.email || "",
                          note: "",
                          identityNumber: "",
                          nationality: l.nationality || "",
                        });
                      }
                    }}
                    style={[
                      s.panel,
                      panel,
                      lead?.id === l.id && {
                        borderColor: "#FFBF19",
                        borderWidth: 2,
                      },
                    ]}
                  >
                    <Text style={[s.subtitle, title]}>
                      {lead?.id === l.id ? "● " : "○ "}
                      {l.name}
                    </Text>
                    <Text style={[s.body, muted]}>{l.phone}</Text>
                  </Pressable>
                ))}
                {!leads.length && (
                  <Text style={[s.body, muted]}>
                    {search
                      ? "ไม่พบ Lead ที่ตรงกับคำค้นหา"
                      : "ยังไม่มี Lead ให้เลือก กรุณาสร้าง Lead ในเมนู Leads ก่อน"}
                  </Text>
                )}
              </>
            )
          )}
          {lead && <Text style={[s.small, muted]}>เลือกแล้ว: {lead.name}</Text>}
        </>
      )}
      {step === 2 && (
        <>
          <View style={[s.panel, panel]}>
            <Text style={[s.subtitle, title]}>ข้อมูลติดต่อ</Text>
            <Text style={[s.small, muted]}>
              ดึงจาก {lead?.name} · แก้ไขข้อมูลผู้เช่าได้โดยข้อมูล Lead
              เดิมยังอยู่
            </Text>
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
                  value={form[key]}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, [key]: value }))
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
                />
              </View>
            ))}
          </View>
          <View style={[s.panel, panel]}>
            <Text style={[s.subtitle, title]}>ห้องที่เลือกเช่า *</Text>
            <MobileInput
              value={roomSearch}
              onChangeText={setRoomSearch}
              placeholder="ค้นหาโครงการหรือเลขห้อง"
            />
            <Text style={[s.small, muted]}>
              แสดงสูงสุด 30 ห้อง · ค้นหาเพื่อเลือกห้องอื่น
            </Text>
            {loading ? (
              <ActivityIndicator />
            ) : (
              !loadError &&
              rooms.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: room?.id === r.id }}
                  onPress={() => setRoom(r)}
                  style={[
                    s.room,
                    {
                      borderColor: room?.id === r.id ? "#FFBF19" : theme.border,
                    },
                  ]}
                >
                  <Text style={[s.body, title]}>
                    {room?.id === r.id ? "● " : "○ "}
                    {r.property}
                  </Text>
                  <Text style={[s.small, muted]}>
                    {r.room ? `ห้อง ${r.room}` : `รายการห้อง #${r.id}`}
                  </Text>
                </Pressable>
              ))
            )}
            {!loading && !loadError && !rooms.length && (
              <Text style={[s.body, muted]}>
                ไม่พบห้อง ลองเปลี่ยนคำค้นหาหรือเพิ่มห้องในเมนูห้องก่อน
              </Text>
            )}
            {room && (
              <Text style={[s.small, muted]}>
                เลือกแล้ว: {room.property} · {room.room || `#${room.id}`}
              </Text>
            )}
          </View>
        </>
      )}
      {step === 3 && (
        <>
          <View style={[s.panel, panel]}>
            <Text style={[s.subtitle, title]}>ตรวจสอบก่อนสร้างผู้เช่า</Text>
            {(
              [
                ["Lead ต้นทาง", lead?.name],
                ["ชื่อ", form.firstName],
                ["นามสกุล", form.lastName || "ไม่ระบุ"],
                ["เบอร์โทร", form.phone],
                ["อีเมล", form.email || "ไม่ระบุ"],
                [
                  "เลขบัตรประชาชน / พาสปอร์ต",
                  form.identityNumber || "ไม่ระบุ",
                ],
                ["สัญชาติ", form.nationality || "ไม่ระบุ"],
                [
                  "ห้องที่เลือก",
                  `${room?.property} · ${room?.room || `#${room?.id}`}`,
                ],
                ["หมายเหตุ", form.note || "ไม่ระบุ"],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={{ gap: 3 }}>
                <Text style={[s.small, muted]}>{label}</Text>
                <Text style={[s.body, title]}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.small, muted]}>
            เมื่อบันทึก Lead จะเป็นสถานะจองแล้ว และเชื่อมกับผู้เช่าคนนี้
            คุณสามารถสร้างสัญญาในขั้นถัดไปได้
          </Text>
        </>
      )}
      </ScrollView>
      <View
        style={[
          s.footer,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={[s.footerError, { color: tokens.colors.danger }]}
          >
            {error}
          </Text>
        )}
        <View style={s.footerRow}>
          {step > 1 && (
            <MobileButton
              variant="outline"
              onPress={() => goToStep(step - 1)}
              disabled={busy}
              style={s.backButton}
            >
              {c.back}
            </MobileButton>
          )}
          <MobileButton
            onPress={primary.onPress}
            disabled={primary.disabled || busy}
            isLoading={busy}
            style={s.primaryButton}
          >
            <View style={s.primaryInner}>
              {step === 3 && (
                <MobileIcon name="check" size={18} color={tokens.colors.primary} />
              )}
              <Text style={s.primaryText}>{primary.label}</Text>
            </View>
          </MobileButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    backgroundColor: "#F1F5F9",
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  tabOn: { backgroundColor: tokens.colors.brand[500] },
  tabPressed: { opacity: 0.7 },
  tabText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
  },
  tabTextOn: { fontWeight: "600" },
  form: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingTop: 12,
    gap: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
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
  panel: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  room: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  footerError: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  footerRow: { flexDirection: "row", gap: 10 },
  backButton: { flex: 1, minHeight: 50, borderRadius: 12 },
  primaryButton: { flex: 2, minHeight: 50, borderRadius: 12 },
  primaryInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    color: tokens.colors.primary,
  },
});
