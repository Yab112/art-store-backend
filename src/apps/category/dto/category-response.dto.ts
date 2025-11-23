import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Abstract Art',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Artworks featuring abstract techniques and styles',
  })
  description?: string;

  @ApiProperty({
    description: 'Category slug for URLs',
    example: 'abstract-art',
  })
  slug: string;

  @ApiProperty({
    description: 'Number of artworks in this category',
    example: 25,
  })
  artworkCount?: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
