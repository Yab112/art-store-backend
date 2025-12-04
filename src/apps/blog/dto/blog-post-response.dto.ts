import { ApiProperty } from '@nestjs/swagger';

export class BlogPostResponseDto {
  @ApiProperty({ description: 'Blog post ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Blog post title', example: 'The Future of Digital Art' })
  title: string;

  @ApiProperty({ description: 'URL-friendly slug', example: 'the-future-of-digital-art' })
  slug: string;

  @ApiProperty({ description: 'Full content', example: '<p>Content...</p>' })
  content: string;

  @ApiProperty({ description: 'Short excerpt', example: 'Discover the latest trends...' })
  excerpt?: string;

  @ApiProperty({ description: 'Featured image URL', example: 'https://minio.example.com/blog/image.jpg' })
  featuredImage?: string;

  @ApiProperty({ description: 'Author ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  authorId: string;

  @ApiProperty({ description: 'Author name', example: 'John Doe' })
  author?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };

  @ApiProperty({ description: 'Published status', example: true })
  published: boolean;

  @ApiProperty({ description: 'Publication date', example: '2024-01-15T10:00:00Z' })
  publishedAt?: Date;

  @ApiProperty({ description: 'View count', example: 150 })
  views: number;

  @ApiProperty({ description: 'Creation date', example: '2024-01-15T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date', example: '2024-01-15T10:00:00Z' })
  updatedAt: Date;
}

export class BlogPostListResponseDto {
  @ApiProperty({ type: [BlogPostResponseDto], description: 'List of blog posts' })
  data: BlogPostResponseDto[];

  @ApiProperty({ description: 'Total count', example: 50 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 5 })
  totalPages: number;
}








