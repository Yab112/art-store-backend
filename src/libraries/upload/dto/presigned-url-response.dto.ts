import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for Presigned URL generation
 * This is what the frontend receives after requesting a presigned URL
 */

export class PresignedUrlResponseDto {
  @ApiProperty({ 
    description: 'Success status', 
    example: true 
  })
  success: boolean;

  @ApiProperty({ 
    description: 'Presigned URL for uploading file directly to S3. Use this URL with PUT method to upload the file.', 
    example: 'https://art-gallery-s3-bucket.s3.us-east-1.amazonaws.com/images/uuid.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...' 
  })
  presignedUrl: string;

  @ApiProperty({ 
    description: 'Public URL of the file after upload. Use this URL to access the file after uploading.', 
    example: 'https://art-gallery-s3-bucket.s3.us-east-1.amazonaws.com/images/uuid.jpg' 
  })
  publicUrl: string;

  @ApiProperty({ 
    description: 'S3 object key (path) where the file will be stored', 
    example: 'images/uuid.jpg' 
  })
  objectKey: string;
}

export class PresignedUrlItemDto {
  @ApiProperty({ 
    description: 'Presigned URL for uploading file directly to S3', 
    example: 'https://art-gallery-s3-bucket.s3.us-east-1.amazonaws.com/images/uuid.jpg?X-Amz-Algorithm=...' 
  })
  presignedUrl: string;

  @ApiProperty({ 
    description: 'Public URL of the file after upload', 
    example: 'https://art-gallery-s3-bucket.s3.us-east-1.amazonaws.com/images/uuid.jpg' 
  })
  publicUrl: string;

  @ApiProperty({ 
    description: 'S3 object key (path) where the file will be stored', 
    example: 'images/uuid.jpg' 
  })
  objectKey: string;
}

export class MultiplePresignedUrlsResponseDto {
  @ApiProperty({ 
    description: 'Success status', 
    example: true 
  })
  success: boolean;

  @ApiProperty({ 
    description: 'Array of presigned URLs for multiple file uploads', 
    type: [PresignedUrlItemDto] 
  })
  urls: PresignedUrlItemDto[];
}

