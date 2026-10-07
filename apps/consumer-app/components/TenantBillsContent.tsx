import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocale } from "@nestyk/i18n";
import {
  MobileBottomSheet,
  MobileButton,
  MobileFilterChip,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type { TenantBill, TenantNextBill } from "@nestyk/types";
import { billFormatters } from "../lib/bill-format";
import { tenantWorkspaceCopy } from "../lib/tenant-workspace-copy";

export function TenantBillsContent({
  rows,
  next,
  uploadingId,
  onUpload,
  onViewSlip,
}: {
  rows: TenantBill[];
  next: TenantNextBill | null;
  uploadingId: number | null;
  onUpload: (bill: TenantBill, source: "documents" | "photos") => void;
  onViewSlip: (bill: TenantBill) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = t.tenant.bills;
  const labels = tenantWorkspaceCopy(locale);
  const format = billFormatters(locale);
  const [filter, setFilter] = useState<"recent" | "paid">("recent");
  const [selected, setSelected] = useState<{
    id: number;
    payment: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const open = rows
    .filter((bill) => bill.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id - b.id);
  const history = rows
    .filter((bill) => bill.status === "paid")
    .sort((a, b) => b.period.localeCompare(a.period) || b.id - a.id);
  const selectedBill = rows.find((bill) => bill.id === selected?.id);
  const rooms = [
    ...new Map(rows.map((bill) => [bill.leaseContractId, bill])).values(),
  ];
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.surface, borderColor: theme.border };

  function select(bill: TenantBill, payment = false) {
    setCopied(false);
    setCopyError("");
    setSelected({ id: bill.id, payment });
  }
  function upload(source: "documents" | "photos") {
    if (!selectedBill || uploadingId != null) return;
    const bill = selectedBill;
    setSelected(null);
    setTimeout(() => onUpload(bill, source), 400);
  }
  function viewSlip(bill: TenantBill) {
    setSelected(null);
    setTimeout(() => onViewSlip(bill), 400);
  }
  function badge(bill: TenantBill) {
    return (
      <MobileStatusPill
        label={
          bill.status === "paid"
            ? copy.status.paid
            : bill.status === "overdue"
              ? copy.status.overdue
              : bill.hasPaymentSlip
                ? labels.reviewing
                : copy.status.pending
        }
        tone={
          bill.status === "paid"
            ? "green"
            : bill.status === "overdue"
              ? "red"
              : "yellow"
        }
      />
    );
  }
  function bank(bill: TenantBill) {
    if (!bill.payTo) return null;
    return (
      <View
        style={[
          s.bank,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <Text style={[s.caption, muted]}>{copy.payTo}</Text>
        {!!bill.payTo.bankName && (
          <Text style={[s.body, ink]}>{bill.payTo.bankName}</Text>
        )}
        {!!bill.payTo.accountNo && (
          <View style={s.row}>
            <Text selectable style={[s.body, ink, s.flex]}>
              {bill.payTo.accountNo}
            </Text>
            <MobileButton
              variant="outline"
              onPress={() => {
                setCopyError("");
                void Clipboard.setStringAsync(bill.payTo!.accountNo)
                  .then(() => setCopied(true))
                  .catch(() => setCopyError(copy.loadFailed));
              }}
            >
              {copied ? labels.copied : labels.copyAccount}
            </MobileButton>
          </View>
        )}
        {!!bill.payTo.accountName && (
          <Text style={[s.caption, muted]}>{bill.payTo.accountName}</Text>
        )}
        {!!copyError && (
          <Text
            accessibilityRole="alert"
            style={[s.caption, { color: tokens.colors.danger }]}
          >
            {copyError}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {rooms.length === 1 && (
        <View style={[s.room, surface]}>
          <View style={[s.roomIcon, { backgroundColor: theme.background }]}>
            <MobileIcon name="home" size={22} color={theme.screenTitle} />
          </View>
          <View style={s.flex}>
            <Text style={[s.roomTitle, ink]}>{rooms[0]!.property}</Text>
            {rooms[0]!.room ? (
              <Text style={[s.caption, muted]}>
                {labels.room} {rooms[0]!.room}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {filter === "recent" &&
        open.map((bill) => (
          <View key={bill.id} style={[s.bill, surface]}>
            <View style={s.header}>
              <Text style={[s.billTitle, ink, s.flex]}>
                {copy.rentFor.replace("{month}", format.month(bill.period))}
              </Text>
              {badge(bill)}
            </View>
            {rooms.length !== 1 && (
              <Text style={[s.caption, muted]}>
                {[
                  bill.property,
                  bill.room ? `${labels.room} ${bill.room}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
            <Text
              style={[
                s.amount,
                {
                  color:
                    bill.status === "overdue"
                      ? tokens.colors.danger
                      : theme.textHeading,
                },
              ]}
            >
              {format.amount(bill.amount)}
            </Text>
            <View style={s.due}>
              <MobileIcon
                name="calendar"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[s.caption, muted, s.flex]}>
                {copy.dueDate} {format.date(bill.dueDate)}
              </Text>
            </View>
            {bill.hasPaymentSlip ? (
              <>
                <MobileButton variant="outline" onPress={() => viewSlip(bill)}>
                  {copy.viewSlip}
                </MobileButton>
                <Text style={[s.caption, muted]}>{copy.slipUploaded}</Text>
              </>
            ) : (
              <MobileButton
                isLoading={uploadingId === bill.id}
                disabled={uploadingId != null}
                onPress={() => select(bill, true)}
              >
                {labels.pay}
              </MobileButton>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.billDetails}
              onPress={() => select(bill)}
              style={s.details}
            >
              <Text style={[s.caption, muted]}>{labels.billDetails}</Text>
              <MobileIcon
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        ))}

      <View style={s.filters}>
        <MobileFilterChip
          label={labels.latest}
          selected={filter === "recent"}
          onPress={() => setFilter("recent")}
        />
        <MobileFilterChip
          label={labels.paid}
          selected={filter === "paid"}
          onPress={() => setFilter("paid")}
        />
      </View>
      {filter === "paid" && !history.length && (
        <Text style={[s.body, muted]}>{labels.noPaidBills}</Text>
      )}
      {history.map((bill) => (
        <Pressable
          key={bill.id}
          accessibilityRole="button"
          accessibilityLabel={`${format.month(bill.period)} · ${format.amount(bill.amount)} · ${copy.status.paid}`}
          onPress={() => select(bill)}
          style={({ pressed }) => [s.history, surface, pressed && s.pressed]}
        >
          <View style={s.flex}>
            <Text style={[s.body, ink]}>{format.month(bill.period)}</Text>
            {rooms.length !== 1 && (
              <Text style={[s.caption, muted]}>
                {[bill.property, bill.room].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text style={[s.caption, muted]}>
              {bill.paidAt
                ? `${copy.paidAt} ${format.date(bill.paidAt)}`
                : bill.documentNo}
            </Text>
          </View>
          <View style={s.historyRight}>
            <Text style={[s.body, ink]}>{format.amount(bill.amount)}</Text>
            {badge(bill)}
          </View>
          <MobileIcon
            name="chevron-right"
            size={18}
            color={tokens.colors.divider}
          />
        </Pressable>
      ))}

      {filter === "recent" && next?.status === "upcoming" && (
        <View style={s.upcoming}>
          <MobileIcon name="calendar" size={16} color={theme.textSecondary} />
          <View style={s.flex}>
            <Text style={[s.caption, muted]}>
              {copy.next} · {format.month(next.period)}
            </Text>
            {(rooms.length !== 1 ||
              rooms[0].leaseContractId !== next.leaseContractId) && (
              <Text style={[s.caption, muted]}>
                {[next.property, next.room].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Text style={[s.caption, muted]}>
              {copy.issueOn} {format.date(next.issueDate)}
            </Text>
          </View>
        </View>
      )}

      <MobileBottomSheet
        visible={!!selectedBill}
        onClose={() => setSelected(null)}
        maxHeight="88%"
      >
        {selectedBill && (
          <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheet}>
            <View style={s.header}>
              <Text style={[s.sheetTitle, ink, s.flex]}>
                {selected?.payment ? copy.slipSourceTitle : labels.billDetails}
              </Text>
              <MobileButton variant="ghost" onPress={() => setSelected(null)}>
                {copy.close}
              </MobileButton>
            </View>
            <Text style={[s.caption, muted]}>{selectedBill.documentNo}</Text>
            <Text style={[s.body, ink]}>
              {[
                selectedBill.property,
                selectedBill.room
                  ? `${labels.room} ${selectedBill.room}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <View style={s.header}>
              <Text style={[s.body, ink, s.flex]}>
                {copy.rentFor.replace(
                  "{month}",
                  format.month(selectedBill.period),
                )}
              </Text>
              {badge(selectedBill)}
            </View>
            <Text style={[s.amount, ink]}>
              {format.amount(selectedBill.amount)}
            </Text>
            <View style={s.row}>
              <Text style={[s.caption, muted]}>{copy.dueDate}</Text>
              <Text style={[s.caption, ink]}>
                {format.date(selectedBill.dueDate)}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={[s.caption, muted]}>{copy.graceUntil}</Text>
              <Text style={[s.caption, ink]}>
                {format.date(selectedBill.graceUntil)}
              </Text>
            </View>
            {selectedBill.paidAt && (
              <Text style={[s.caption, muted]}>
                {copy.paidAt} {format.date(selectedBill.paidAt)}
              </Text>
            )}
            {selectedBill.status !== "paid" && bank(selectedBill)}
            {selectedBill.hasPaymentSlip && (
              <MobileButton
                variant="outline"
                onPress={() => viewSlip(selectedBill)}
              >
                {copy.viewSlip}
              </MobileButton>
            )}
            {selectedBill.status !== "paid" &&
              (selected?.payment ? (
                <>
                  <MobileButton
                    disabled={uploadingId != null}
                    onPress={() => upload("photos")}
                  >
                    {copy.fromPhotos}
                  </MobileButton>
                  <MobileButton
                    variant="outline"
                    disabled={uploadingId != null}
                    onPress={() => upload("documents")}
                  >
                    {copy.fromFiles}
                  </MobileButton>
                </>
              ) : (
                <MobileButton
                  disabled={uploadingId != null}
                  onPress={() => select(selectedBill, true)}
                >
                  {selectedBill.hasPaymentSlip ? copy.replaceSlip : labels.pay}
                </MobileButton>
              ))}
          </ScrollView>
        )}
      </MobileBottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  room: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  bill: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    justifyContent: "space-between",
  },
  billTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  amount: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 38,
  },
  due: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  details: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  history: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyRight: { alignItems: "flex-end", gap: 4 },
  pressed: { opacity: 0.85 },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  upcoming: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  sheet: { padding: 16, gap: 12 },
  sheetScroll: { flexShrink: 1 },
  sheetTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
  },
  bank: { padding: 12, gap: 6, borderRadius: 12, borderWidth: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
});
