import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  ValidateIf,
} from "class-validator";
import { ArtworkStatus } from "@prisma/client";

/**
 * Query DTO for filtering and sorting artworks
 */
export class ArtworkQueryDto {
  @ApiPropertyOptional({
    description: "Page number for pagination",
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Filter by artwork status",
    enum: ArtworkStatus,
    example: ArtworkStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(ArtworkStatus)
  status?: ArtworkStatus;

  @ApiPropertyOptional({
    description: "Search by title, artist, or description",
    example: "sunset",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by artist name",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({
    description:
      "Filter by category IDs (array) - artworks matching any of these categories. Can be passed as single value: categoryIds=id or multiple: categoryIds=id1&categoryIds=id2 or comma-separated: categoryIds=id1,id2",
    example: [
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174001",
    ],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Handle both array and single value from query params
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
      // Filter out empty strings and return
      return value.filter((id) => id && id.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim()) {
      // If it's a comma-separated string, split it
      if (value.includes(',')) {
        return value.split(',').map((id) => id.trim()).filter(Boolean);
      }
      // If it's a single string, return as array
      return [value.trim()];
    }
    return undefined;
  })
  @ValidateIf((o, value) => value !== undefined && value !== null)
  @IsArray({ message: 'categoryIds must be an array' })
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: "Filter by art technique",
    example: "Oil on Canvas",
  })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiPropertyOptional({
    description: "Filter by support material",
    example: "Canvas",
  })
  @IsOptional()
  @IsString()
  support?: string;

  @ApiPropertyOptional({
    description: "Filter by origin country",
    example: "France",
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({
    description: "Filter by year of artwork creation",
    example: "2020",
  })
  @IsOptional()
  @IsString()
  yearOfArtwork?: string;

  @ApiPropertyOptional({
    description: "Minimum price filter",
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: "Maximum price filter",
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: "Filter only approved artworks",
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({
    description: "Sort field",
    example: "createdAt",
    enum: ["createdAt", "desiredPrice", "title", "artist", "updatedAt"],
  })
  @IsOptional()
  @IsEnum(["createdAt", "desiredPrice", "title", "artist", "updatedAt"])
  sortBy?: "createdAt" | "desiredPrice" | "title" | "artist" | "updatedAt";

  @ApiPropertyOptional({
    description: "Sort order",
    example: "desc",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  orderBy?: "asc" | "desc" = "desc";
}
