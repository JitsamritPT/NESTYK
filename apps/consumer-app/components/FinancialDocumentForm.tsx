import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Text, View } from "react-native";
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
export function FinancialDocumentForm({
  contractId,
  kind,
  onBack,
  onCreated,
}: {
  contractId: number;
  kind: FinancialDocumentKind;
  onBack: () => void;
  onCreated: (value: AgentContract) => void;
}) {
  const { t } = useLocale();
  const labels = t.agent.contracts.financial;
  const { theme } = useMobileTheme();
  const [form, setForm] = useState<FinancialDocumentInput | null>(null);
  const [items, setItems] = useState<
    { description: string; quantity: string; unitPrice: string }[]
  >([]);
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!saving.current) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  useEffect(() => {
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
  }, [contractId, kind, retry]);
  const required: TextField[] = [
    "documentNo",
    "issueDate",
    "customerName",
    "customerAddress",
    "issuerName",
    "issuerAddress",
    ...(kind === "invoice" ? ["dueDate" as const] : ["receiverName" as const]),
    ...(kind === "receipt" &&
    form?.paymentMethod &&
    form.paymentMethod !== "cash"
      ? ["paymentDetails" as const]
      : []),
  ];
  const decimal = (value: string) =>
    /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Number(value) : NaN;
  const parsedItems = items.map((item) => ({
    description: item.description,
    quantity: decimal(item.quantity),
    unitPrice: decimal(item.unitPrice),
  }));
  const subtotal = parsedItems.reduce(
    (sum, item) =>
      sum + Math.round(item.quantity * Math.round(item.unitPrice * 100)),
    0,
  );
  const taxable = subtotal - Math.round(decimal(discount) * 100);
  const total =
    (taxable + Math.round((taxable * (form?.vatRate ?? 0)) / 100)) / 100;
  async function submit() {
    if (!form || saving.current) return;
    if (
      required.some((key) => !form[key].trim()) ||
      items.some((item) => !item.description.trim()) ||
      (kind === "receipt" &&
        (!form.paymentMethod ||
          (form.paymentMethod !== "cash" && !form.paymentDetails.trim())))
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
        {labels.hint}
      </Text>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#DC2626", lineHeight: 24 }}
        >
          {error}
        </Text>
      )}
      {loading ? (
        <ActivityIndicator />
      ) : !form ? (
        <MobileButton onPress={() => setRetry((n) => n + 1)}>
          {labels.retry}
        </MobileButton>
      ) : (
        <>
          {input("documentNo", 40)}
          {input("issueDate", 10)}
          {kind === "invoice" && input("dueDate", 10)}
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
          {kind === "receipt" && (
            <>
              <Text style={{ color: theme.textHeading, lineHeight: 24 }}>
                {labels.paymentMethod} *
              </Text>
              {(["cash", "transfer", "cheque", "other"] as const).map(
                (method) => (
                  <MobileButton
                    key={method}
                    variant={
                      form.paymentMethod === method ? "primary" : "outline"
                    }
                    disabled={busy}
                    onPress={() => setForm({ ...form, paymentMethod: method })}
                  >
                    {labels[method]}
                  </MobileButton>
                ),
              )}
              {input("receiverName")}
            </>
          )}
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
