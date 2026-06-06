import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsInt,
  IsArray,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BlogPostLayout, MediaType } from "@prisma/client";

export class CreateBlogPostDto {
  @ApiProperty({
    description: "Title of the blog post",
    example: "The Future of Digital Art",
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: "URL-friendly slug (auto-generated if not provided)",
    example: "the-future-of-digital-art",
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    description: "Full blog post content (HTML or markdown)",
    example: "<p>This is the full content of the blog post...</p>",
    minLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  content: string;

  @ApiPropertyOptional({
    description: "Short excerpt/summary for preview",
    example:
      "Discover the latest trends in digital art and how technology is shaping the future of artistic expression.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({
    description: "Featured image URL (S3)",
    example: "https://s3.example.com/blog/featured-image.jpg",
  })
  @IsOptional()
  @IsString()
  featuredImage?: string;

  @ApiPropertyOptional({
    description: "Whether to publish immediately",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ description: "Subtitle of the blog post" })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({
    description: "Layout type for the blog post",
    enum: ["HERO", "STANDARD", "COMPACT", "LINK_ONLY"],
    default: "STANDARD",
  })
  @IsOptional()
  @IsEnum(["HERO", "STANDARD", "COMPACT", "LINK_ONLY"])
  layout?: BlogPostLayout;

  @ApiPropertyOptional({
    description: "Badge/Label for the post",
    example: "EXCLUSIVE",
  })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({ description: "Is this a live post?", default: false })
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;

  @ApiPropertyOptional({
    description: "Is this breaking news?",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBreaking?: boolean;

  @ApiPropertyOptional({
    description: "Is this an artwork drop?",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDrop?: boolean;

  @ApiPropertyOptional({ description: "Date of the artwork drop" })
  @IsOptional()
  @IsString()
  dropDate?: string;

  @ApiPropertyOptional({
    description: "Type of media content",
    enum: ["IMAGE", "VIDEO", "LIVE_STREAM"],
    default: "IMAGE",
  })
  @IsOptional()
  @IsEnum(["IMAGE", "VIDEO", "LIVE_STREAM"])
  mediaType?: MediaType;

  @ApiPropertyOptional({ description: "Video URL if mediaType is VIDEO" })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({
    description: "Video duration if mediaType is VIDEO",
    example: "2:37",
  })
  @IsOptional()
  @IsString()
  videoDuration?: string;

  @ApiPropertyOptional({
    description: "Priority for ordering (higher is more important)",
    default: 0,
  })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({
    description: "Location related to the post",
    example: "Paris Art Week",
  })
  @IsOptional()
  @IsString()
  locationTag?: string;

  @ApiPropertyOptional({
    description: "Custom CTA button text",
    example: "View Exhibition",
  })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiPropertyOptional({ description: "Custom CTA button link" })
  @IsOptional()
  @IsString()
  ctaLink?: string;

  @ApiPropertyOptional({ description: "ID of the blog category" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: "ID of the blog topic" })
  @IsOptional()
  @IsUUID()
  topicId?: string;

  @ApiPropertyOptional({ description: "ID of the featured artist" })
  @IsOptional()
  @IsUUID()
  featuredArtistId?: string;

  @ApiPropertyOptional({
    description: "IDs of related artworks",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  relatedArtworkIds?: string[];
}
