import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, Text, View } from "react-native";
import { MobileButton, MobileInput, useMobileTheme } from "@nestyk/ui/native";
import { useLocale } from "@nestyk/i18n";
import type {
  AgentContract,
  FinancialDocumentInput,
  FinancialDocumentKind,
} from "@nestyk/types";
import {
  generateFinancialDocument,
  getFinancialDocumentDefaults,
} from "../lib/agent-contracts-api";

type TextField = Exclude<
  keyof FinancialDocumentInput,
  "items" | "vatRate" | "discount"
>;

const RECEIPT_FIELDS: TextField[] = [
  "documentNo",
  "issueDate",
  "receiverName",
  "paymentDetails",
  "notes",
];

export function FinancialDocumentForm({
  contractId: fixedContractId,
  hosts,
  kind,
  onBack,
  onCreated,
}: {
  contractId?: number;
  hosts?: AgentContract[];
  kind: FinancialDocumentKind;
  onBack: () => void;
  onCreated: (value: AgentContract) => void;
}) {
  const { t } = useLocale();
  const labels = t.agent.contracts.financial;
  const { theme } = useMobileTheme();
  const needsHostPick = fixedContractId == null;
  const [hostId, setHostId] = useState<number | null>(fixedContractId ?? null);
  const contractId = fixedContractId ?? hostId;
  const [form, setForm] = useState<FinancialDocumentInput | null>(null);
  const [items, setItems] = useState<
    { description: string; quantity: string; unitPrice: string }[]
  >([]);
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  const isReceipt = kind === "receipt";
  const title = { color: theme.textHeading };
  const muted = { color: theme.textSecondary };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  useEffect(() => {
    if (contractId == null) {
      setForm(null);
      setLoading(false);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    getFinancialDocumentDefaults(contractId, kind)
      .then((data) => {
        if (!active) return;
        setForm(data);
        setDiscount(String(data.discount));
        setItems(
          data.items.map((item) => ({
            ...item,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          })),
        );
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : labels.invalid);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId, kind, retry, labels.invalid]);
  const required: TextField[] = isReceipt
    ? [
        "documentNo",
        "issueDate",
        "receiverName",
        ...(form?.paymentMethod && form.paymentMethod !== "cash"
          ? (["paymentDetails"] as const)
          : []),
      ]
    : [
        "documentNo",
        "issueDate",
        "customerName",
        "customerAddress",
        "issuerName",
        "issuerAddress",
        "dueDate",
      ];
  const decimal = (value: string) =>
    /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : NaN;
  const parsedItems = items.map((item) => ({
    description: item.description,
    quantity: decimal(item.quantity),
    unitPrice: decimal(item.unitPrice),
  }));
  const subtotal = (form?.items ?? parsedItems).reduce((sum, item) => {
    const quantity =
      typeof item.quantity === "number" ? item.quantity : decimal(String(item.quantity));
    const unitPrice =
      typeof item.unitPrice === "number"
        ? item.unitPrice
        : decimal(String(item.unitPrice));
    return sum + Math.round(quantity * Math.round(unitPrice * 100));
  }, 0);
  const discountValue = isReceipt
    ? form?.discount ?? 0
    : decimal(discount);
  const taxable = subtotal - Math.round(discountValue * 100);
  const vatRate = form?.vatRate ?? 0;
  const total =
    (taxable + Math.round((taxable * vatRate) / 100)) / 100;
  async function submit() {
    if (!form || contractId == null || saving.current) return;
    if (isReceipt) {
      if (
        required.some((key) => !form[key].trim()) ||
        !form.paymentMethod ||
        (form.paymentMethod !== "cash" && !form.paymentDetails.trim())
      ) {
        setError(labels.required);
        return;
      }
      saving.current = true;
      setBusy(true);
      setError("");
      try {
        onCreated(
          await generateFinancialDocument(contractId, kind, {
            documentNo: form.documentNo,
            issueDate: form.issueDate,
            paymentMethod: form.paymentMethod,
            paymentDetails: form.paymentDetails,
            receiverName: form.receiverName,
            notes: form.notes,
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : labels.invalid);
      } finally {
        saving.current = false;
        setBusy(false);
      }
      return;
    }
    if (
      required.some((key) => !form[key].trim()) ||
      items.some((item) => !item.description.trim())
    ) {
      setError(labels.required);
      return;
    }
    if (
      parsedItems.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0,
      ) ||
      !Number.isFinite(total) ||
      total <= 0 ||
      taxable < 0
    ) {
      setError(labels.invalid);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await generateFinancialDocument(contractId, kind, {
          ...form,
          items: parsedItems,
          discount: decimal(discount),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.invalid);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const input = (key: TextField, maxLength = 120, multiline = false) =>
    form && (
      <MobileInput
        key={key}
        label={labels[key]}
        required={required.includes(key)}
        value={form[key]}
        editable={!busy}
        maxLength={maxLength}
        multiline={multiline}
        placeholder={
          key === "issueDate" || key === "dueDate"
            ? labels.dateHint
            : required.includes(key)
              ? ""
              : labels.optional
        }
        keyboardType={
          key.endsWith("TaxId")
            ? "number-pad"
            : key.endsWith("Phone")
              ? "phone-pad"
              : key.endsWith("Email")
                ? "email-address"
                : "default"
        }
        onChangeText={(value) =>
          setForm((current) =>
            current ? { ...current, [key]: value } : current,
          )
        }
      />
    );
  return (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      <MobileButton variant="outline" disabled={busy} onPress={onBack}>
        {labels.back}
      </MobileButton>
      <Text style={{ fontSize: 22, lineHeight: 34, color: theme.textHeading }}>
        {labels.create} {t.agent.contracts[kind]}
      </Text>
      <Text
        style={{ fontSize: 14, lineHeight: 22, color: theme.textSecondary }}
      >
        {isReceipt ? labels.receiptHint : labels.hint}
      </Text>
      {needsHostPick && (
        <View style={{ gap: 8 }}>
          <Text style={[{ fontSize: 14, lineHeight: 22, fontWeight: "600" }, title]}>
            ผูกกับหนังสือจอง *
          </Text>
          {!(hosts ?? []).length ? (
            <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
              ยังไม่มีหนังสือจองที่ใช้ได้ — สร้างหนังสือจองก่อน
            </Text>
          ) : (
            (hosts ?? []).map((host) => {
              const selected = hostId === host.id;
              return (
                <Pressable
                  key={host.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => setHostId(host.id)}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: selected ? "#F8B615" : theme.border,
                    backgroundColor: selected ? "#FFF8E7" : theme.surface,
                    borderRadius: 12,
                    padding: 12,
                    gap: 4,
                    opacity: pressed || busy ? 0.7 : 1,
                  })}
                >
                  <Text style={[{ fontSize: 15, lineHeight: 24 }, title]}>
                    {host.contractNo}
                  </Text>
                  <Text style={[{ fontSize: 13, lineHeight: 20 }, muted]}>
                    {host.property}
                    {host.room ? ` · ห้อง ${host.room}` : ""}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#DC2626", lineHeight: 24 }}
        >
          {error}
        </Text>
      )}
      {contractId == null ? null : loading ? (
        <ActivityIndicator />
      ) : !form ? (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          {labels.retry}
        </MobileButton>
      ) : isReceipt ? (
        <>
          {RECEIPT_FIELDS.filter((key) => key !== "paymentDetails" && key !== "notes").map(
            (key) => input(key, key === "documentNo" ? 40 : key === "issueDate" ? 10 : 120),
          )}
          <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
            {labels.paymentMethod} *
          </Text>
          {(["cash", "transfer", "cheque", "other"] as const).map((method) => (
            <MobileButton
              key={method}
              variant={form.paymentMethod === method ? "primary" : "outline"}
              disabled={busy}
              onPress={() => setForm({ ...form, paymentMethod: method })}
            >
              {labels[method]}
            </MobileButton>
          ))}
          {input("paymentDetails", 200, true)}
          {input("notes", 300, true)}
          <Text
            style={{ fontSize: 20, lineHeight: 30, color: theme.textHeading }}
          >
            {labels.total}:{" "}
            {Number.isFinite(total)
              ? total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: theme.textSecondary }}>
            {labels.receiptTotalHint}
          </Text>
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: "#DC2626", lineHeight: 24 }}
            >
              {error}
            </Text>
          )}
          <MobileButton
            disabled={busy}
            isLoading={busy}
            onPress={() => void submit()}
          >
            {labels.confirm}
          </MobileButton>
        </>
      ) : (
        <>
          {input("documentNo", 40)}
          {input("issueDate", 10)}
          {input("dueDate", 10)}
          {input("reference", 60)}
          {input("customerName")}
          {input("customerAddress", 240, true)}
          {input("customerTaxId", 13)}
          {input("customerPhone", 40)}
          {input("customerEmail")}
          {input("issuerName")}
          {input("issuerAddress", 240, true)}
          {input("issuerTaxId", 13)}
          {input("issuerPhone", 40)}
          {input("issuerEmail")}
          {items.map((item, index) => (
            <View
              key={index}
              style={{
                gap: 12,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
                {labels.items} {index + 1}
              </Text>
              {(["description", "quantity", "unitPrice"] as const).map(
                (key) => (
                  <MobileInput
                    key={key}
                    label={labels[key]}
                    required
                    value={item[key]}
                    editable={!busy}
                    keyboardType={
                      key === "description" ? "default" : "decimal-pad"
                    }
                    maxLength={key === "description" ? 160 : 12}
                    multiline={key === "description"}
                    onChangeText={(value) =>
                      setItems((rows) =>
                        rows.map((row, i) =>
                          i === index ? { ...row, [key]: value } : row,
                        ),
                      )
                    }
                  />
                ),
              )}
              {items.length > 1 && (
                <MobileButton
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    setItems((rows) => rows.filter((_, i) => i !== index))
                  }
                >
                  {labels.removeItem}
                </MobileButton>
              )}
            </View>
          ))}
          {items.length < 5 && (
            <MobileButton
              variant="outline"
              disabled={busy}
              onPress={() =>
                setItems((rows) => [
                  ...rows,
                  { description: "", quantity: "1", unitPrice: "" },
                ])
              }
            >
              {labels.addItem}
            </MobileButton>
          )}
          <MobileInput
            label={labels.discount}
            value={discount}
            onChangeText={setDiscount}
            keyboardType="decimal-pad"
            editable={!busy}
            maxLength={12}
          />
          <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
            {labels.vatRate}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[0, 7].map((rate) => (
              <MobileButton
                key={rate}
                variant={form.vatRate === rate ? "primary" : "outline"}
                disabled={busy}
                onPress={() => setForm({ ...form, vatRate: rate })}
              >
                {rate}%
              </MobileButton>
            ))}
          </View>
          <Text
            style={{ fontSize: 20, lineHeight: 30, color: theme.textHeading }}
          >
            {labels.total}:{" "}
            {Number.isFinite(total)
              ? total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </Text>
          {input("paymentDetails", 200, true)}
          {input("notes", 300, true)}
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: "#DC2626", lineHeight: 24 }}
            >
              {error}
            </Text>
          )}
          <MobileButton
            disabled={busy}
            isLoading={busy}
            onPress={() => void submit()}
          >
            {labels.confirm}
          </MobileButton>
        </>
      )}
    </View>
  );
}
