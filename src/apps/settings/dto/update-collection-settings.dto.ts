import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class UpdateCollectionSettingsDto {
  @ApiPropertyOptional({
    description: "Maximum collections per user",
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxCollectionsPerUser?: number;

  @ApiPropertyOptional({
    description: "Maximum artworks per collection",
    example: 100,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxArtworksPerCollection?: number;

  @ApiPropertyOptional({
    description: "Minimum artworks required to publish a collection",
    example: 3,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minArtworksForPublish?: number;
}
