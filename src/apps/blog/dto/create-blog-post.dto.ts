import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBlogPostDto {
  @ApiProperty({
    description: 'Title of the blog post',
    example: 'The Future of Digital Art',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'URL-friendly slug (auto-generated if not provided)',
    example: 'the-future-of-digital-art',
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    description: 'Full blog post content (HTML or markdown)',
    example: '<p>This is the full content of the blog post...</p>',
    minLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  content: string;

  @ApiPropertyOptional({
    description: 'Short excerpt/summary for preview',
    example: 'Discover the latest trends in digital art and how technology is shaping the future of artistic expression.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Featured image URL (S3/MinIO)',
    example: 'https://minio.example.com/blog/featured-image.jpg',
  })
  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ApiPropertyOptional({
    description: 'Whether to publish immediately',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}












