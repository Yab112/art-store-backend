/**
 * Script to set a public read bucket policy on the S3 bucket.
 * This is required so images uploaded to the bucket can be viewed on the frontend.
 */
import { S3Client, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(resolve(__dirname, "env/local.env"));

const region = process.env.AWS_REGION || "eu-north-1";
const bucketName = process.env.AWS_S3_BUCKET_NAME;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!bucketName || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing required env vars.");
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "PublicReadGetObject",
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${bucketName}/*`],
    },
  ],
};

console.log(`Applying public read policy to bucket: ${bucketName}...`);

async function run() {
  try {
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy),
      })
    );
    console.log("✅ Bucket policy successfully applied. Images are now publicly readable.");
  } catch (err) {
    console.error("❌ Failed to apply bucket policy:");
    console.error(err.message);
    if (err.message.includes("BlockPublicPolicy")) {
      console.error("\nAWS Block Public Access is preventing this.");
      console.error("You must disable 'Block all public access' in the AWS S3 Console for this bucket first!");
    }
  }
}

run();
