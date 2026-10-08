import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocale } from "@nestyk/i18n";
import {
  MobileButton,
  MobileIcon,
  MobileStatusPill,
  tokens,
  useMobileTheme,
} from "@nestyk/ui/native";
import type {
  AgreementAttachmentChecklist,
  PartyContract,
} from "@nestyk/types";
import type { PartyContractRoom } from "./PartyContractsScreen";
import { billFormatters } from "../lib/bill-format";
import { tenantWorkspaceCopy } from "../lib/tenant-workspace-copy";

export function TenantContractList({
  rows,
  selectedRoom,
  history = false,
  onSelectRoom,
  onOpen,
}: {
  rows: PartyContract[];
  selectedRoom: PartyContractRoom | null;
  history?: boolean;
  onSelectRoom: (room: PartyContractRoom) => void;
  onOpen: (contract: PartyContract) => void;
}) {
  const { theme } = useMobileTheme();
  const { t, locale } = useLocale();
  const copy = tenantWorkspaceCopy(locale);
  const format = billFormatters(locale);
  const ink = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  const surface = { backgroundColor: theme.surface, borderColor: theme.border };
  const grouped = new Map<
    string,
    { room: PartyContractRoom; contracts: PartyContract[] }
  >();
  for (const row of rows) {
    const key = `${row.property?.trim() || ""}\u0000${row.room ?? ""}`;
    const group = grouped.get(key);
    if (group) group.contracts.push(row);
    else
      grouped.set(key, {
        room: { key, property: row.property?.trim() || "—", room: row.room },
        contracts: [row],
      });
  }
  const groups = [...grouped.values()].sort(
    (a, b) =>
      a.room.property.localeCompare(b.room.property, locale) ||
      (a.room.room ?? "").localeCompare(b.room.room ?? ""),
  );
  // A single room opens directly; multiple rooms keep the existing room picker.
  const group = selectedRoom
    ? groups.find(
        (item) =>
          item.room.property === selectedRoom.property &&
          item.room.room === selectedRoom.room,
      )
    : history
      ? undefined
      : groups.length === 1
        ? groups[0]
        : undefined;

  function roomHeader(room: PartyContractRoom, count: number, contracts: PartyContract[]) {
    return (
      <>
        <View style={[s.roomIcon, { backgroundColor: "rgba(0, 198, 141, 0.14)" }]}>
          <MobileIcon name="home" size={22} color={tokens.colors.roles.tenant} />
        </View>
        <View style={s.flex}>
          <Text style={[s.roomTitle, ink]}>{room.property}</Text>
          {room.room ? (
            <Text style={[s.caption, muted]}>
              {copy.room} {room.room}
            </Text>
          ) : null}
          {history ? (
            <Text style={[s.caption, muted]}>
              {contracts.some((row) => row.formKind === "lease" && row.status === "active")
                ? copy.currentStay
                : copy.pastStay}
            </Text>
          ) : null}
        </View>
        <Text style={[s.caption, muted]}>
          {copy.contractCount.replace("{count}", String(count))}
        </Text>
      </>
    );
  }
  function badge(row: PartyContract) {
    return (
      <MobileStatusPill
        label={copy.status[row.status]}
        tone={
          row.status === "active"
            ? "green"
            : row.status.startsWith("awaiting")
              ? "yellow"
              : "slate"
        }
      />
    );
  }
  function signer(row: PartyContract, party: "tenant" | "owner") {
    const signed = party === "tenant" ? row.tenantSignedAt : row.ownerSignedAt;
    return (
      <View style={s.signer} key={party}>
        <MobileIcon
          name={signed ? "check" : "info"}
          size={14}
          color={signed ? tokens.colors.subtle.successFg : theme.textSecondary}
        />
        <Text
          style={[
            s.caption,
            {
              color: signed
                ? tokens.colors.subtle.successFg
                : theme.textSecondary,
            },
          ]}
        >
          {copy[party]} · {signed ? copy.signed : copy.unsigned}
        </Text>
      </View>
    );
  }
  if (!group)
    return (
      <View style={s.root}>
        {history ? <Text style={[s.body, muted]}>{copy.roomHistoryHint}</Text> : null}
        {!rows.length ? (
          <Text style={[s.body, muted]}>{history ? copy.emptyHistory : copy.emptyContracts}</Text>
        ) : selectedRoom ? (
          <Text style={[s.body, muted]}>{copy.emptyRoom}</Text>
        ) : (
          groups.map(({ room, contracts }) => (
            <Pressable
              key={room.key}
              accessibilityRole="button"
              accessibilityLabel={`${room.property} ${room.room ?? ""}`}
              onPress={() => onSelectRoom(room)}
              style={({ pressed }) => [s.room, surface, pressed && s.pressed]}
            >
              {roomHeader(room, contracts.length, contracts)}
              <MobileIcon
                name="chevron-right"
                size={18}
                color={tokens.colors.divider}
              />
            </Pressable>
          ))
        )}
      </View>
    );

  const leases = group.contracts
    .filter((row) => row.formKind === "lease")
    .sort(
      (a, b) =>
        Number(b.status === "active") - Number(a.status === "active") ||
        b.startDate.localeCompare(a.startDate),
    );
  const documents = group.contracts.filter((row) => row.formKind !== "lease");
  return (
    <View style={s.root}>
      <View style={[s.room, surface]}>
        {roomHeader(group.room, group.contracts.length, group.contracts)}
      </View>
      {leases.map((row) => {
        const canSign =
          row.myParties.includes("tenant") &&
          !row.tenantSignedAt &&
          ["draft", "awaiting_signatures", "awaiting_agent_review"].includes(
            row.status,
          );
        return (
          <View key={row.id} style={[s.contract, surface]}>
            <View style={s.header}>
              <Text style={[s.caption, muted, s.flex]}>
                {row.status === "active" ? copy.currentContract : copy.lease}
              </Text>
              {badge(row)}
            </View>
            <Text style={[s.contractTitle, ink]}>
              {row.agreementTypeName || copy.lease}
            </Text>
            <Text style={[s.caption, muted]}>
              {copy.contractNo} {row.contractNo}
            </Text>
            <View style={[s.facts, { borderBottomColor: theme.border }]}>
              {[
                [copy.start, row.startDate ? format.date(row.startDate) : "—"],
                [copy.end, row.endDate ? format.date(row.endDate) : "—"],
                [
                  copy.rent,
                  row.monthlyRent != null
                    ? format.amount(row.monthlyRent)
                    : "—",
                ],
                [
                  copy.deposit,
                  row.deposit != null ? format.amount(row.deposit) : "—",
                ],
              ].map(([label, value]) => (
                <View key={label} style={s.fact}>
                  <Text style={[s.caption, muted]}>{label}</Text>
                  <Text style={[s.body, ink]}>{value}</Text>
                </View>
              ))}
            </View>
            {row.status !== "active" && (
              <View style={s.signers}>
                {signer(row, "tenant")}
                {signer(row, "owner")}
              </View>
            )}
            {row.status === "active" && row.nextRentBill !== undefined && (
              <View style={s.nextBill}>
                <MobileIcon
                  name="calendar"
                  size={16}
                  color={theme.textSecondary}
                />
                <View style={[s.flex, s.nextBillCopy]}>
                  <Text style={[s.caption, muted]}>
                    {copy.nextRentBill}
                    {row.nextRentBill
                      ? ` · ${format.month(row.nextRentBill.period)}`
                      : ""}
                  </Text>
                  {row.nextRentBill ? (
                    <>
                      <Text style={[s.body, ink]}>
                        {t.tenant.bills.issueOn}{" "}
                        {format.date(row.nextRentBill.issueDate)}
                      </Text>
                      <Text style={[s.caption, muted]}>
                        {t.tenant.bills.dueDate}{" "}
                        {format.date(row.nextRentBill.dueDate)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[s.caption, muted]}>
                      {copy.noMoreRentBills}
                    </Text>
                  )}
                </View>
              </View>
            )}
            <MobileButton onPress={() => onOpen(row)}>
              {canSign ? copy.viewAndSign : copy.viewContract}
            </MobileButton>
          </View>
        );
      })}
      {(documents.length > 0 || leases.length > 0) && (
        <>
          <Text style={[s.sectionTitle, ink]}>{copy.roomDocuments}</Text>
          {documents.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => onOpen(row)}
              style={({ pressed }) => [
                s.document,
                surface,
                pressed && s.pressed,
              ]}
            >
              <View
                style={[s.documentIcon, { backgroundColor: theme.background }]}
              >
                <MobileIcon
                  name="file-text"
                  size={20}
                  color={theme.screenTitle}
                />
              </View>
              <View style={s.flex}>
                <Text style={[s.body, ink]}>
                  {row.formKind === "reservation"
                    ? copy.reservation
                    : copy.broker}
                </Text>
                <Text style={[s.caption, muted]}>{row.contractNo}</Text>
                {badge(row)}
              </View>
              <MobileIcon
                name="chevron-right"
                size={18}
                color={tokens.colors.divider}
              />
            </Pressable>
          ))}
          {leases.map((row) => (
            <Pressable
              key={`attachments-${row.id}`}
              accessibilityRole="button"
              onPress={() => onOpen(row)}
              style={({ pressed }) => [
                s.document,
                surface,
                pressed && s.pressed,
              ]}
            >
              <View
                style={[s.documentIcon, { backgroundColor: theme.background }]}
              >
                <MobileIcon name="files" size={20} color={theme.screenTitle} />
              </View>
              <View style={s.flex}>
                <Text style={[s.body, ink]}>{copy.attachments}</Text>
                <Text style={[s.caption, muted]}>
                  {copy.documentHint} · {row.contractNo}
                </Text>
              </View>
              <MobileIcon
                name="chevron-right"
                size={18}
                color={tokens.colors.divider}
              />
            </Pressable>
          ))}
        </>
      )}
      <View style={s.note}>
        <MobileIcon name="shield" size={16} color={theme.textSecondary} />
        <Text style={[s.caption, muted, s.flex]}>{copy.contractsHint}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  room: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  body: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  },
  contract: { padding: 18, borderWidth: 1, borderRadius: 18, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    justifyContent: "space-between",
  },
  contractTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 12,
    borderBottomWidth: 1,
    rowGap: 14,
  },
  fact: { width: "50%", paddingRight: 8, gap: 4 },
  signers: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 6,
  },
  signer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  nextBill: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  nextBillCopy: { gap: 2 },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
  },
  document: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pressed: { opacity: 0.85 },
});

export function TenantContractAttachments({
  attachments,
  loading,
  disabled,
  onOpen,
}: {
  attachments: AgreementAttachmentChecklist | null;
  loading: boolean;
  disabled: boolean;
  onOpen: (documentId: number) => void;
}) {
  const { theme } = useMobileTheme();
  const { locale } = useLocale();
  const copy = tenantWorkspaceCopy(locale);
  const documents = (attachments?.documents ?? []).filter(
    (doc) => doc.isCurrent && doc.documentTypeCode.startsWith("lease_annex_"),
  );
  return (
    <View
      style={[
        s.contract,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[s.sectionTitle, { color: theme.textHeading }]}>
        {copy.attachments}
      </Text>
      {loading ? <ActivityIndicator color={tokens.colors.brand[500]} /> : null}
      {!loading && attachments && !documents.length ? (
        <Text style={[s.caption, { color: theme.textSecondary }]}>
          {copy.noAttachments}
        </Text>
      ) : null}
      {documents.map((document) => (
        <MobileButton
          key={document.id}
          variant="outline"
          disabled={disabled}
          onPress={() => onOpen(document.id)}
        >
          {document.fileName}
        </MobileButton>
      ))}
    </View>
  );
}
