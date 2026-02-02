import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { S3Service } from "../s3";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Generate presigned URL for uploading an image
   * Frontend will use this URL to upload directly to S3
   */
  async getPresignedImageUploadUrl(
    fileName: string,
    contentType: string,
    expirySeconds = 3600,
  ) {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
      );
    }

    try {
      const result = await this.s3Service.getPresignedUploadUrl(
        fileName,
        contentType,
        undefined,
        expirySeconds,
      );

      this.logger.log(
        `✅ Presigned image upload URL generated: ${result.objectKey}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error("❌ Failed to generate presigned image URL:", error);
      throw new BadRequestException("Failed to generate upload URL");
    }
  }

  /**
   * Generate presigned URL for uploading a document
   * Frontend will use this URL to upload directly to S3
   */
  async getPresignedDocumentUploadUrl(
    fileName: string,
    contentType: string,
    expirySeconds = 3600,
  ) {
    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (!allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        "Invalid file type. Only JPEG, PNG, and PDF are allowed.",
      );
    }

    try {
      const result = await this.s3Service.getPresignedUploadUrl(
        fileName,
        contentType,
        undefined,
        expirySeconds,
      );

      this.logger.log(
        `✅ Presigned document upload URL generated: ${result.objectKey}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error("❌ Failed to generate presigned document URL:", error);
      throw new BadRequestException("Failed to generate upload URL");
    }
  }

  /**
   * Generate multiple presigned URLs for uploading images
   */
  async getPresignedMultipleImageUploadUrls(
    files: Array<{ fileName: string; contentType: string }>,
    expirySeconds = 3600,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }

    if (files.length > 10) {
      throw new BadRequestException("Maximum 10 files allowed at once");
    }

    try {
      const uploadPromises = files.map((file) =>
        this.getPresignedImageUploadUrl(
          file.fileName,
          file.contentType,
          expirySeconds,
        ),
      );

      const results = await Promise.all(uploadPromises);
      this.logger.log(`✅ ${files.length} presigned image URLs generated`);
      return results;
    } catch (error: any) {
      this.logger.error("❌ Failed to generate presigned URLs:", error);
      throw new BadRequestException("Failed to generate upload URLs");
    }
  }

  /**
   * Get public URL for an S3 object
   */
  getPublicUrl(objectKey: string): string {
    return this.s3Service.getPublicUrl(objectKey);
  }

  /**
   * Generate presigned download URL (for private files)
   */
  async getPresignedDownloadUrl(
    objectKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.s3Service.getPresignedDownloadUrl(
      objectKey,
      undefined,
      expirySeconds,
    );
  }
}
