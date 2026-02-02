import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArtworkStatus } from "@prisma/client";

/**
 * Response DTOs for Artwork endpoints
 */

export class ArtworkDimensionDto {
  @ApiProperty({ description: "Height of the artwork", example: "50cm" })
  height: string;

  @ApiProperty({ description: "Width of the artwork", example: "60cm" })
  width: string;

  @ApiPropertyOptional({ description: "Depth of the artwork", example: "5cm" })
  depth?: string;
}

export class ArtworkDto {
  @ApiProperty({ description: "Unique artwork identifier", example: "uuid" })
  id: string;

  @ApiPropertyOptional({
    description: "Title of the artwork",
    example: "Sunset Over Mountains",
  })
  title?: string;

  @ApiProperty({ description: "Artist name", example: "John Doe" })
  artist: string;

  @ApiPropertyOptional({
    description: "Categories assigned to this artwork",
    type: [Object],
    example: [{ id: "uuid", name: "Abstract Art", slug: "abstract-art" }],
  })
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  @ApiProperty({ description: "Support material", example: "Canvas" })
  support: string;

  @ApiProperty({ description: "State of the artwork", example: "Excellent" })
  state: string;

  @ApiProperty({ description: "Year artwork was created", example: "2020" })
  yearOfArtwork: string;

  @ApiProperty({ description: "Artwork dimensions", type: ArtworkDimensionDto })
  dimensions: ArtworkDimensionDto;

  @ApiProperty({ description: "Whether artwork is framed", example: true })
  isFramed: boolean;

  @ApiProperty({ description: "Weight of the artwork", example: "2kg" })
  weight: string;

  @ApiProperty({ description: "Accept hand delivery", example: true })
  handDeliveryAccepted: boolean;

  @ApiProperty({ description: "Origin of the artwork", example: "France" })
  origin: string;

  @ApiPropertyOptional({ description: "Year of acquisition", example: "2021" })
  yearOfAcquisition?: string;

  @ApiPropertyOptional({ description: "Artwork description" })
  description?: string;

  @ApiProperty({ description: "Desired price in currency", example: 1500.0 })
  desiredPrice: number;

  @ApiProperty({ description: "Accept price negotiation", example: true })
  acceptPriceNegotiation: boolean;

  @ApiProperty({ description: "Account holder name", example: "John Doe" })
  accountHolder: string;

  @ApiProperty({
    description: "IBAN for payment",
    example: "FR7630006000011234567890189",
  })
  iban: string;

  @ApiPropertyOptional({ description: "BIC code", example: "BNPAFRPPXXX" })
  bicCode?: string;

  @ApiProperty({ description: "Accepted terms of sale", example: true })
  acceptTermsOfSale: boolean;

  @ApiProperty({ description: "Given sales mandate", example: true })
  giveSalesMandate: boolean;

  @ApiPropertyOptional({ description: "Proof of origin URL" })
  proofOfOrigin?: string;

  @ApiProperty({ description: "Array of photo URLs", type: [String] })
  photos: string[];

  @ApiProperty({
    description: "Artwork status",
    enum: ArtworkStatus,
    example: "PENDING",
  })
  status: ArtworkStatus;

  @ApiProperty({ description: "Whether artwork is approved", example: false })
  isApproved: boolean;

  @ApiProperty({
    description: "User ID who created the artwork",
    example: "uuid",
  })
  userId: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;
}

export class ArtworkListItemDto {
  @ApiProperty({ description: "Unique artwork identifier", example: "uuid" })
  id: string;

  @ApiPropertyOptional({ description: "Title of the artwork" })
  title?: string;

  @ApiProperty({ description: "Artist name" })
  artist: string;

  @ApiPropertyOptional({
    description: "Categories assigned to this artwork",
    type: [Object],
  })
  categories?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  @ApiProperty({ description: "Main photo URL" })
  mainPhoto: string;

  @ApiProperty({ description: "All photo URLs", type: [String] })
  photos: string[];

  @ApiProperty({ description: "Desired price" })
  desiredPrice: number;

  @ApiProperty({ description: "Artwork status", enum: ArtworkStatus })
  status: ArtworkStatus;

  @ApiProperty({ description: "Whether artwork is approved" })
  isApproved: boolean;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;
}

export class ArtworkDetailDto extends ArtworkDto {
  @ApiPropertyOptional({ description: "User information", type: Object })
  user?: {
    id: string;
    name: string;
    image?: string;
  };

  @ApiPropertyOptional({ description: "Like count", example: 42 })
  likeCount?: number;

  @ApiPropertyOptional({ description: "Comment count", example: 15 })
  commentCount?: number;

  @ApiPropertyOptional({
    description: "Whether current user liked this artwork",
    example: false,
  })
  isLiked?: boolean;

  @ApiPropertyOptional({ description: "Average rating", example: 4.5 })
  averageRating?: number;

  @ApiPropertyOptional({ description: "Review count", example: 10 })
  reviewCount?: number;
}

export class CommentDto {
  @ApiProperty({ description: "Comment ID", example: "uuid" })
  id: string;

  @ApiProperty({ description: "Artwork ID", example: "uuid" })
  artworkId: string;

  @ApiProperty({ description: "Author name", example: "Jane Doe" })
  authorName: string;

  @ApiProperty({ description: "Comment content" })
  content: string;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiPropertyOptional({ description: "Author information" })
  author?: {
    id: string;
    name: string;
    image?: string;
  };
}

export class LikeDto {
  @ApiProperty({ description: "Like count", example: 42 })
  count: number;

  @ApiProperty({ description: "Whether current user liked", example: false })
  isLiked: boolean;
}

export class ArtworkListResponseDto {
  @ApiProperty({ description: "List of artworks", type: [ArtworkListItemDto] })
  artworks: ArtworkListItemDto[];

  @ApiProperty({ description: "Pagination information", type: Object })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class ArtworkResponseDto {
  @ApiProperty({ description: "Success status", example: true })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Artwork retrieved successfully",
  })
  message?: string;

  @ApiProperty({ description: "Artwork data", type: ArtworkDetailDto })
  artwork: ArtworkDetailDto;
}

export class CommentListResponseDto {
  @ApiProperty({ description: "List of comments", type: [CommentDto] })
  comments: CommentDto[];

  @ApiProperty({ description: "Pagination information", type: Object })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
