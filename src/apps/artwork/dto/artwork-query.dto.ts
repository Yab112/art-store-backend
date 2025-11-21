import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ArtworkStatus } from '@prisma/client';

/**
 * Query DTO for filtering and sorting artworks
 */
export class ArtworkQueryDto {
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
    description: 'Filter by artwork status',
    enum: ArtworkStatus,
    example: ArtworkStatus.APPROVED
  })
  @IsOptional()
  @IsEnum(ArtworkStatus)
  status?: ArtworkStatus;

  @ApiPropertyOptional({ 
    description: 'Search by title, artist, or description',
    example: 'sunset'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by artist name',
    example: 'John Doe'
  })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by art technique',
    example: 'Oil on Canvas'
  })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by support material',
    example: 'Canvas'
  })
  @IsOptional()
  @IsString()
  support?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by origin country',
    example: 'France'
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by year of artwork creation',
    example: '2020'
  })
  @IsOptional()
  @IsString()
  yearOfArtwork?: string;

  @ApiPropertyOptional({ 
    description: 'Minimum price filter',
    example: 100,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Maximum price filter',
    example: 5000,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Filter only approved artworks',
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ 
    description: 'Sort field',
    example: 'createdAt',
    enum: ['createdAt', 'desiredPrice', 'title', 'artist', 'updatedAt']
  })
  @IsOptional()
  @IsEnum(['createdAt', 'desiredPrice', 'title', 'artist', 'updatedAt'])
  sortBy?: 'createdAt' | 'desiredPrice' | 'title' | 'artist' | 'updatedAt';

  @ApiPropertyOptional({ 
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  orderBy?: 'asc' | 'desc' = 'desc';
}

