/**
 * One-time backfill: currency + chargedAmount on transaction.metadata.
 *
 * Provider→currency mapping is ALLOWED ONLY in this migration for historical rows.
 * New payments must persist currency explicitly at order create / payment init.
 *
 * Usage:
 *   pnpm exec dotenv -e env/local.env -- pnpm exec ts-node scripts/backfill-transaction-currency.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function inferLegacyCurrency(meta: any, providerHint?: string): "USD" | "ETB" {
  const existing = String(meta?.currency || "")
    .trim()
    .toUpperCase();
  if (existing === "USD" || existing === "ETB") return existing as any;

  const p = String(
    providerHint ||
      meta?.paymentProvider ||
      meta?.paymentMethod ||
      meta?.provider ||
      "",
  ).toLowerCase();
  if (p.includes("chapa")) return "ETB";
  return "USD";
}

async function main() {
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      amount: true,
      metadata: true,
      order: { select: { totalAmount: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const meta = (tx.metadata as any) || {};
    const hasCurrency =
      String(meta.currency || "")
        .trim()
        .toUpperCase() === "USD" ||
      String(meta.currency || "")
        .trim()
        .toUpperCase() === "ETB";
    const hasCharged =
      meta.chargedAmount != null && Number(meta.chargedAmount) > 0;

    if (hasCurrency && hasCharged) {
      skipped++;
      continue;
    }

    const currency = inferLegacyCurrency(meta);
    const chargedAmount = Number(
      meta.chargedAmount ?? tx.amount ?? tx.order?.totalAmount ?? 0,
    );
    const paymentProvider = String(
      meta.paymentProvider ||
        meta.paymentMethod ||
        (currency === "ETB" ? "chapa" : "paypal"),
    ).toLowerCase();

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        metadata: {
          ...meta,
          currency,
          chargedAmount,
          paymentProvider:
            paymentProvider.includes("chapa") ? "chapa" : "paypal",
          currencyBackfilledAt: new Date().toISOString(),
        },
      },
    });
    updated++;
  }

  console.log(
    `Backfill complete. updated=${updated} skipped=${skipped} total=${transactions.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
