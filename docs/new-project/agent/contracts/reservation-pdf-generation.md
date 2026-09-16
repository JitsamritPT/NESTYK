# Mock reservation PDF workflow

## Current behavior

- `POST /agent/contracts/:id/reservation-preview` creates a Thai, one-page mock PDF on first use and returns the contract with a fresh private signed URL. It works before signing. Later previews reuse the stored file.
- After all three party records have a signed timestamp and signature path, `reservationLetterStatus` becomes `ready_to_generate` and the app shows **สร้างเอกสาร**.
- `POST /agent/contracts/:id/generate-reservation` checks agent ownership, reservation type and all three signatures. It downloads the existing mock PDF (or builds it if never previewed), embeds owner, tenant and agent PNGs into the three boxes, uploads the result, and updates `document_url`.
- `reservationLetterStatus` then becomes `ready`. Preview uses the signed result after refresh or reopening. Repeated generation returns the existing result.
- Incomplete signing returns `awaiting_signatures`; it does not block mock preview.
- Preview and generation return an `AgentContract`. Both routes require the agent role and scope access to the creator.
- The app prevents duplicate clicks, shows progress/errors and opens the resulting preview after successful generation.
- Reservation uploads/replacements remain disabled. Invoice and receipt uploads remain supported.

## Storage and concurrency

Private bucket: `SUPABASE_BUCKET_CONTRACTS`, default `contract-documents`.

- Unsigned mock: `{agentId}/{contractId}/mock/reservation_letter/{uuid}.pdf`
- Signed mock: `{agentId}/{contractId}/generated/reservation_letter/{uuid}.pdf`
- Signature images: `{agentId}/{contractId}/signatures/{uuid}.png`

`document_url` stores the current object path. Existing legacy uploaded files are not treated as generated PDFs. No schema migration is required. A compare-and-swap database update prevents a concurrent preview from overwriting a generated file; failed commits attempt to remove the unreferenced new upload. The original unsigned mock is retained when generation succeeds.

## Template

`reservation-pdf.ts` creates the `mock-v2` template and stamps the three fixed positions. It embeds Noto Sans Thai with the accompanying OFL license; Nest copies assets into the compiled app. Mock PDFs are explicitly labeled as test documents. Long single-line values are truncated with an ellipsis in this temporary layout. Notes and full legal contract terms are not included.

When the real template arrives, replace template creation and signature positions, add immutable template/data snapshot metadata and PDF hashes, and verify real field content/overflow visually. Old generated mock files will need an explicit version migration or regeneration workflow; they are not automatically replaced.

The existing agent proxy-signing behavior remains: one image may be applied to multiple selected parties. Three completed party records do not independently authenticate three different people.

## Verification

Contract tests exercise unsigned preview, the three-signature prerequisite, three PDF image objects, saved paths, repeated requests, rejected uploads, missing/inaccessible contracts, invalid PNG data and cleanup after concurrent writes. PDF QA renders both unsigned and signed examples to verify Thai text and signature positions.


## Reservation date semantics (2026-09-14)

Reservations have a booking date (`start_date`, exposed additionally as `bookingDate`) and a move-in date (`move_in_date` / `moveInDate`). Their `end_date` and API `endDate` are null. Reservation create requests require `startDate` and `moveInDate`; move-in may be the same day as booking, but cannot precede it. Lease dates keep their existing meaning.

Apply `apps/api/scripts/apply-reservation-move-in-date.cjs` before running the updated API. It moves legacy reservation `end_date` values into `move_in_date` and clears the former, leaving leases unchanged. Overlap checks treat reservations as open-ended from move-in, exclude closed records, and preserve the exception for the same tenant converting their reservation to a lease.

The v2 mock labels are วันที่จอง and วันที่เข้าอยู่. Versioned object paths prevent old mock-v1 PDFs from appearing as current previews. Existing files remain in Storage; users with all signatures can generate the new mock using the saved signatures.
