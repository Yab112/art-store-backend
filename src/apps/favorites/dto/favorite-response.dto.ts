import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArtworkListItemDto } from '../../artwork/dto/artwork-response.dto';

export class FavoriteDto {
  @ApiProperty({ description: 'Favorite ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Artwork ID', example: 'uuid' })
  artworkId: string;

  @ApiProperty({ description: 'Date when artwork was favorited' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Artwork details', type: ArtworkListItemDto })
  artwork?: ArtworkListItemDto;
}

export class FavoriteListResponseDto {
  @ApiProperty({ description: 'List of favorites', type: [FavoriteDto] })
  favorites: FavoriteDto[];

  @ApiProperty({ description: 'Pagination information' })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

