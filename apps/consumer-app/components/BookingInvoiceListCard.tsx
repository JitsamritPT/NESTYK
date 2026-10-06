import React from "react";
import { Pressable, Text, View } from "react-native";
import { tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";

export function bookingInvoicesForTenant(
  contracts: AgentContract[],
  tenantId?: number,
) {
  return contracts.filter(
    (contract) =>
      contract.formKind === "reservation" &&
      contract.invoiceUrl &&
      contract.reservationPayment &&
      (tenantId == null || contract.tenantId === tenantId),
  );
}

export function BookingInvoiceListCard({
  contract,
  busy,
  onOpen,
}: {
  contract: AgentContract;
  busy: boolean;
  onOpen: () => void;
}) {
  const { theme } = useMobileTheme();
  const payment = contract.reservationPayment;
  if (!payment || !contract.invoiceUrl) return null;
  const text = {
    color: theme.textSecondary,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  };
  const closed = ["cancelled", "expired", "terminated"].includes(contract.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`ดูใบแจ้งหนี้ค่าจอง ${payment.invoiceDocumentNo}`}
      disabled={busy}
      onPress={onOpen}
      style={({ pressed }) => ({
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
        opacity: pressed || busy ? 0.65 : 1,
      })}
    >
      <Text style={{ ...text, color: theme.textHeading, fontSize: 18 }}>
        {payment.invoiceDocumentNo}
      </Text>
      <Text style={{ ...text, color: theme.textHeading }}>{contract.tenant}</Text>
      <Text style={text}>ค่าจอง · ผูกกับหนังสือจอง {contract.contractNo}</Text>
      <Text style={text}>
        {contract.property}{contract.room ? ` · ห้อง ${contract.room}` : ""}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={text}>
          ฿{payment.total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ ...text, color: payment.status === "paid" ? "#198460" : "#B45309" }}>
          {closed ? "หนังสือจองปิดแล้ว" : payment.status === "paid" ? "ชำระแล้ว" : payment.status === "submitted" ? "ส่งสลิปแล้ว · รอตรวจสอบ" : "รอชำระเงิน"}
        </Text>
      </View>
    </Pressable>
  );
}
