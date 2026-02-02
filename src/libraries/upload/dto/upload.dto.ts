import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTOs for Presigned URL generation (S3 uploads)
 */

export class GeneratePresignedUrlDto {
  @ApiProperty({
    description: "Original filename",
    example: "my-artwork.jpg",
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: "MIME type of the file",
    example: "image/jpeg",
    enum: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  })
  @IsString()
  contentType: string;

  @ApiPropertyOptional({
    description: "URL expiration time in seconds (default: 3600 = 1 hour)",
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  expirySeconds?: number;
}

export class FileInfoDto {
  @ApiProperty({
    description: "Original filename",
    example: "my-artwork.jpg",
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: "MIME type of the file",
    example: "image/jpeg",
    enum: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  })
  @IsString()
  contentType: string;
}

export class GenerateMultiplePresignedUrlsDto {
  @ApiProperty({
    description: "Array of file information",
    type: [FileInfoDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileInfoDto)
  files: FileInfoDto[];

  @ApiPropertyOptional({
    description: "URL expiration time in seconds (default: 3600 = 1 hour)",
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  expirySeconds?: number;
}

export class GenerateDocumentPresignedUrlDto {
  @ApiProperty({
    description: "Original filename",
    example: "proof-of-origin.pdf",
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: "MIME type of the file",
    example: "application/pdf",
    enum: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
  })
  @IsString()
  contentType: string;

  @ApiPropertyOptional({
    description: "URL expiration time in seconds (default: 3600 = 1 hour)",
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(3600)
  expirySeconds?: number;
}
