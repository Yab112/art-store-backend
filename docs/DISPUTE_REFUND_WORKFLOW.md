# Dispute resolve + buyer-wins refund workflow

Design status: **approved for implementation**  
Last updated: 2026-07-19

This document is the source of truth for admin dispute resolution when money may move. Seller Wins remains a single-step resolve. Buyer Wins is a multi-step workflow: decision → (optional return) → admin financial authorization → gateway + accounting.

---

## Goals

- Separate **who wins** from **when money moves**.
- Require physical return confirmation when a return is needed — without letting the seller gate the refund on condition disputes.
- Allow admin to **waive return** when nothing can/should come back.
- Keep one financial action: **Complete Refund**.
- Preserve operational visibility via an early `Refund` row (`PENDING`).
- Remain auditable and idempotent.

---

## Separation of responsibilities

| Actor | Decides | Does **not** decide |
|---|---|---|
| **Admin** | Who wins; whether return is required/waived; when to execute refund; cancel Buyer Wins before money moves | Seller’s physical receipt (unless waived) |
| **Seller** | Whether they **received** the returned artwork | Whether the refund proceeds; artwork condition |
| **System** | Gateway refund, ledger, order/artwork status, reservations | Business judgment |

Seller confirmation answers exactly one question:

> Did you receive the returned artwork?

It is **not** “the artwork is in acceptable condition.” Condition complaints after return are a **new** case — they must not block Complete Refund on this dispute.

---

## State machine

```
Buyer opens dispute
        │
        ▼
IN_PROGRESS
        │
        ├──────── Seller Wins ───────► RESOLVED (SELLER_WINS)
        │
        ▼
Buyer Wins recorded
        │
        ├──── Return required ─────────► WAITING_FOR_RETURN
        │         │                        │
        │         │                        ├─ Seller confirms receipt ──► READY_FOR_REFUND
        │         │                        │
        │         │                        └─ Admin waives return ──────► READY_FOR_REFUND
        │         │
        │         └─ Admin cancels Buyer Wins (Refund still PENDING only)
        │                    └─► back to IN_PROGRESS (outcome cleared)
        │
        └──── Return waived ───────────► READY_FOR_REFUND
                                                │
                                                ▼
                                      Admin Complete Refund
                                                │
                                                ▼
                                  Gateway refund + accounting
                                                │
                                                ▼
                                   RESOLVED (BUYER_WINS)
                                   (immutable thereafter)
```

### Status meanings

| Status | Meaning |
|---|---|
| `IN_PROGRESS` | Under review; no winner recorded yet |
| `WAITING_FOR_RETURN` | Buyer Wins recorded; return required; waiting on seller confirm **or** admin late waive / cancel |
| `READY_FOR_REFUND` | Return confirmed **or** waived; waiting on admin to execute money movement |
| `RESOLVED` | Terminal. Seller Wins settled, or Buyer Wins refund completed |

> **Naming note:** Prefer `READY_FOR_REFUND` over `AWAITING_REFUND`. The latter sounds like the payment gateway is in flight; this status means “ready for admin to authorize Complete Refund.”

While gateway work is in flight after Complete Refund is clicked, use `Refund.status` (`PROCESSING` / `FAILED` / `COMPLETED`) — not a new dispute status.

---

## Buyer Wins — detailed steps

### 1. Admin records Buyer Wins

Admin chooses:

- **Return required** (default), or
- **Return not required** (waive) + **waive reason** (required when waiving)

Effects (no gateway call):

- `Dispute.outcome = BUYER_WINS`
- `Dispute.resolution` = admin decision note
- `Dispute.assignedToId` = admin
- `Dispute.resolvedAt` remains `null`
- Status:
  - return required → `WAITING_FOR_RETURN`
  - waived → `READY_FOR_REFUND`
- Create **`Refund`** immediately:
  - `status = PENDING`
  - amount = full order total (v1)
  - provider + `idempotencyKey` reserved for later Complete Refund
  - `returnRequired` / waive metadata mirrored as needed
- Reservation (`reservedAmount`) stays in force
- Artwork stays `DISPUTED`; order stays `DISPUTED`
- Audit: `BUYER_WINS_RECORDED` (+ `RETURN_WAIVED` if waived up front)

### 2a. Seller confirms return (when return required)

Seller action on platform:

- Affirms **receipt only** (signature evidence)
- Optional note / photo for ops — **not** a veto
- Persist confirmation fields (see Data model); derive signed state from `confirmedAt != null`

Effects:

- Dispute → `READY_FOR_REFUND`
- Audit: `RETURN_CONFIRMED`

Hard rules:

- Only `targetUserId` (seller) may confirm
- Only when status is `WAITING_FOR_RETURN`
- Idempotent if already confirmed
- Confirmation must not collect or interpret “condition OK”

### 2b. Admin waives return (early or late)

Allowed:

- At Buyer Wins decision, or
- Later from `WAITING_FOR_RETURN` (stuck / lost return / seller told buyer to keep item, etc.)

Requires waive reason. Effects:

- Dispute → `READY_FOR_REFUND`
- Store `returnWaivedAt`, `returnWaivedById`, `returnWaiveReason`
- Audit: `RETURN_WAIVED`

Soft UX hint by dispute reason (e.g. suggest waive for `NOT_RECEIVED`) — **never auto-waive**.

### 2c. Admin cancels Buyer Wins (mistake correction)

Allowed **only while** `Refund.status === PENDING` (no money moved).

From `WAITING_FOR_RETURN` or `READY_FOR_REFUND` (before Complete Refund):

- Clear `outcome` / unresolved Buyer Wins decision fields as appropriate
- Dispute → `IN_PROGRESS`
- Cancel or void the PENDING refund row (or mark superseded — pick one approach in impl and keep consistent)
- Clear return confirmation / waive flags if needed
- Audit: `BUYER_WINS_CANCELLED`
- Reservation remains based on open dispute rules

After Complete Refund / `RESOLVED`: **immutable** (v1, no reopen).

### 3. Admin Complete Refund (only financial action)

Allowed only when:

- `Dispute.status === READY_FOR_REFUND`
- `Refund.status` in `PENDING` | `FAILED` | `PROCESSING` (reconcile), and
- Return confirmed **or** return waived

Runs the existing gateway-first settlement:

1. Gateway refund (PayPal / Chapa) with stored idempotency key  
2. On success: single DB transaction — seller debit, pending cancel, platform adjustment, refund `COMPLETED`, order `REFUNDED`, artworks `APPROVED`, dispute `RESOLVED`, unfreeze metadata  
3. Cache refresh after commit  

Audits:

- Success → `REFUND_COMPLETED`
- Gateway/settlement failure → `REFUND_FAILED` (keep dispute `READY_FOR_REFUND` or leave dispute status and use `Refund.status = FAILED` / `PROCESSING`; prefer refund status for money state)

Money moves **exactly once** through this action.

---

## Seller Wins (unchanged shape)

Single admin action from `IN_PROGRESS`:

- Order → `COMPLETED`
- Release funds / pending credit release path
- Artwork stays `SOLD`
- Dispute → `RESOLVED`, `outcome = SELLER_WINS`
- Clear reservation
- No refund row (or none required)

---

## Buyer restrictions after Buyer Wins

Once Buyer Wins is recorded (`WAITING_FOR_RETURN` or `READY_FOR_REFUND`):

Buyer **must not** be able to:

- Upload more evidence on this dispute
- Change dispute reason / description
- Reopen or amend the dispute

The case only moves toward refund (or admin cancel Buyer Wins before money).

---

## Data model (implementation target)

### `DISPUTE_STATUS` additions

- `WAITING_FOR_RETURN`
- `READY_FOR_REFUND`

Keep: `IN_PROGRESS`, `RESOLVED`, (`CLOSED` / `REJECTED` if already present for other flows).

### Dispute (policy / case)

Suggested fields:

- `returnRequired` `Boolean` (default `true` at Buyer Wins)
- `returnWaivedAt` `DateTime?`
- `returnWaivedById` `String?`
- `returnWaiveReason` `String?`
- Return confirmation (on Dispute or dedicated related row — prefer dedicated or explicit fields over boolean-only):
  - `returnConfirmedAt` `DateTime?`
  - `returnConfirmedBySellerId` `String?`
  - `returnConfirmNote` `String?`
  - `returnConfirmPhotoUrls` `String[]` (or JSON)
  - `returnSignatureUrl` `String?`

**Do not** rely on a redundant `sellerSigned` boolean as source of truth; derive:

```text
sellerConfirmed = returnConfirmedAt != null
```

Existing `Refund.sellerSigned` may be synced for display or dropped in favor of derived state.

### Refund (money visibility)

Create when Buyer Wins is recorded:

| Field | At Buyer Wins | After Complete Refund |
|---|---|---|
| `status` | `PENDING` | `PROCESSING` → `COMPLETED` / `FAILED` |
| `amount` | full order total | unchanged |
| `idempotencyKey` | set | reused on retries |
| `gatewayRefundId` | null | set on success |

Ops visibility: “Refund exists, waiting for return / ready for admin” instead of “no refund row yet.”

### Audit events (`DisputeResolutionEvent` or equivalent)

- `BUYER_WINS_RECORDED`
- `BUYER_WINS_CANCELLED`
- `RETURN_WAIVED`
- `RETURN_CONFIRMED`
- `REFUND_COMPLETED`
- `REFUND_FAILED`

---

## Money, reservation, blocking

Reservation for withdrawable balance continues while:

- Dispute is `IN_PROGRESS`, `WAITING_FOR_RETURN`, or `READY_FOR_REFUND`, and/or
- Linked refund is `PROCESSING` / `MANUAL_REVIEW` (existing rules)

Buyer “active dispute blocks new purchases” should treat `WAITING_FOR_RETURN` and `READY_FOR_REFUND` as active.

Artwork: remain `DISPUTED` until Complete Refund succeeds → `APPROVED`.

---

## API sketch

| Endpoint | Who | From → To |
|---|---|---|
| `POST /admin/disputes/:id/resolve` `SELLER_WINS` | Admin | `IN_PROGRESS` → `RESOLVED` |
| `POST /admin/disputes/:id/resolve` `BUYER_WINS` + `returnRequired` / waive reason | Admin | → `WAITING_FOR_RETURN` or `READY_FOR_REFUND` + create `Refund PENDING` |
| `POST /admin/disputes/:id/waive-return` | Admin | `WAITING_FOR_RETURN` → `READY_FOR_REFUND` |
| `POST /admin/disputes/:id/cancel-buyer-wins` | Admin | Buyer-wins open + Refund `PENDING` → `IN_PROGRESS` |
| `POST /disputes/:id/confirm-return` | Seller | `WAITING_FOR_RETURN` → `READY_FOR_REFUND` |
| `POST /admin/disputes/:id/complete-refund` | Admin | `READY_FOR_REFUND` → gateway + `RESOLVED` |

Exact paths can match existing Nest routing conventions; behaviors above are normative.

---

## UI sketch

### Admin

| Status | Primary actions |
|---|---|
| `IN_PROGRESS` | Seller wins · Buyer wins (return required checkbox / waive + reason) |
| `WAITING_FOR_RETURN` | Waive return · Cancel Buyer Wins · (waiting banner) |
| `READY_FOR_REFUND` | Complete refund · Cancel Buyer Wins (if Refund still `PENDING`) · show confirm evidence or waive reason |
| `RESOLVED` | Read-only |

### Seller

- List / detail: disputes needing return confirmation
- Form: signature + optional note/photos
- Copy: acknowledge **receipt only**, not condition

### Buyer

- After Buyer Wins: instructions to ship back (if return required); refund pending until admin completes
- No edit/reopen controls on that dispute

---

## Notifications (v1)

1. Buyer Wins recorded → buyer + seller  
2. Seller confirms / admin waives → admin  
3. Complete Refund success → buyer (+ seller as needed)  
4. Refund failed → admin (and surface `REFUND_FAILED` / `failureReason`)

---

## Migration / legacy

- Disputes mid old “instant Buyer Wins → gateway” flow: finish via existing reconcile / Complete Refund-compatible retry; do not force them into `WAITING_FOR_RETURN` if money already moved.
- New disputes use this workflow only.

---

## Explicit non-goals (v1)

- In-platform reverse shipping / FedEx return labels  
- Partial refunds  
- Auto-refund on seller confirm  
- Auto-waive by dispute reason  
- Seller condition veto of refund  
- Reopening `RESOLVED` disputes  

---

## Implementation order

1. Schema: statuses, return/waive/confirm fields, audit event types  
2. Reservation + active-dispute queries  
3. Split APIs: record Buyer Wins, waive, cancel, seller confirm, complete refund  
4. Admin UI state machine  
5. Seller confirm UI (reuse delivery signature pattern)  
6. Buyer lock-down after Buyer Wins  
7. Emails + smoke tests (default return, early waive, late waive, cancel before money, Complete Refund success/fail)

---

## Summary

```
Admin decides who wins.
Seller confirms only whether the artwork was physically returned.
Admin authorizes the actual financial transaction.
System performs accounting and payment changes in one Complete Refund operation.
```

That separation minimizes ambiguity and keeps the workflow easy to audit and reason about.
