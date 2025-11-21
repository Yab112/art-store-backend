import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { COLLECTION_CONSTANTS } from '../constants';

/**
 * Query DTO for filtering and paginating collections
 */
export class CollectionsQueryDto {
  @ApiPropertyOptional({ 
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of items per page',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: 'Search by collection name or description',
    example: 'summer'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by visibility. Use "all" to get all collections (public + private). Defaults to "public" if not provided.',
    example: 'public',
    enum: [COLLECTION_CONSTANTS.VISIBILITY.PUBLIC, COLLECTION_CONSTANTS.VISIBILITY.PRIVATE, COLLECTION_CONSTANTS.VISIBILITY.UNLISTED, 'all']
  })
  @IsOptional()
  @IsString()
  @IsIn([COLLECTION_CONSTANTS.VISIBILITY.PUBLIC, COLLECTION_CONSTANTS.VISIBILITY.PRIVATE, COLLECTION_CONSTANTS.VISIBILITY.UNLISTED, 'all'])
  visibility?: string;
}

