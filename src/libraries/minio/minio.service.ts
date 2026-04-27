import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as Minio from "minio";

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;
  private readonly publicUrl: string;

  // Default buckets
  private readonly BUCKETS = ["images", "documents"];

  constructor() {
    // Get configuration from environment variables
    this.endpoint = process.env.MINIO_ENDPOINT || "localhost";
    this.port = parseInt(process.env.MINIO_PORT || "9000", 10);
    this.useSSL = process.env.MINIO_USE_SSL === "true";
    const protocol = this.useSSL ? "https" : "http";
    const publicUrlBase =
      process.env.MINIO_PUBLIC_URL ||
      `${protocol}://${this.endpoint}:${this.port}`;
    this.publicUrl = publicUrlBase.endsWith("/")
      ? publicUrlBase.slice(0, -1)
      : publicUrlBase;

    const accessKey = process.env.MINIO_ACCESS_KEY || "admin";
    const secretKey = process.env.MINIO_SECRET_KEY || "admin123";

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });

    this.logger.log(
      `✅ MinIO client initialized: ${protocol}://${this.endpoint}:${this.port}`,
    );
  }

  async onModuleInit() {
    await this.initializeBuckets();
  }

  /**
   * Initialize buckets on startup
   * Creates buckets if they don't exist and sets public read policy
   */
  private async initializeBuckets() {
    try {
      this.logger.log("🔄 Initializing MinIO buckets...");

      for (const bucketName of this.BUCKETS) {
        const exists = await this.client.bucketExists(bucketName);

        if (!exists) {
          this.logger.log(`📦 Creating bucket: ${bucketName}...`);
          await this.client.makeBucket(bucketName, "us-east-1");
          this.logger.log(`✅ Bucket created: ${bucketName}`);
        } else {
          this.logger.log(`✅ Bucket already exists: ${bucketName}`);
        }

        // Set public read policy for the bucket
        try {
          const policy = {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { AWS: ["*"] },
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${bucketName}/*`],
              },
            ],
          };

          await this.client.setBucketPolicy(bucketName, JSON.stringify(policy));
          this.logger.log(`✅ Public read policy set for: ${bucketName}`);
        } catch (policyError: any) {
          // Policy might already be set or we don't have permission
          this.logger.warn(
            `⚠️ Could not set bucket policy for ${bucketName}: ${policyError.message}`,
          );
        }
      }

      this.logger.log("✅ MinIO buckets initialized successfully");
    } catch (error: any) {
      this.logger.error(
        "❌ Failed to initialize MinIO buckets:",
        error.message,
      );
      throw error;
    }
  }

  async uploadFile(bucketName: string, objectName: string, filePath: string) {
    try {
      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(bucketName, "us-east-1");
        this.logger.log(`📦 Created bucket: ${bucketName}`);
      }

      await this.client.fPutObject(bucketName, objectName, filePath);
      this.logger.log(`✅ File uploaded successfully: ${objectName}`);
      return {
        objectName,
        url: this.getPublicUrl(bucketName, objectName),
      };
    } catch (error: any) {
      this.logger.error(`❌ Upload failed for ${objectName}:`, error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async uploadBuffer(
    bucketName: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ) {
    try {
      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(bucketName, "us-east-1");
        this.logger.log(`📦 Created bucket: ${bucketName}`);
      }

      await this.client.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
        {
          "Content-Type": contentType,
        },
      );
      this.logger.log(`✅ Buffer uploaded successfully: ${objectName}`);
      return {
        objectName,
        url: this.getPublicUrl(bucketName, objectName),
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Buffer upload failed for ${objectName}:`,
        error.message,
      );
      throw new Error(`Failed to upload buffer: ${error.message}`);
    }
  }

  /**
   * Get public URL for an object
   */
  private getPublicUrl(bucketName: string, objectName: string): string {
    // Ensure objectName doesn't start with /
    const cleanObjectName = objectName.startsWith("/")
      ? objectName.slice(1)
      : objectName;
    return `${this.publicUrl}/${bucketName}/${cleanObjectName}`;
  }

  async getPresignedUrl(
    bucketName: string,
    objectName: string,
    expirySeconds = 3600,
  ) {
    return this.client.presignedGetObject(
      bucketName,
      objectName,
      expirySeconds,
    );
  }
}
