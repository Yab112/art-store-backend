/**
 * Script to disable S3 Block Public Access and apply a public read policy.
 */
import { S3Client, PutPublicAccessBlockCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function run() {
  try {
    console.log(`Disabling Block Public Access for bucket: ${bucketName}...`);
    await client.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          IgnorePublicAcls: false,
          BlockPublicPolicy: false,
          RestrictPublicBuckets: false,
        },
      })
    );
    console.log("✅ Block Public Access successfully disabled.");

    // Wait 2 seconds for propagation
    await new Promise((r) => setTimeout(r, 2000));

    console.log(`Applying public read policy to bucket: ${bucketName}...`);
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

    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy),
      })
    );
    console.log("✅ Bucket policy successfully applied. Images are now publicly readable.");
  } catch (err) {
    console.error("❌ Failed to update bucket configuration:");
    console.error(err);
  }
}

run();
