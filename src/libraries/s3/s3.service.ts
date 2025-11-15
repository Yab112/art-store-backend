import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly publicUrlBase: string;

  constructor() {
    // Get configuration from environment variables
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    this.publicUrlBase = process.env.AWS_S3_PUBLIC_URL || `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      this.logger.warn('⚠️ AWS S3 credentials not fully configured. Some features may not work.');
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(`✅ S3 client initialized for bucket: ${this.bucketName} in region: ${this.region}`);
  }

  /**
   * Generate a presigned URL for uploading a file directly from frontend
   * @param fileName Original filename (will be renamed with UUID)
   * @param contentType MIME type of the file
   * @param bucket Optional bucket name (defaults to configured bucket)
   * @param expirySeconds URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Object with presigned URL and public URL
   */
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string,
    bucket?: string,
    expirySeconds = 3600,
  ): Promise<{ presignedUrl: string; publicUrl: string; objectKey: string }> {
    try {
      const targetBucket = bucket || this.bucketName;
      const fileExtension = extname(fileName);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      
      // Determine folder based on content type
      const folder = this.getFolderForContentType(contentType);
      const objectKey = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: objectKey,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirySeconds,
      });

      const publicUrl = this.getPublicUrl(objectKey);

      this.logger.log(`✅ Presigned upload URL generated for: ${objectKey}`);
      
      return {
        presignedUrl,
        publicUrl,
        objectKey,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate presigned URL:`, error.message);
      throw new Error(`Failed to generate presigned upload URL: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for downloading/viewing a file
   * @param objectKey S3 object key (path)
   * @param bucket Optional bucket name
   * @param expirySeconds URL expiration time in seconds (default: 3600)
   * @returns Presigned URL
   */
  async getPresignedDownloadUrl(
    objectKey: string,
    bucket?: string,
    expirySeconds = 3600,
  ): Promise<string> {
    try {
      const targetBucket = bucket || this.bucketName;

      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: objectKey,
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirySeconds,
      });

      return presignedUrl;
    } catch (error: any) {
      this.logger.error(`❌ Failed to generate presigned download URL:`, error.message);
      throw new Error(`Failed to generate presigned download URL: ${error.message}`);
    }
  }

  /**
   * Get public URL for an S3 object (if bucket is public)
   * @param objectKey S3 object key
   * @returns Public URL
   */
  getPublicUrl(objectKey: string): string {
    const cleanKey = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey;
    const baseUrl = this.publicUrlBase.endsWith('/') 
      ? this.publicUrlBase.slice(0, -1) 
      : this.publicUrlBase;
    return `${baseUrl}/${cleanKey}`;
  }

  /**
   * Determine folder/bucket path based on content type
   */
  private getFolderForContentType(contentType: string): string {
    if (contentType.startsWith('image/')) {
      return 'images';
    }
    if (contentType === 'application/pdf' || contentType.startsWith('application/')) {
      return 'documents';
    }
    return ''; // Root of bucket
  }
}

