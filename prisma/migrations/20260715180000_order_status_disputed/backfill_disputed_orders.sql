-- Backfill orders that already have a dispute confirmation but are still PAID.
UPDATE "Order" o
SET status = 'DISPUTED'
FROM delivery_confirmations dc
WHERE dc."orderId" = o.id
  AND dc."hasDispute" = true
  AND o.status = 'PAID';
