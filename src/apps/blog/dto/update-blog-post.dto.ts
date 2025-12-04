import { PartialType } from '@nestjs/swagger';
import { CreateBlogPostDto } from './create-blog-post.dto';
import {
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {
  @ApiPropertyOptional({
    description: 'Title of the blog post',
    example: 'The Future of Digital Art - Updated',
    minLength: 3,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug',
    example: 'the-future-of-digital-art-updated',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Full blog post content',
    example: '<p>Updated content...</p>',
    minLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(50)
  content?: string;

  @ApiPropertyOptional({
    description: 'Short excerpt/summary',
    example: 'Updated excerpt...',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Featured image URL',
    example: 'https://minio.example.com/blog/new-featured-image.jpg',
  })
  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ApiPropertyOptional({
    description: 'Publish status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}








