/**
 * S3 CORS Configuration Script
 *
 * Sets permanent CORS rules on the S3 bucket to allow direct browser uploads.
 * Run once during deployment or when production origins change:
 *   node set-s3-cors.mjs
 *   node set-s3-cors.mjs --env=production
 *
 * The CORS rules are stored permanently in AWS and persist until changed.
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const isProd = args.includes("--env=production");

// ----- Load env -----
function loadEnv(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = val; // don't override existing env vars
  }
}

// Load local env file (ignored in production where real env vars are injected)
loadEnv(resolve(__dirname, "env/local.env"));

// ----- Configuration -----
const region = process.env.AWS_REGION || "eu-north-1";
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!bucketName || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing required env vars: AWS_S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  process.exit(1);
}

// Production origins - only real domains, no localhost
const PRODUCTION_ORIGINS = [
  "https://art-store-frontend-flame.vercel.app",
  "https://www.arthopia.com.et",
  "https://arthopia.com.et",
];

// Development origins - add localhost for local testing
const DEV_ORIGINS = [
  ...PRODUCTION_ORIGINS,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
];

const allowedOrigins = isProd ? PRODUCTION_ORIGINS : DEV_ORIGINS;

const corsConfig = {
  CORSRules: [
    {
      // Allow all headers S3 presigned PUT needs (Content-Type is critical)
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "GET", "HEAD"],
      AllowedOrigins: allowedOrigins,
      // Expose ETag so frontend can verify upload integrity if needed
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

console.log(`\n🔧 S3 CORS Configuration`);
console.log(`   Bucket  : ${bucketName}`);
console.log(`   Region  : ${region}`);
console.log(`   Mode    : ${isProd ? "production" : "development"}`);
console.log(`   Origins : \n${allowedOrigins.map(o => `     - ${o}`).join("\n")}\n`);

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
  requestHandler: { requestTimeout: 30_000 },
});

try {
  await client.send(
    new PutBucketCorsCommand({ Bucket: bucketName, CORSConfiguration: corsConfig })
  );
  console.log("✅ CORS rules applied permanently to S3 bucket.");

  // Verify the rules were saved
  const result = await client.send(new GetBucketCorsCommand({ Bucket: bucketName }));
  console.log("\n📋 Verified CORS rules now on bucket:");
  for (const rule of result.CORSRules ?? []) {
    console.log(`   Methods : ${rule.AllowedMethods?.join(", ")}`);
    console.log(`   Origins : ${rule.AllowedOrigins?.join(", ")}`);
    console.log(`   Headers : ${rule.AllowedHeaders?.join(", ")}`);
  }
  console.log("\n✅ Done. No further action needed — rules persist in AWS.\n");
} catch (err) {
  console.error("❌ Failed to apply CORS:", err.message);
  process.exit(1);
}
