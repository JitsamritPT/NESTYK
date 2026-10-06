# Reservation booking invoices and payments

New reservation drafts create a booking invoice PDF in the same transaction as the contract. The contract's `invoice_url` and `data.financialDocuments.invoice` own the invoice; it is not an `agent_invoices` standalone record. Its number is `INV-{contractNo}`, with one booking-fee line item, no discount and no VAT. The existing NESTYK issuer and PDF renderer are reused. Existing columns and JSON data support this flow, so no schema migration is required.

The reservation detail shows the invoice, payment slip and receipt to the delivered parties. Only its tenant may submit a slip. File and photo selection support PDF/JPG/PNG up to 10 MB. Submission is evidence awaiting agent review; it does not issue a receipt or change the signature lifecycle/status. The agent inspects the evidence and confirms payment through the linked receipt form. Cash can be confirmed without a slip. The receipt derives payer, reference, items and total from the saved invoice, uses `REC-{contractNo}`, and appears in the tenant's contract detail.

An unsigned reservation tenant must have an issued booking receipt before signing. A submitted slip alone does not satisfy this gate. Tenant-account signing, public signing links and agent proxy signing all enforce it on the server; the UI disables the tenant signature action and explains the payment requirement. Public links hide the signature pad until approval and allow refreshing payment readiness. Delivery and invoice/slip access remain available before payment. Owner and agent signing, and ordinary lease signing, keep their existing prerequisites. Existing signatures and historical receipts are retained.

- `GET /contracts/mine/:id/financial-documents/:kind`: fresh private signed URL for `invoice`, `receipt` or `payment-slip`; requires access to the delivered contract.
- `POST /contracts/mine/:id/payment-slip`: one multipart `file`; only the delivered tenant can upload. Rechecks ownership, delivery, open status, current invoice and receipt under a row lock. Stores the private path and submission metadata under `data.reservationPayment`, plus `payment_submitted_at`.
- `POST /agent/contracts/:id/financial-documents/receipt`: creates the linked receipt once, including after the signed reservation PDF becomes active. Repeated requests reuse it.
- `POST /agent/contracts/:id/financial-documents/invoice`: creates a missing linked invoice for a legacy reservation. The agent detail exposes this action. Existing linked invoices are reused; caller-provided items/amounts/numbers are ignored.

Draft edits regenerate the invoice from the reservation while preserving its number and dates. A submitted slip or issued receipt blocks draft edits/cancellation so payment evidence cannot silently refer to a different amount. After a receipt is issued, the tenant cannot replace the slip. Closed reservations cannot accept payments or issue new documents. Direct uploads cannot replace generated booking invoices/receipts. Failed persistence cleans uploaded files; a successful slip replacement deletes only the previous slip.

Standalone invoice and receipt flows remain separate, including their invoice numbering and selectable invoices. Legacy reservation invoice uploads can still be viewed; the agent must create a linked booking invoice before the tenant submits payment evidence. Historical receipts are preserved.

The agent's invoice list includes linked booking invoices alongside standalone invoices in its count. Booking cards show their reservation number, tenant, room, amount and payment status. Opening one refreshes the contract's signed document URL and displays the invoice PDF; closing the preview returns to its reservation detail for payment review and receipt issuance.

Validation:

```sh
npm run test:agent-contracts --workspace @nestyk/api
node --test apps/consumer-app/components/booking-invoice-list.test.cjs apps/consumer-app/components/financial-document-routing.test.cjs apps/consumer-app/components/reservation-payment-card.test.cjs apps/consumer-app/components/reservation-letter-fields.test.cjs apps/consumer-app/components/lease-agreement-fields.test.cjs
node --test apps/consumer-app/lib/contract-signing.test.cjs apps/consumer-app/components/party-payment-signing.test.cjs apps/web/app/sign/booking-signing.test.cjs
npx tsc --noEmit -p apps/api/tsconfig.json
```
