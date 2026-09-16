# Rent & terms — mobile-first

Each lease option owns its rent, advance-rent months and deposit months. Changing one option must not change another.

## Interaction

- Overview: compact outlined Add lease button; cards show duration, emphasized monthly price and advance/deposit summary.
- Add sheet: no duration preselected; existing durations disabled and marked Added.
- Edit sheet: duration in heading, without duplicate duration controls.
- Selected chips: pale amber with checkmark; solid amber reserved for the primary action.
- Show calculated advance/deposit amounts below their respective controls.
- Sheet heading and action footer remain outside the scrollable form. Keyboard avoidance is opt-in on this sheet.
- Add terms / Apply changes commit to the in-memory room form only. Close discards sheet edits.
- Done returns to Room setup. Save room persists; a newly created room remains private.
- Room setup shows the lease count and lowest monthly price. Completed sections remain editable.

## Persistence and compatibility

The existing `rent_rooms.prices` JSON stores `advanceRentMonths` and `depositMonths` per `contractTypeId`; normalized price rows continue to hold prices for sorting. No schema migration is required.

The API validates each supplied month count as an integer from 0 through 12 and rejects duplicate durations. Detail/list responses merge lease terms from JSON into normalized price rows. Legacy rooms fall back to room-level values (then 1 advance / 2 deposit). Older clients omitting per-lease terms preserve previously stored lease metadata on edit.

Editing and room detail UI consume these per-lease values. Room-level fields remain for backward compatibility and must not drive the new per-lease editor.

## Verification

Test independent terms, zero advance, legacy fallback, invalid month counts, reopening an existing room and cancel without saving. Manually verify software-keyboard visibility and large text on a small device; checking a hardware-keyboard simulator alone does not prove keyboard avoidance.
