# Chapa Payment Integration Testing Plan

## Overview
This document outlines the testing strategy for verifying that Chapa payment integration is working correctly and accurately in the art gallery application.

## Payment Flow Architecture

### 1. Frontend Flow (Checkout → Payment)
```
User fills checkout form
  ↓
Create Order (POST /api/order)
  ↓
Get txRef: TX-{orderId}-{timestamp}
  ↓
Initialize Payment (POST /api/payment/initialize)
  ↓
Redirect to Chapa checkout URL
  ↓
User completes payment on Chapa
  ↓
Chapa redirects to: /payment/success?txRef=...
  ↓
[VERIFICATION NEEDED] - Currently missing!
```

### 2. Backend Flow
```
Order Creation:
  - Creates order with status: PENDING
  - Creates transaction with status: INITIATED
  - Returns txRef: TX-{orderId}-{timestamp}

Payment Initialization:
  - Calls Chapa API: POST /v1/transaction/initialize
  - Returns checkout_url
  - Sets callback_url: /api/payment/chapa/callback

Payment Verification:
  - Calls Chapa API: GET /v1/transaction/verify/{txRef}
  - Updates order status: PENDING → PAID
  - Updates transaction status: INITIATED → COMPLETED
  - Marks artworks as SOLD

Chapa Callbacks:
  - GET /api/payment/chapa/callback?trx_ref=...&status=...
  - POST /api/payment/chapa/webhook (if configured)
```

## Critical Issues Found

### ⚠️ Missing Payment Verification
**Issue**: The `PaymentSuccess.tsx` page does NOT verify the payment after redirect from Chapa.

**Impact**: 
- Orders remain in PENDING status even after successful payment
- Artworks are not marked as SOLD
- Transaction status stays INITIATED

**Location**: `art-gallery/src/pages/PaymentSuccess.tsx`

**Fix Required**: Add payment verification on page load using `useVerifyPayment` hook.

## Testing Checklist

### Pre-Testing Setup

#### 1. Environment Configuration
- [ ] Verify `CHAPA_SECRET_KEY` is set in backend `.env`
- [ ] Verify `SERVER_BASE_URL` is correct (for callback URLs)
- [ ] Verify `FRONTEND_URL` is correct (for return URLs)
- [ ] Check Chapa dashboard for webhook configuration (if using webhooks)

#### 2. Test Account Setup
- [ ] Create test user account in application
- [ ] Add test artworks to cart
- [ ] Ensure test artworks are in APPROVED status
- [ ] Note: Chapa test mode uses test credentials

### Test Scenarios

#### ✅ Test 1: Successful Payment Flow

**Steps**:
1. Navigate to checkout page
2. Fill shipping information
3. Select "Chapa" as payment method
4. Enter phone number (if required)
5. Click "Place Order"
6. Complete payment on Chapa checkout page
7. Verify redirect to `/payment/success`

**Expected Results**:
- [ ] Order is created with status: PENDING
- [ ] Transaction is created with status: INITIATED
- [ ] txRef format: `TX-{orderId}-{timestamp}`
- [ ] Redirect to Chapa checkout URL works
- [ ] After payment, redirect to `/payment/success?txRef=...`
- [ ] **Payment is verified automatically** (NEEDS IMPLEMENTATION)
- [ ] Order status updates to: PAID
- [ ] Transaction status updates to: COMPLETED
- [ ] Artworks are marked as: SOLD
- [ ] Cart is cleared (if implemented)

**Database Checks**:
```sql
-- Check order status
SELECT id, status, totalAmount FROM "Order" WHERE id = '{orderId}';

-- Check transaction status
SELECT id, status, amount, metadata FROM "Transaction" WHERE orderId = '{orderId}';

-- Check artwork status
SELECT id, status FROM "Artwork" WHERE id IN (SELECT "artworkId" FROM "OrderItem" WHERE orderId = '{orderId}');
```

#### ❌ Test 2: Payment Cancellation

**Steps**:
1. Start checkout process
2. Select Chapa payment
3. On Chapa checkout page, click "Cancel" or close window
4. Return to application

**Expected Results**:
- [ ] Order remains in PENDING status
- [ ] Transaction remains in INITIATED status
- [ ] Artworks remain in APPROVED status
- [ ] User can retry payment
- [ ] Error message displayed (if applicable)

#### ⚠️ Test 3: Payment Failure

**Steps**:
1. Start checkout process
2. Select Chapa payment
3. On Chapa checkout, use invalid payment method or insufficient funds
4. Payment fails

**Expected Results**:
- [ ] Order remains in PENDING status
- [ ] Transaction status may be FAILED (check Chapa response)
- [ ] Error message displayed to user
- [ ] User can retry payment

#### 🔄 Test 4: Payment Verification (Manual)

**Steps**:
1. Complete a successful payment
2. Note the txRef from success page
3. Manually call verification endpoint

**API Call**:
```bash
POST /api/payment/verify
{
  "provider": "chapa",
  "txRef": "TX-{orderId}-{timestamp}"
}
```

**Expected Results**:
- [ ] Returns success: true
- [ ] Order status updates to PAID
- [ ] Transaction status updates to COMPLETED
- [ ] Artworks marked as SOLD

#### 📞 Test 5: Chapa Callback Endpoint

**Steps**:
1. Complete a payment
2. Check if Chapa calls the callback URL

**Callback URL**: `GET /api/payment/chapa/callback?trx_ref=...&status=...`

**Expected Results**:
- [ ] Callback is received (check backend logs)
- [ ] Callback parameters are logged
- [ ] Order is updated based on status

**Note**: Current implementation only logs the callback. May need to add verification logic.

#### 🔔 Test 6: Chapa Webhook (If Configured)

**Steps**:
1. Configure webhook in Chapa dashboard
2. Complete a payment
3. Check webhook endpoint

**Webhook URL**: `POST /api/payment/chapa/webhook`

**Expected Results**:
- [ ] Webhook is received (check backend logs)
- [ ] Webhook payload is processed
- [ ] Order status is updated

**Note**: Current webhook handler is minimal. May need enhancement.

### Edge Cases

#### Test 7: Duplicate Payment Attempts
- [ ] User tries to pay for same order twice
- [ ] Verify only one payment is processed
- [ ] Check for duplicate transaction prevention

#### Test 8: Expired Payment Session
- [ ] Start payment but don't complete within timeout
- [ ] Verify order remains in PENDING
- [ ] Verify user can retry

#### Test 9: Amount Mismatch
- [ ] Verify payment amount matches order total
- [ ] Test with different amounts
- [ ] Verify rejection if amounts don't match

#### Test 10: Currency Validation
- [ ] Verify Chapa payments use ETB currency
- [ ] Test currency conversion (if applicable)
- [ ] Verify currency in transaction records

## Verification Points

### 1. API Integration
- [ ] Chapa API base URL: `https://api.chapa.co/v1`
- [ ] Authorization header: `Bearer {CHAPA_SECRET_KEY}`
- [ ] Initialize endpoint: `POST /transaction/initialize`
- [ ] Verify endpoint: `GET /transaction/verify/{txRef}`

### 2. Data Flow
- [ ] txRef format: `TX-{orderId}-{timestamp}`
- [ ] Order ID extraction from txRef works correctly
- [ ] Amount passed to Chapa matches order total
- [ ] Currency is ETB for Chapa payments

### 3. Callback URLs
- [ ] Callback URL: `{SERVER_BASE_URL}/api/payment/chapa/callback`
- [ ] Return URL: `{FRONTEND_URL}/payment/success`
- [ ] URLs are accessible and correct

### 4. Error Handling
- [ ] Network errors are handled gracefully
- [ ] Invalid responses from Chapa are handled
- [ ] User-friendly error messages displayed
- [ ] Errors are logged for debugging

## Logging & Monitoring

### Backend Logs to Check
```typescript
// Order creation
"Creating order for user: {userId}"
"Order created: {orderId}"

// Payment initialization
"Initializing Chapa payment: {txRef}"
"Chapa payment initialization failed: {error}"

// Payment verification
"Verifying Chapa payment: {txRef}"
"Chapa payment verification failed: {error}"
"Order {orderId} completed and artworks marked as SOLD"

// Callbacks
"Chapa callback: {trxRef} - {status}"
"Chapa webhook received"
```

### Frontend Console Logs
- Check browser console for:
  - Payment initialization errors
  - Redirect issues
  - Verification errors

## Database Verification Queries

### Check Order Status
```sql
SELECT 
  o.id,
  o.status,
  o.totalAmount,
  o."buyerEmail",
  o."createdAt",
  t.status as transaction_status,
  t.amount as transaction_amount,
  t.metadata
FROM "Order" o
LEFT JOIN "Transaction" t ON t."orderId" = o.id
WHERE o.id = '{orderId}'
ORDER BY o."createdAt" DESC;
```

### Check Artwork Status After Payment
```sql
SELECT 
  a.id,
  a.title,
  a.status,
  oi.quantity,
  oi.price
FROM "Artwork" a
JOIN "OrderItem" oi ON oi."artworkId" = a.id
JOIN "Order" o ON o.id = oi."orderId"
WHERE o.id = '{orderId}';
```

### Check Transaction History
```sql
SELECT 
  t.id,
  t.status,
  t.amount,
  t."createdAt",
  t.metadata->>'txRef' as tx_ref,
  t.metadata->>'paymentProvider' as provider
FROM "Transaction" t
WHERE t."orderId" = '{orderId}'
ORDER BY t."createdAt" DESC;
```

## Required Fixes

### 1. Add Payment Verification to PaymentSuccess Page

**File**: `art-gallery/src/pages/PaymentSuccess.tsx`

**Implementation**:
```typescript
import { useVerifyPayment } from "@/services/payment/useVerifyPayment";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const txRef = searchParams.get("txRef");
  const orderId = searchParams.get("orderId");
  const { mutate: verifyPayment, isPending } = useVerifyPayment();
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  useEffect(() => {
    if (txRef) {
      verifyPayment(
        { provider: 'chapa', txRef },
        {
          onSuccess: (data) => {
            if (data.success && data.data.status === 'success') {
              setVerificationStatus('success');
            } else {
              setVerificationStatus('failed');
            }
          },
          onError: () => {
            setVerificationStatus('failed');
          }
        }
      );
    }
  }, [txRef, verifyPayment]);

  // ... rest of component
}
```

### 2. Enhance Chapa Callback Handler

**File**: `art-store-backend/src/apps/payment/payment.controller.ts`

**Current**: Only logs callback
**Enhancement**: Should trigger payment verification

### 3. Improve Webhook Handler

**File**: `art-store-backend/src/apps/payment/chapa.service.ts`

**Current**: Minimal implementation
**Enhancement**: Should verify payment and update order status

## Testing Tools

### 1. Chapa Test Credentials
- Use Chapa test/sandbox environment
- Test secret key from Chapa dashboard
- Test phone numbers for mobile money

### 2. API Testing
- Postman collection for payment endpoints
- Test with different scenarios
- Monitor network requests in browser DevTools

### 3. Database Tools
- Use Prisma Studio or database client
- Run verification queries
- Check transaction logs

## Success Criteria

✅ Payment flow is considered working correctly when:
1. Orders are created successfully
2. Payment initialization returns valid Chapa checkout URL
3. Users can complete payment on Chapa
4. Payment is automatically verified after redirect
5. Order status updates to PAID
6. Transaction status updates to COMPLETED
7. Artworks are marked as SOLD
8. All amounts and currencies are correct
9. Error cases are handled gracefully
10. Logs provide sufficient debugging information

## Next Steps

1. **Implement payment verification** in PaymentSuccess page
2. **Test complete flow** with Chapa test environment
3. **Verify database updates** after each test
4. **Check error handling** for all failure scenarios
5. **Monitor logs** for any issues
6. **Document any issues** found during testing
7. **Fix identified bugs** before production deployment

