-- Optional: link existing in-progress disputes to their orders via delivery_confirmations
UPDATE "Dispute" d
SET "orderId" = dc."orderId"
FROM delivery_confirmations dc
WHERE d."orderId" IS NULL
  AND dc."hasDispute" = true
  AND dc."buyerId" = d."raisedById"
  AND d."status" = 'IN_PROGRESS';
