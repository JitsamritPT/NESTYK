import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MobileInput, tokens, useMobileTheme } from "@nestyk/ui/native";
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
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (tenant: AgentTenant) => void;
}) {
  const { theme } = useMobileTheme();
  const [step, setStep] = useState(1);
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
    name: "",
    phone: "",
    email: "",
    note: "",
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
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || disabled }}
      disabled={busy || disabled}
      onPress={action}
      style={[
        s.button,
        {
          backgroundColor: primary ? "#FFBF19" : theme.surface,
          borderColor: primary ? "#FFBF19" : theme.border,
          opacity: busy || disabled ? 0.5 : 1,
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
  function review() {
    if (!form.name.trim() || !form.phone.trim() || !room) {
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
          ...form,
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
  return (
    <View style={s.root}>
      {button(step === 1 ? "← กลับไปหน้าผู้เช่า" : "← ย้อนกลับ", () => {
        setError("");
        if (step === 1) onBack();
        else setStep(step - 1);
      })}
      <Text style={[s.heading, title]}>สร้างผู้เช่า</Text>
      <Text style={[s.body, muted]}>
        นำข้อมูลจาก Lead มาต่อยอดเป็นผู้เช่าของคุณ
      </Text>
      <View style={s.steps}>
        {["เลือก Lead", "ข้อมูลผู้เช่า", "ตรวจสอบ"].map((label, i) => (
          <View
            key={label}
            style={[
              s.step,
              { borderBottomColor: step === i + 1 ? "#FFBF19" : theme.border },
            ]}
          >
            <Text style={[s.small, step === i + 1 ? title : muted]}>
              {i + 1}. {label}
            </Text>
          </View>
        ))}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={[s.body, { color: "#C43D4C" }]}>
          {error}
        </Text>
      )}
      {step !== 3 && (
        <>
          {!!loadError && (
            <View style={[s.panel, panel]}>
              <Text
                accessibilityRole="alert"
                style={[s.body, { color: "#C43D4C" }]}
              >
                {loadError}
              </Text>
              {button("ลองโหลดอีกครั้ง", () => setRetry((n) => n + 1))}
            </View>
          )}
        </>
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
                          name: l.name,
                          phone: l.phone,
                          email: l.email || "",
                          note: "",
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
          {button(
            "ถัดไป · ข้อมูลผู้เช่า",
            () => setStep(2),
            true,
            !lead || loading || !!loadError,
          )}
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
                ["name", "ชื่อ–นามสกุล *", "ชื่อที่ใช้ในสัญญา"],
                ["phone", "เบอร์โทร *", "เบอร์โทรที่ติดต่อได้"],
                ["email", "อีเมล", "name@example.com"],
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
                  maxLength={key === "note" ? 500 : key === "phone" ? 50 : 255}
                  keyboardType={
                    key === "phone"
                      ? "phone-pad"
                      : key === "email"
                        ? "email-address"
                        : "default"
                  }
                  autoCapitalize={key === "email" ? "none" : "sentences"}
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
          {button("ตรวจสอบข้อมูล", review, true)}
        </>
      )}
      {step === 3 && (
        <>
          <View style={[s.panel, panel]}>
            <Text style={[s.subtitle, title]}>ตรวจสอบก่อนสร้างผู้เช่า</Text>
            {(
              [
                ["Lead ต้นทาง", lead?.name],
                ["ชื่อผู้เช่า", form.name],
                ["เบอร์โทร", form.phone],
                ["อีเมล", form.email || "ไม่ระบุ"],
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
          {button(
            busy ? "กำลังบันทึก…" : "ยืนยันสร้างผู้เช่า",
            () => {
              void save();
            },
            true,
          )}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  heading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 25,
    lineHeight: 36,
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
  steps: { flexDirection: "row", gap: 8 },
  step: { flex: 1, paddingBottom: 10, borderBottomWidth: 3 },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
  },
});
