# Currency + dual payment (PayPal / Chapa) plan

Design status: **implemented (Policy A)**  
Last updated: 2026-07-19

Companion to shipment → delivery → dispute → refund. Earnings rails already split PayPal/Chapa; this plan fixes **charge currency honesty** and **display**.

---

## Locked decisions

### Shipping × provider — Policy A (enforced)

| Path | Shipping | Payment | Currency |
|---|---|---|---|
| International | FedEx | PayPal only | USD |
| Local (future) | Local delivery / pickup | Chapa allowed | ETB |

**Detection note:** FedEx API codes often omit the `FEDEX_` prefix (e.g. `PRIORITY_OVERNIGHT`). Guards match known service types **and** `serviceName` containing “FedEx”, not only the substring `FEDEX` in `serviceType`.

No FX / conversion in v1.

### 1. Currency is independent of payment provider

| Field | Meaning |
|---|---|
| `paymentProvider` | `paypal` \| `chapa` (rail) |
| `currency` | `USD` \| `ETB` (unit of the charged amount) |
| `chargedAmount` | Exact amount sent to the gateway |

These three are **persisted explicitly** on every successful payment. They must not be derived from each other at runtime in production code paths.

**Forbidden long-term:**

```text
currency = provider === "chapa" ? "ETB" : "USD"
```

**Allowed once only:** a historical **migration** that backfills `currency` (and `chargedAmount` if missing) for old rows, using provider as a heuristic. After migration, every **new** payment writes currency from the init/verify payload.

**Checkout today:** the SPA still *selects* ETB when the buyer picks Chapa (and USD for PayPal) because gateways constrain that pairing. That is an explicit currency choice on the request — not a refund-time inference from provider.

### 2. Source of truth

Prefer first-class fields when practical; until then, `transaction.metadata` must hold:

```json
{
  "paymentProvider": "chapa",
  "currency": "ETB",
  "chargedAmount": 2282.01,
  "txRef": "...",
  "subtotal": ...,
  "shippingCost": ...,
  "platformFee": ...
}
```

Refunds use **`chargedAmount` + `currency` + `paymentProvider`** from that record — not `order.totalAmount` reinterpreted, and not a fresh price calculation.

Optional later: `Order.currency`, `Order.chargedAmount`, or columns on `Transaction` / `Refund` for query convenience. Metadata remains the audit trail of what the gateway saw.

### 3. Format only at presentation

- DB / APIs: numeric amounts + ISO currency code  
- UI / emails: `formatMoney(amount, currency)` → e.g. `ETB 1,200.00` / `$1,200.00`  
- Never store `"$1,200.00"` as the amount

Shared helpers:

- Backend: `src/libraries/currency/currency.util.ts`
- Gallery: `src/lib/format-money.ts`
- Admin: `src/lib/format-money.ts`

### 4. Shipping × provider (same as Policy A above)

Server rejects `chapa` + FedEx on order create and payment init. Checkout disables Chapa when FedEx is selected and auto-corrects Review if needed.

---

## What already works

- Dual balances (`earningPaypal` / `earningChapa`), ledger `provider`, withdrawals with `currency`
- Refund gateway routing by provider
- Dispute `reservedProvider` + reserved amount (units match charge currency once persisted)
- Persist `currency` / `chargedAmount` / `paymentProvider` on order create + payment init (+ complete)
- Complete Refund fails closed if snapshot missing (`requireChargeSnapshot`)
- One-time backfill script: `pnpm backfill:transaction-currency`
- UI: Orders, checkout summary/rates, admin dispute reserved amount, dispute emails via `formatMoney`

---

## Gaps remaining (later)

- FedEx declared/customs still often hardcoded `USD` (correct for Policy A + PayPal path)
- Optional first-class `Order.currency` / `Refund.currency` columns
- Admin orders list / listing prices if artists price in ETB
- Local (non-FedEx) shipping path so Chapa is usable end-to-end

---

## Phased rollout

### Phase 0 — Migration (one-time) — **done**

```bash
cd art-store-backend
pnpm backfill:transaction-currency
```

Heuristic **only in this script**: historical Chapa → `ETB`, PayPal → `USD`; `chargedAmount` ← transaction amount / order total when missing.

### Phase 1 — Persist + refund correctness — **done**

1. Payment init / verify / complete: require and write `currency`, `chargedAmount`, `paymentProvider`
2. Complete Refund: read those fields; refund that amount in that currency
3. Production refund path does not infer currency from provider (migration script only)
4. Shared `formatMoney`; Orders, disputes UI, dispute emails

### Phase 2 — Shipping policy (server) — **done (Policy A)**

1. Backend rejection of Chapa + FedEx
2. Checkout UI disables Chapa when FedEx selected
3. Declared value / customs: USD for PayPal/FedEx path

### Phase 3 — Polish — **open**

1. Optional `Order.currency` / `Refund.currency` columns  
2. Admin orders list currency-aware  
3. Listing currency if artists price in ETB  
4. Local shipping option for Chapa carts  

---

## Refund rule (normative)

```text
refundAmount   = transaction.metadata.chargedAmount  // or Transaction.amount if identical
refundCurrency = transaction.metadata.currency
refundProvider = transaction.metadata.paymentProvider
```

If `chargedAmount` / `currency` is missing after migration, fail closed (`MANUAL_REVIEW` / BadRequest) rather than inventing a currency from the provider at refund time.

---

## Non-goals (this plan)

- Multi-currency line items in one cart  
- Live market FX (unless Option B is chosen with an explicit stored rate)  
- Changing withdrawal provider split  

---

## Summary

```
paymentProvider  → how we pay / refund / ledger
currency         → unit of money (explicit, persisted)
chargedAmount    → exact gateway charge (explicit, persisted)
formatMoney      → UI/email only
shipping rules   → Policy A, enforced on the server
provider→currency inference → migration only, never steady-state refunds
```
