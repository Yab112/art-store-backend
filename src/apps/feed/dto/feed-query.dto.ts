import { IsOptional, IsInt, Min, Max, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum FeedContentType {
  ALL = "all",
  ARTWORKS = "artworks",
  BLOG_POSTS = "blog_posts",
}

export class FeedQueryDto {
  @ApiPropertyOptional({
    description: "Page number for pagination",
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Filter by content type",
    enum: FeedContentType,
    default: FeedContentType.ALL,
  })
  @IsOptional()
  @IsEnum(FeedContentType)
  type?: FeedContentType = FeedContentType.ALL;
}
