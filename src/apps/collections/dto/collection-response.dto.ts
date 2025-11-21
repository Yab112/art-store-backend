import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for Collection endpoints
 */

export class CollectionArtworkDto {
  @ApiProperty({ description: 'Artwork ID', example: 'uuid' })
  id: string;

  @ApiPropertyOptional({ description: 'Artwork title' })
  title?: string;

  @ApiProperty({ description: 'Artist name' })
  artist: string;

  @ApiProperty({ description: 'Art technique' })
  technique: string;

  @ApiProperty({ description: 'Artwork photos', type: [String] })
  photos: string[];

  @ApiProperty({ description: 'Desired price' })
  desiredPrice: number;

  @ApiProperty({ description: 'Artwork status' })
  status: string;

  @ApiProperty({ description: 'Whether artwork is approved' })
  isApproved: boolean;
}

export class CollectionDto {
  @ApiProperty({ description: 'Collection ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Collection name' })
  name: string;

  @ApiPropertyOptional({ description: 'Collection description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  coverImage?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Number of artworks in collection' })
  artworkCount?: number;

  @ApiPropertyOptional({ description: 'Visibility setting', example: 'private' })
  visibility?: string;
}

export class CollectionDetailDto extends CollectionDto {
  @ApiProperty({ description: 'Artworks in collection', type: [CollectionArtworkDto] })
  artworks: CollectionArtworkDto[];

  @ApiPropertyOptional({ description: 'Collection owner information', type: Object })
  owner?: {
    id: string;
    name: string;
    image?: string;
  };
}

export class CollectionListResponseDto {
  @ApiProperty({ description: 'List of collections', type: [CollectionDto] })
  collections: CollectionDto[];

  @ApiProperty({ description: 'Pagination information', type: Object })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
