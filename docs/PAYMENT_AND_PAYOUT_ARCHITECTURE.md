# Marketplace Payment & Payout Architecture (MVP)

This document defines the payment and payout architecture for the marketplace MVP.

The design separates three independent concerns:

- Buyer payment capability
- Seller payout capability
- Shipping

Checkout is defined as a computation over validated capabilities rather than a set of country-specific business rules.

---

# Core Principles

The marketplace consists of four independent concerns:

1. Seller payout capability
2. Buyer payment capability
3. Checkout (capability resolution + currency handling)
4. Shipping

These concerns do not depend on one another's internals.

- Checkout does not know why a capability exists.
- Shipping does not know which payment method was used.
- Payout setup does not know anything about buyer behavior.

---

# Seller Payout Capability

Each seller may connect one or more payout methods in:

**Settings → Billing & Payments**

For the MVP, supported payout providers are:

- PayPal
- Chapa

A seller may only connect a payout provider that can actually receive and disburse funds to them.

Provider support for a country is not binary. A provider may be:

- Fully supported
- Receive-restricted
- Send-only

Payout eligibility must be validated against the specific capability required (receiving funds, withdrawing to a local bank or wallet), not merely whether the provider exists in that country.

Example:

```ts
payoutSupport: 'full' | 'sendOnly' | 'unsupported'
```

Only **`full`** support qualifies a seller to connect that provider for payouts.

Example capability sets:

```text
Seller Payout Capabilities

✓ Chapa
```

```text
Seller Payout Capabilities

✓ PayPal
✓ Chapa
```

Validation occurs once during payout account setup and produces a durable capability record.

Checkout never re-derives eligibility from country or identity. It only reads validated capabilities.

## Disconnection Rule

A seller may not disconnect a payout provider while it contains:

- pending balance
- withdrawable balance

The balance must first reach zero.

This prevents orphaned ledger entries that cannot be withdrawn.

---

# Buyer Payment Capability

A buyer has one or more payment capabilities representing payment methods they can realistically use.

Example:

```text
Buyer Payment Capabilities

✓ PayPal
```

```text
Buyer Payment Capabilities

✓ PayPal
✓ Chapa
```

Buyer capability may be determined by:

- supported payment accounts
- supported region
- available local payment providers
- future eligibility rules

Checkout does not care how these capabilities were determined.

---

# Checkout

Checkout computes the usable payment methods for a specific order.

Conceptually:

```text
Available Checkout Methods =
resolve(
    Buyer Payment Capabilities,
    Seller Payout Capabilities,
    Order
)
```

For the MVP this normally becomes:

```text
Available Checkout Methods =
Buyer Payment Capabilities
        ∩
Seller Payout Capabilities
```

The marketplace intentionally models checkout as a **resolution function** instead of a simple intersection so future provider restrictions can be added without redesigning checkout.

Examples include:

- sanctions
- provider corridor restrictions
- provider-specific routing policies

### Examples

Seller:

```text
PayPal
Chapa
```

Buyer:

```text
PayPal
```

Checkout:

```text
PayPal
```

---

Seller:

```text
PayPal
Chapa
```

Buyer:

```text
Chapa
```

Checkout:

```text
Chapa
```

---

Seller:

```text
PayPal
```

Buyer:

```text
PayPal
Chapa
```

Checkout:

```text
PayPal
```

---

Seller:

```text
Chapa
```

Buyer:

```text
PayPal
```

Checkout:

```text
No compatible payment methods available.
```

## No Compatible Payment Method

This is a defined product state—not an error.

The marketplace should:

- keep the listing visible
- disable purchasing
- explain that no compatible payment method exists
- notify the seller if many buyers cannot complete checkout so they can connect another payout provider

---

# Currency Handling

## Canonical model

- **Listing currency is always USD.** Sellers price artwork in dollars.
- **Shipping is always priced in USD** (logistics independent of payment rail).
- Buyers choose a payment provider at checkout.
- **PayPal** collects USD (`chargedCurrency = USD`).
- **Chapa** collects ETB. The marketplace does **not** move FX funds; it
  **calculates** an ETB charge amount using a locked exchange rate
  (`CheckoutPricingService` → immutable `ChargeQuote`).
- Seller balances remain provider-specific (PayPal USD / Chapa ETB).
- Refunds use the original **charged** currency and amount on the Charge.

## ChargeQuote (source of truth)

```text
Pricing (USD artwork + USD shipping + fee)
        ↓
CheckoutPricingService
        ↓
ChargeQuote { provider, totalUsd, fxRate?, chargedCurrency, chargedAmount, expiresAt, … }
        ↓
Order + Transaction (Charge) persist the quote
        ↓
Payment init / refunds consume the same quote — no recalculation
```

Expired quotes are rejected; the buyer must refresh checkout (MVP).

## Stored fields (simplified)

Persist:

- `listingCurrency = USD` (on artwork / line)
- `chargedCurrency`, `chargedAmount`
- `chargeQuote` (full snapshot) including `lockedFxRate`, `lockedAt`, `expiresAt`, `fxSource`

Do not require separate `settlement_currency` / `refund_currency` columns —
refund currency is always the charged currency.

Legacy metadata aliases may still be written for older readers.

All monetary values prefer **integer minor units** where persisted.

---

# Shipping

Shipping is completely independent from payment.

Shipping depends on:

- seller location
- buyer location
- shipping address
- package information
- shipping carrier

Carrier selection is based on logistics—not payment provider.

**S1:** Shipping quotes are always in USD. When the buyer pays with Chapa, the
USD merchandise + USD shipping total is converted once into the ETB charge amount.

---

# Earnings

Seller earnings remain separated by payout provider.

Example:

```text
PayPal Balance (USD)

Chapa Balance (ETB)
```

Each provider maintains its own balance.

The marketplace never converts between balances.

---

# Withdrawals

Each balance is withdrawn using its associated provider.

Examples:

- PayPal balance → PayPal withdrawal
- Chapa balance → Chapa withdrawal

Balances remain independent.

---

# Refunds

Refunds always use the original payment provider.

Examples:

- PayPal payment → PayPal refund
- Chapa payment → Chapa refund

Cross-provider refunds are never performed.

Refund amount and refund currency always match:

- original `checkout_currency`
- original `fx_rate_locked`

---

# Internal Reporting Currency

Marketplace reporting sometimes requires aggregate values across providers.

This is handled by a **read-only reporting layer**.

It:

- never changes balances
- never participates in withdrawals
- never participates in refunds
- never participates in checkout

It:

- is clearly marked as reporting-only
- uses periodically updated reference exchange rates

This layer must never be reachable from any money-movement code.

---

# Separation of Responsibilities

## Payout Account Setup

Responsible for:

- validating seller payout eligibility
- creating payout capability records
- enforcing the no-disconnect-with-balance rule

---

## Buyer Payment Capability

Responsible for:

- determining which payment providers the buyer can use

Checkout does not know how these capabilities were produced.

---

## Checkout

Responsible for:

- resolving available payment methods
- handling the "no compatible payment method" state
- requesting payment from the selected provider
- recording provider-reported currencies and exchange rates

Checkout never computes exchange rates.

---

## Shipping

Responsible only for logistics.

Shipping never depends on payment provider.

---

## Reporting

Responsible for:

- read-only currency conversion
- aggregate reporting

Reporting is isolated from every money-movement workflow.

---

# Design Goal

The marketplace models **capabilities and providers**, not countries.

Instead of rules like:

```text
If seller is Ethiopian...
If buyer is American...
```

the marketplace operates entirely on validated provider-scoped capabilities.

Adding future providers (such as Stripe Connect or regional gateways) only requires adding new buyer payment capabilities and seller payout capabilities.

The checkout resolution algorithm, currency invariants, earnings model, withdrawals, and refunds remain unchanged.