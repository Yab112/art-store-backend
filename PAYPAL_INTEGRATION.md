# PayPal Integration - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Payment Flow](#payment-flow)
4. [Payout Flow](#payout-flow)
5. [Configuration](#configuration)
6. [Implementation Details](#implementation-details)
7. [Webhook Handling](#webhook-handling)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Production Checklist](#production-checklist)

---

## Overview

This document provides comprehensive documentation for the PayPal integration in the Art Gallery platform. The integration handles:

- **Customer Payments**: Customers pay for artworks via PayPal
- **Artist Payouts**: Platform sends payouts to artists for their earnings
- **Webhook Processing**: Automatic status updates via PayPal webhooks
- **Order Management**: Automatic order completion and cancellation

### Key Concepts

- **Platform Account**: The PayPal business account that receives all customer payments
- **Commission**: Platform automatically deducts commission (e.g., 20%) from artist earnings
- **Available Balance**: Artist's earnings minus commission and already withdrawn amounts
- **Withdrawal Request**: Artist requests withdrawal of their available balance

---

## Architecture

### Money Flow

```
Customer's PayPal Account
    ↓ (Payment)
PLATFORM's PayPal Business Account
    ↓ (Platform keeps commission)
Artist's Available Balance (tracked in database)
    ↓ (When artist requests withdrawal)
PLATFORM's PayPal Business Account
    ↓ (Payout)
Artist's PayPal Account
```

### Important Points

1. **All customer payments go to PLATFORM's account first**
2. **Platform keeps commission automatically** (calculated in `getEarningsStats`)
3. **Artist's earnings are tracked in the database** (not in PayPal)
4. **When artist withdraws, platform sends money from platform's account to artist**

---

## Payment Flow

### Step-by-Step Process

1. **Customer Purchases Artwork**
   - Customer adds artwork to cart and proceeds to checkout
   - Customer pays via PayPal (using platform's PayPal account)
   - Money goes to: **PLATFORM's PayPal business account**

2. **Payment Initialization**
   - Frontend calls `POST /api/payment/initialize`
   - Backend creates PayPal order via `PaypalService.initializePayment()`
   - Returns checkout URL to frontend
   - User redirected to PayPal for payment

3. **Payment Capture**
   - After user approves payment, PayPal redirects back
   - Frontend calls `POST /api/payment/verify` with PayPal order ID
   - Backend verifies and captures payment via `PaypalService.verifyPayment()`
   - **Critical**: Only `COMPLETED` status is treated as success (not `APPROVED`)

4. **Order Completion**
   - If payment successful:
     - Order status changes to `PAID`
     - Artwork status changes to `SOLD`
     - Transaction record created with `COMPLETED` status
     - Purchased items removed from cart
   - If payment fails:
     - Order automatically cancelled (status: `CANCELLED`)
     - Transaction marked as `FAILED`
     - Cancellation reason stored in metadata

### Payment Status Flow

```
PENDING → PAID (if payment succeeds)
PENDING → CANCELLED (if payment fails)
```

**Transaction Status Flow:**
```
INITIATED → COMPLETED (if payment succeeds)
INITIATED → FAILED (if payment fails)
```

### Code Implementation

**Key Files:**
- `paypal.service.ts` - PayPal API integration
- `payment.service.ts` - Payment orchestration and order management
- `payment.controller.ts` - API endpoints

**Key Methods:**
- `PaypalService.initializePayment()` - Creates PayPal order
- `PaypalService.verifyPayment()` - Verifies and captures payment
- `PaymentService.verifyPayment()` - Handles order completion/cancellation

---

## Payout Flow

### Step-by-Step Process

1. **Artist Requests Withdrawal**
   - Artist goes to Settings → Withdrawals
   - Artist enters withdrawal amount (must be ≤ Available Balance)
   - Artist provides PayPal email or IBAN for receiving payout
   - Withdrawal request created with status `INITIATED`

2. **Admin Approves Withdrawal**
   - Admin reviews withdrawal request in admin dashboard
   - Admin clicks "Approve" → Status changes to `PROCESSING`
   - Backend calls `PaypalService.processPayout()`
   - **Platform sends payout FROM platform's PayPal account TO artist's PayPal email**

3. **Payout Processing**
   - PayPal processes the payout
   - Payout batch ID stored in withdrawal record
   - Status remains `PROCESSING` until webhook received

4. **Webhook Updates Status**
   - PayPal sends webhook when payout completes
   - Webhook handler updates withdrawal status automatically
   - Status changes to `COMPLETED` or `FAILED` based on PayPal response

### Withdrawal Status Flow

```
INITIATED → PROCESSING → COMPLETED (success)
INITIATED → PROCESSING → FAILED (failure)
```

### Code Implementation

**Key Methods:**
- `PaypalService.processPayout()` - Sends payout to artist
- `PaypalService.getPayoutStatus()` - Checks payout status
- `PaymentService.handlePayoutItemWebhook()` - Updates withdrawal status via webhook

---

## Configuration

### Environment Variables

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your-platform-business-account-client-id
PAYPAL_CLIENT_SECRET=your-platform-business-account-secret
PAYPAL_MODE=sandbox  # or 'live' for production
PAYPAL_WEBHOOK_ID=your-webhook-id  # Optional for sandbox, required for production
```

### Important Configuration Notes

1. **PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET MUST be for the PLATFORM's PayPal business account**, NOT the artist's account
2. **If you use an artist's credentials** → Money goes to that artist (wrong!)
3. **If you use platform's credentials** → Money goes to platform (correct!)
4. Platform then distributes to artists via payouts

### Getting PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Click **Apps & Credentials** (left sidebar)
3. Create a new app or use existing app
4. **Important**: Select the platform's business account as the "Merchant"
5. Copy **Client ID** and **Secret**
6. Add to `.env` file

---

## Implementation Details

### Payment Verification Logic

The payment verification process is critical for ensuring funds are actually received:

```typescript
// In PaypalService.verifyPayment()
if (status === 'APPROVED') {
  // Capture the payment
  const captureResponse = await capturePayment(orderId);
  
  // CRITICAL: Only treat COMPLETED as success
  if (captureStatus === 'COMPLETED' && captureDetails?.status === 'COMPLETED') {
    status = 'COMPLETED';
  } else {
    // Capture failed - throw error
    throw new BadRequestException('Payment capture failed');
  }
}

// Only COMPLETED status means payment succeeded
const isSuccess = status === 'COMPLETED';
```

**Key Points:**
- `APPROVED` means payment is authorized but **not yet captured**
- `COMPLETED` means payment is **captured and funds received**
- Only `COMPLETED` should be treated as success
- Failed captures automatically cancel orders

### Order Cancellation

When payment fails, orders are automatically cancelled:

```typescript
// In PaymentService.verifyPayment()
if (!verifyResponse.success || verifyResponse.data.status !== 'success') {
  // Extract orderId from txRef
  // Cancel the order
  await this.orderService.cancelOrder(orderId, reason);
}
```

**Cancellation Process:**
1. Order status updated to `CANCELLED`
2. Transaction status updated to `FAILED`
3. Cancellation reason stored in transaction metadata
4. Prevents double-cancellation (checks if already cancelled/paid)

### Earnings Calculation

Artist earnings are calculated in `artist.service.ts` → `getEarningsStats()`:

```typescript
// For each sale:
const commission = salePrice * commissionRate; // e.g., 20%
const artistEarnings = salePrice - commission;

// Available Balance = Total Earnings - Commission - Already Withdrawn
const availableBalance = totalEarnings - totalCommission - totalWithdrawn;
```

---

## Webhook Handling

### Webhook Endpoint

**URL:** `POST /api/payment/paypal/webhook`

### Supported Webhook Events

**Payout Batch Events:**
- `PAYMENT.PAYOUTSBATCH.SUCCESS` - Batch completed successfully
- `PAYMENT.PAYOUTSBATCH.DENIED` - Batch denied/failed
- `PAYMENT.PAYOUTSBATCH.PENDING` - Batch pending

**Payout Item Events:**
- `PAYMENT.PAYOUTSITEM.SUCCESS` - Individual payout succeeded
- `PAYMENT.PAYOUTSITEM.DENIED` - Individual payout failed
- `PAYMENT.PAYOUTSITEM.PENDING` - Payout pending
- `PAYMENT.PAYOUTSITEM.UNCLAIMED` - Payout sent but not claimed
- `PAYMENT.PAYOUTSITEM.RETURNED` - Payout returned
- `PAYMENT.PAYOUTSITEM.REFUNDED` - Payout refunded

### Webhook Processing Flow

1. **Webhook Received**
   - PayPal sends webhook to `/api/payment/paypal/webhook`
   - Signature verification (optional in sandbox, required in production)

2. **Event Routing**
   - `PAYOUT_BATCH` events → `handlePayoutBatchWebhook()`
   - `PAYOUT_ITEM` events → `handlePayoutItemWebhook()`

3. **Status Update**
   - Find withdrawal by `payoutBatchId`
   - Update withdrawal status based on PayPal status
   - Store transaction details in metadata

### Status Mapping

**Payout Batch Status:**
- `SUCCESS` / `COMPLETED` → `COMPLETED`
- `DENIED` / `FAILED` → `FAILED`
- `PENDING` → `PROCESSING`

**Payout Item Status:**
- `SUCCESS` → `COMPLETED`
- `UNCLAIMED` → `COMPLETED` (payout sent, recipient needs to claim)
- `FAILED` / `DENIED` / `BLOCKED` → `FAILED`
- `RETURNED` / `REFUNDED` → `REFUNDED`
- `PENDING` / `ONHOLD` → `PROCESSING`

### Webhook Setup

**For Local Testing (Sandbox):**

1. Install ngrok: `ngrok http 3000`
2. Copy HTTPS URL (e.g., `https://abc123.ngrok.io`)
3. Go to PayPal Developer Dashboard → Sandbox → Webhooks
4. Add webhook URL: `https://abc123.ngrok.io/api/payment/paypal/webhook`
5. Select payout events (see list above)
6. Copy Webhook ID and add to `.env`: `PAYPAL_WEBHOOK_ID=WH-...`

**For Production:**

1. Use production domain: `https://your-domain.com/api/payment/paypal/webhook`
2. Configure in PayPal Live dashboard (not Sandbox)
3. Set `PAYPAL_MODE=live` in production `.env`
4. Ensure `PAYPAL_WEBHOOK_ID` is set for signature verification

---

## Error Handling

### Payment Errors

**Capture Failure:**
- Payment capture fails (e.g., insufficient funds)
- Order automatically cancelled
- Transaction marked as `FAILED`
- Error message returned to frontend

**Verification Failure:**
- Payment verification returns failure
- Order automatically cancelled
- Cancellation reason stored

**Network/API Errors:**
- PayPal API errors are caught and logged
- User-friendly error messages returned
- Orders cancelled if payment cannot be verified

### Payout Errors

**Insufficient Funds:**
- Platform account doesn't have enough balance
- Payout fails with error message
- Withdrawal status remains `PROCESSING` or changes to `FAILED`

**Invalid Email:**
- Email format validation before payout
- Error returned immediately

**Payout API Errors:**
- PayPal API errors caught and logged
- Error message stored in withdrawal metadata
- Status updated appropriately

### Webhook Errors

**Signature Verification Failure:**
- In sandbox: Allowed (webhook proceeds)
- In production: Should reject (currently allows for safety)

**Missing Withdrawal:**
- Webhook received but withdrawal not found
- Logged as warning (may be normal for other systems)

**Processing Errors:**
- Errors caught and logged
- Webhook always returns 200 OK to PayPal
- Prevents PayPal from retrying unnecessarily

---

## Testing

### PayPal Sandbox

PayPal Sandbox is a **complete simulation environment** that behaves exactly like production, but with **fake money**.

**What Works in Sandbox:**
- ✅ Business accounts **DO receive payments** from personal accounts
- ✅ Payments are captured and processed
- ✅ Payouts work (platform → artist)
- ✅ Webhooks are sent and received
- ✅ API calls behave exactly like production
- ✅ Transaction statuses are accurate
- ✅ Commission calculations work

**What's Different:**
- ⚠️ Money is **fake** (simulation only)
- ⚠️ No real money moves
- ⚠️ Balance display may not update in UI (this is normal!)

### Testing Payment Flow

1. **Create Test Accounts**
   - Platform Business Account (receives payments)
   - Buyer Personal Account (makes purchases)

2. **Test Successful Payment**
   - Add test funds to buyer account
   - Make a test purchase
   - Verify:
     - Order status = `PAID`
     - Transaction status = `COMPLETED`
     - Artwork status = `SOLD`

3. **Test Failed Payment**
   - Use buyer account with $0 balance
   - Attempt payment
   - Verify:
     - Order status = `CANCELLED`
     - Transaction status = `FAILED`
     - Error message displayed

### Testing Payout Flow

1. **Create Test Accounts**
   - Platform Business Account (sends payouts)
   - Artist Personal Account (receives payouts)
   - Add test funds to platform account

2. **Test Successful Payout**
   - Artist requests withdrawal
   - Admin approves
   - Verify:
     - Withdrawal status = `PROCESSING` → `COMPLETED`
     - Payout batch ID stored
     - Webhook received and processed

3. **Test Failed Payout**
   - Use platform account with insufficient funds
   - Attempt payout
   - Verify:
     - Error message returned
     - Withdrawal status = `FAILED`

### Testing Webhooks

**Using PayPal Sandbox Simulator:**
1. Go to PayPal Developer Dashboard → Sandbox → Webhooks
2. Select your webhook
3. Click **Send Test Event**
4. Choose event type (e.g., `PAYMENT.PAYOUTSITEM.SUCCESS`)
5. Check backend logs for processing

**Using ngrok:**
1. Start backend: `npm run start:dev`
2. Start ngrok: `ngrok http 3000`
3. Configure webhook URL in PayPal dashboard
4. Process a real payout to trigger webhook

---

## Troubleshooting

### Payment Issues

**Issue: "Payment successful but order not completed"**

**Solution:**
- Check backend logs for capture errors
- Verify `verifyPayment` is being called
- Check if order status is actually `COMPLETED` (not `APPROVED`)
- Verify payment was actually captured (not just authorized)

**Issue: "Orders stuck in PENDING"**

**Solution:**
- Check if payment verification is being called
- Verify error handling is working
- Check logs for cancellation errors
- Manually cancel stuck orders if needed

**Issue: "Platform account shows $0 after payment"**

**Solution:**
- Verify you're checking the correct account (associated with CLIENT_ID)
- Check backend logs for "PayPal order captured successfully"
- Check Event Logs in PayPal Developer Dashboard
- Check transaction status via API
- **Note**: Sandbox balance display is unreliable - check transaction data instead

### Payout Issues

**Issue: "Sender does not have sufficient funds"**

**Solution:**
- **In Sandbox:** Add test funds to platform's PayPal business account
  - Go to PayPal Developer Dashboard → Sandbox → Accounts
  - Find business account → Add test funds
- **In Production:** Transfer real money to business account

**Issue: "Payout not updating via webhook"**

**Solution:**
- Check `payoutBatchId` is stored when payout is processed
- Verify webhook payload contains correct `payout_batch_id`
- Check logs for webhook processing errors
- Ensure withdrawal exists with matching `payoutBatchId`
- Verify webhook events are selected in PayPal dashboard

**Issue: "Webhook not received"**

**Solution:**
- Ensure ngrok is running (for local testing)
- Check ngrok URL matches webhook URL in PayPal
- Verify webhook events are selected
- Check backend logs for incoming requests
- Test webhook endpoint manually with cURL

### Configuration Issues

**Issue: "PayPal credentials not configured"**

**Solution:**
- Check `.env` file has `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
- Restart backend server after adding credentials
- Verify credentials in PayPal Developer Dashboard

**Issue: "Payments going to wrong account"**

**Solution:**
- Verify `PAYPAL_CLIENT_ID` points to platform account (not artist account)
- Check PayPal Developer Dashboard → Apps & Credentials
- Verify app's "Merchant" account is the platform account
- Update `.env` with correct credentials

---

## Production Checklist

Before going live:

- [ ] Switch `PAYPAL_MODE=live` in production
- [ ] Get **Live** credentials from PayPal (not Sandbox)
- [ ] Update webhook URL to production domain
- [ ] Configure webhook in **Live** environment (not Sandbox)
- [ ] Set `PAYPAL_WEBHOOK_ID` for signature verification
- [ ] Test with small amounts first
- [ ] Monitor webhook logs
- [ ] Set up webhook retry handling (PayPal automatically retries)
- [ ] Add email notifications for failed payments/payouts
- [ ] Verify platform account has sufficient balance for payouts
- [ ] Test complete payment flow in production
- [ ] Test complete payout flow in production
- [ ] Monitor transaction logs
- [ ] Set up alerts for payment/payout failures

---

## Database Schema

### Withdrawal Table

```prisma
model Withdrawal {
  id            String         @id @default(uuid())
  userId        String?
  payoutAccount String
  amount        Decimal        @db.Decimal(10,2)
  status        PaymentStatus  @default(INITIATED)
  payoutBatchId String?        // PayPal payout batch ID for webhook matching
  metadata      Json?          // Additional payout transaction details
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

**Key Fields:**
- `payoutBatchId`: Used to match webhooks to withdrawals
- `metadata`: Stores PayPal transaction details, webhook data, rejection reasons

### Transaction Table

```prisma
model Transaction {
  id        String         @id @default(uuid())
  orderId   String
  amount    Decimal
  status    PaymentStatus
  metadata  Json?          // Payment provider details, customer info
  createdAt DateTime       @default(now())
}
```

**Key Fields:**
- `metadata`: Stores PayPal order ID, customer info, cancellation reasons

---

## API Endpoints

### Payment Endpoints

**Initialize Payment**
```
POST /api/payment/initialize
Body: { provider, amount, currency, txRef, orderId, returnUrl, callbackUrl }
Response: { success, data: { checkoutUrl, txRef, provider } }
```

**Verify Payment**
```
POST /api/payment/verify
Body: { provider, txRef }
Response: { success, data: { status, amount, currency, txRef, provider } }
```

**PayPal Webhook**
```
POST /api/payment/paypal/webhook
Body: PayPal webhook payload
Response: { success, eventType, ... }
```

### Withdrawal Endpoints (Artist)

**Get Withdrawals**
```
GET /api/artist/withdrawals?page=1&limit=20
Response: { success, data: [...], pagination: { page, limit, total, pages } }
```

**Request Withdrawal**
```
POST /api/artist/withdrawal/request
Body: { amount, iban }
Response: { success, message, data: { withdrawal } }
```

### Withdrawal Endpoints (Admin)

**Get All Withdrawals**
```
GET /api/withdrawals?page=1&limit=20&status=PROCESSING
Response: { withdrawals: [...], pagination: { page, limit, total, pages } }
```

**Update Withdrawal Status**
```
PATCH /api/withdrawals/:id/status
Body: { status, rejectionReason? }
Response: { success, withdrawal }
```

---

## Code Structure

### Service Files

**`paypal.service.ts`**
- `getAccessToken()` - Gets PayPal OAuth token
- `initializePayment()` - Creates PayPal order
- `capturePayment()` - Captures authorized payment
- `verifyPayment()` - Verifies and captures payment
- `processPayout()` - Sends payout to artist
- `getPayoutStatus()` - Checks payout status
- `verifyWebhookSignature()` - Verifies webhook authenticity
- `handleWebhook()` - Processes webhook events

**`payment.service.ts`**
- `initializePayment()` - Routes to provider service
- `verifyPayment()` - Handles payment verification and order completion
- `handlePaypalWebhook()` - Routes webhook to handlers
- `handlePayoutBatchWebhook()` - Updates withdrawal from batch webhook
- `handlePayoutItemWebhook()` - Updates withdrawal from item webhook

**`payment.controller.ts`**
- `initializePayment()` - API endpoint
- `verifyPayment()` - API endpoint
- `paypalWebhook()` - Webhook endpoint

---

## Best Practices

1. **Always verify payment capture succeeded** - Don't treat `APPROVED` as success
2. **Cancel orders on payment failure** - Prevent orphaned PENDING orders
3. **Store payout batch ID** - Required for webhook matching
4. **Handle webhook errors gracefully** - Always return 200 OK to PayPal
5. **Log important events** - But avoid excessive debug logs in production
6. **Validate email format** - Before processing payouts
7. **Check platform account balance** - Before processing payouts
8. **Use idempotent operations** - Safe to retry webhooks
9. **Monitor webhook logs** - Catch issues early
10. **Test in sandbox first** - Before deploying to production

---

## Related Files

### Backend Files
- `src/apps/payment/paypal.service.ts` - PayPal API integration
- `src/apps/payment/payment.service.ts` - Payment orchestration
- `src/apps/payment/payment.controller.ts` - API endpoints
- `src/apps/order/order.service.ts` - Order management
- `src/apps/artist/artist.service.ts` - Earnings calculation
- `src/apps/withdrawals/withdrawals.service.ts` - Withdrawal management

### Documentation Files (Consolidated)
- This file replaces:
  - `PAYMENT_FLOW_EXPLANATION.md`
  - `PAYPAL_SANDBOX_GUIDE.md`
  - `PAYPAL_CAPTURE_BUG_FIX.md`
  - `PAYPAL_ACCOUNT_VERIFICATION.md`
  - `PAYPAL_PAYOUT_SETUP_GUIDE.md`
  - `PAYPAL_WEBHOOK_TESTING.md`
  - `ORDER_PAYMENT_FAILURE_FIX.md`

---

## Summary

The PayPal integration provides:

✅ **Complete payment processing** - Customers pay via PayPal  
✅ **Automatic order management** - Orders completed/cancelled automatically  
✅ **Artist payout system** - Platform sends payouts to artists  
✅ **Webhook automation** - Automatic status updates via webhooks  
✅ **Error handling** - Comprehensive error handling and recovery  
✅ **Sandbox testing** - Full testing environment before production  

**Key Success Factors:**
1. Correct PayPal credentials (platform account)
2. Proper webhook configuration
3. Sufficient platform account balance for payouts
4. Monitoring and logging

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0

