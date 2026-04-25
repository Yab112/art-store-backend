
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../env/local.env") });

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";
const FRONTEND_PUBLIC_DIR = path.join(__dirname, "../../art-gallery/public");

async function uploadFile(filePath: string, fileName: string) {
    const fileContent = fs.readFileSync(filePath);
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const key = `images/${uniqueFileName}`;

    // Determine content type
    let contentType = "application/octet-stream";
    if (fileExtension === ".jpg" || fileExtension === ".jpeg") contentType = "image/jpeg";
    if (fileExtension === ".png") contentType = "image/png";
    if (fileExtension === ".webp") contentType = "image/webp";
    if (fileExtension === ".svg") contentType = "image/svg+xml";

    try {
        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: fileContent,
                ContentType: contentType,
            })
        );
        console.log(`Uploaded ${fileName} -> ${uniqueFileName}`);
        return uniqueFileName;
    } catch (err) {
        console.error(`Error uploading ${fileName}:`, err);
        return null;
    }
}

async function main() {
    console.log(`Reading images from ${FRONTEND_PUBLIC_DIR}...`);
    console.log(`Target Bucket: ${BUCKET_NAME}`);

    if (!fs.existsSync(FRONTEND_PUBLIC_DIR)) {
        console.error("Frontend public directory not found!");
        return;
    }

    const files = fs.readdirSync(FRONTEND_PUBLIC_DIR);
    const imageFiles = files.filter((file) =>
        /\.(jpg|jpeg|png|webp|svg)$/i.test(file)
    );

    console.log(`Found ${imageFiles.length} images.`);

    const uploadedFiles: string[] = [];

    for (const file of imageFiles) {
        const filePath = path.join(FRONTEND_PUBLIC_DIR, file);
        const isDir = fs.statSync(filePath).isDirectory();
        if (!isDir) {
            const uploadedName = await uploadFile(filePath, file);
            if (uploadedName) {
                uploadedFiles.push(uploadedName);
            }
        }
    }

    const outputPath = path.join(__dirname, "uploaded_images.json");
    fs.writeFileSync(outputPath, JSON.stringify(uploadedFiles, null, 2));
    console.log(`Saved uploaded filenames to ${outputPath}`);
}

main();
