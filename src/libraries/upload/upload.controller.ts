import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { UploadService } from "./upload.service";
import { AuthGuard } from "@/core/guards/auth.guard";
import { Public } from "@/core/decorators/public.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import {
  GeneratePresignedUrlDto,
  GenerateMultiplePresignedUrlsDto,
  GenerateDocumentPresignedUrlDto,
  PresignedUrlResponseDto,
  MultiplePresignedUrlsResponseDto,
} from "./dto";

@ApiTags("Upload")
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Generate presigned URL for uploading a single image
   * Frontend will use this URL to upload directly to S3
   */
  @Post("presigned/image")
  // @UseGuards(new AuthGuard())
  @Public()
  @ApiOperation({
    summary: "Get presigned URL for image upload",
    description:
      "Generate a presigned URL for uploading an image directly to S3 from the frontend. Frontend will use this URL to upload the file.",
  })
  @ApiBody({ type: GeneratePresignedUrlDto })
  @ApiResponse({
    status: 200,
    description:
      "Presigned URL generated successfully. Returns presignedUrl (for uploading), publicUrl (for accessing after upload), and objectKey (S3 path).",
    type: PresignedUrlResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid file type or missing parameters",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPresignedImageUrl(@Body() dto: GeneratePresignedUrlDto) {
    const result = await this.uploadService.getPresignedImageUploadUrl(
      dto.fileName,
      dto.contentType,
      dto.expirySeconds,
    );

    return {
      success: true,
      presignedUrl: result.presignedUrl,
      publicUrl: result.publicUrl,
      objectKey: result.objectKey,
    };
  }

  /**
   * Generate presigned URLs for uploading multiple images
   */
  @Post("presigned/images")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Get presigned URLs for multiple image uploads",
    description:
      "Generate presigned URLs for uploading multiple images (up to 10) directly to S3 from the frontend.",
  })
  @ApiBody({ type: GenerateMultiplePresignedUrlsDto })
  @ApiResponse({
    status: 200,
    description:
      "Presigned URLs generated successfully. Returns array of presigned URLs for multiple file uploads.",
    type: MultiplePresignedUrlsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid file type or too many files",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPresignedImageUrls(@Body() dto: GenerateMultiplePresignedUrlsDto) {
    const results =
      await this.uploadService.getPresignedMultipleImageUploadUrls(
        dto.files,
        dto.expirySeconds,
      );

    return {
      success: true,
      urls: results.map((result) => ({
        presignedUrl: result.presignedUrl,
        publicUrl: result.publicUrl,
        objectKey: result.objectKey,
      })),
    };
  }

  /**
   * Generate presigned URL for uploading a document
   */
  @Post("presigned/document")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Get presigned URL for document upload",
    description:
      "Generate a presigned URL for uploading a document (PDF, JPEG, PNG) directly to S3 from the frontend.",
  })
  @ApiBody({ type: GenerateDocumentPresignedUrlDto })
  @ApiResponse({
    status: 200,
    description:
      "Presigned URL generated successfully. Returns presignedUrl (for uploading), publicUrl (for accessing after upload), and objectKey (S3 path).",
    type: PresignedUrlResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid file type" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPresignedDocumentUrl(@Body() dto: GenerateDocumentPresignedUrlDto) {
    const result = await this.uploadService.getPresignedDocumentUploadUrl(
      dto.fileName,
      dto.contentType,
      dto.expirySeconds,
    );

    return {
      success: true,
      presignedUrl: result.presignedUrl,
      publicUrl: result.publicUrl,
      objectKey: result.objectKey,
    };
  }
}
