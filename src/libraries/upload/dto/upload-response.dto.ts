import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for Upload endpoints
 */

export class UploadResultDto {
  @ApiProperty({ description: 'Public URL of the uploaded file', example: 'https://storage.example.com/file.jpg' })
  url: string;

  @ApiProperty({ description: 'Object name/key in storage', example: 'uploads/2024/file-uuid.jpg' })
  objectName: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1024000 })
  size?: number;

  @ApiPropertyOptional({ description: 'MIME type', example: 'image/jpeg' })
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Original filename', example: 'my-photo.jpg' })
  originalName?: string;
}

export class SingleUploadResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response message', example: 'File uploaded successfully!' })
  message: string;

  @ApiProperty({ description: 'File URL', example: 'https://storage.example.com/file.jpg' })
  fileUrl: string;

  @ApiProperty({ description: 'Object name in storage', example: 'uploads/2024/file-uuid.jpg' })
  objectName: string;

  @ApiPropertyOptional({ description: 'Upload result details', type: UploadResultDto })
  result?: UploadResultDto;
}

export class MultipleUploadResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response message', example: '5 files uploaded successfully!' })
  message: string;

  @ApiProperty({ 
    description: 'Array of uploaded file information', 
    type: [Object],
    example: [
      { fileUrl: 'https://storage.example.com/file1.jpg', objectName: 'uploads/file1.jpg' },
      { fileUrl: 'https://storage.example.com/file2.jpg', objectName: 'uploads/file2.jpg' }
    ]
  })
  files: Array<{
    fileUrl: string;
    objectName: string;
    size?: number;
    mimeType?: string;
    originalName?: string;
  }>;
}

export class DocumentUploadResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response message', example: 'Document uploaded successfully!' })
  message: string;

  @ApiProperty({ description: 'Document URL', example: 'https://storage.example.com/document.pdf' })
  fileUrl: string;

  @ApiProperty({ description: 'Object name in storage', example: 'uploads/documents/file-uuid.pdf' })
  objectName: string;
}

