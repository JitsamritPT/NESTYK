import React from "react";
import { Text, View } from "react-native";
import { MobileButton, tokens, useMobileTheme } from "@nestyk/ui/native";
import type { AgentContract } from "@nestyk/types";

export function ReservationPaymentCard({
  contract,
  busy,
  onOpen,
  onUpload,
  onIssueReceipt,
  onCreateInvoice,
}: {
  contract: AgentContract;
  busy: boolean;
  onOpen: (kind: "invoice" | "receipt" | "payment-slip") => void;
  onUpload?: () => void;
  onIssueReceipt?: () => void;
  onCreateInvoice?: () => void;
}) {
  const { theme } = useMobileTheme();
  const payment = contract.reservationPayment;
  const paymentStatus = contract.receiptUrl ? "paid" : payment?.status ?? "unpaid";
  const status = {
    unpaid: { label: "รอชำระ", color: "#B45309", background: "#FFFBEB" },
    submitted: { label: "รอตรวจสอบ", color: "#1D4ED8", background: "#EFF6FF" },
    paid: { label: "ชำระแล้ว", color: "#15803D", background: "#F0FDF4" },
  }[paymentStatus];
  const closed = ["cancelled", "expired", "terminated"].includes(
    contract.status,
  );
  const text = {
    color: theme.textSecondary,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
  };
  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Text
          style={{
            color: theme.textHeading,
            fontFamily: tokens.typography.native.headingTh,
            fontSize: 18,
            lineHeight: 27,
          }}
        >
          การชำระค่าจอง
        </Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: status.background }}>
          <Text
            accessibilityLabel={`สถานะการชำระค่าจอง: ${status.label}`}
            style={{ ...text, color: status.color, fontSize: 13 }}
          >
            {status.label}
          </Text>
        </View>
      </View>
      <Text style={text}>ผูกกับหนังสือจอง {contract.contractNo}</Text>
      <Text style={text}>
        ยอดค่าจอง ฿
        {(payment?.total ?? contract.reservationFee ?? 0).toLocaleString(
          "th-TH",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        )}
      </Text>
      {paymentStatus !== "unpaid" && (
        <Text style={text}>
          {paymentStatus === "paid"
            ? "เอเจนต์ยืนยันการชำระและออกใบเสร็จแล้ว"
            : "ส่งสลิปแล้ว กำลังรอเอเจนต์ตรวจสอบการชำระเงิน"}
        </Text>
      )}
      {closed && <Text style={text}>หนังสือจองปิดแล้ว</Text>}
      {contract.invoiceUrl ? (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("invoice")}
        >
          ดูใบแจ้งหนี้ค่าจอง
          {payment?.invoiceDocumentNo ? ` ${payment.invoiceDocumentNo}` : ""}
        </MobileButton>
      ) : onCreateInvoice && !closed ? (
        <MobileButton disabled={busy} onPress={onCreateInvoice}>
          สร้างใบแจ้งหนี้ค่าจอง
        </MobileButton>
      ) : (
        <Text style={text}>ยังไม่มีใบแจ้งหนี้ค่าจอง</Text>
      )}
      {contract.invoiceUrl &&
        !payment &&
        !contract.receiptUrl &&
        onCreateInvoice &&
        !closed && (
          <MobileButton disabled={busy} onPress={onCreateInvoice}>
            สร้างใบแจ้งหนี้ค่าจองที่ผูกกับหนังสือจอง
          </MobileButton>
        )}
      {payment?.paymentSlipUrl && (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("payment-slip")}
        >
          ดูสลิปชำระค่าจอง
        </MobileButton>
      )}
      {onUpload &&
        payment &&
        contract.invoiceUrl &&
        !contract.receiptUrl &&
        !closed && (
          <>
            <MobileButton disabled={busy} isLoading={busy} onPress={onUpload}>
              {payment?.status === "submitted"
                ? "อัปโหลดสลิปใหม่"
                : "อัปโหลดสลิปชำระค่าจอง"}
            </MobileButton>
            <Text style={text}>
              แนบไฟล์ PDF, JPG หรือ PNG ไม่เกิน 10 MB เมื่อเอเจนต์ตรวจสอบแล้ว
              ใบเสร็จจะแสดงที่นี่
            </Text>
          </>
        )}
      {contract.receiptUrl ? (
        <MobileButton
          variant="outline"
          disabled={busy}
          onPress={() => onOpen("receipt")}
        >
          ดูใบเสร็จค่าจอง
          {payment?.receiptDocumentNo ? ` ${payment.receiptDocumentNo}` : ""}
        </MobileButton>
      ) : onIssueReceipt && payment && contract.invoiceUrl && !closed ? (
        <MobileButton disabled={busy} onPress={onIssueReceipt}>
          ตรวจสอบการชำระและออกใบเสร็จ
        </MobileButton>
      ) : null}
    </View>
  );
}
