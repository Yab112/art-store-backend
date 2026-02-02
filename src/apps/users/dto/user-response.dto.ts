import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Response DTOs for User endpoints
 */

export class UserDto {
  @ApiProperty({ description: "Unique user identifier", example: "uuid" })
  id: string;

  @ApiProperty({ description: "User full name", example: "John Doe" })
  name: string;

  @ApiProperty({
    description: "User email address",
    example: "john.doe@example.com",
  })
  email: string;

  @ApiPropertyOptional({
    description: "Whether email is verified",
    example: true,
  })
  emailVerified?: boolean;

  @ApiPropertyOptional({ description: "User profile image URL" })
  image?: string;

  @ApiProperty({ description: "User score/rating", example: 4.5 })
  score: number;

  @ApiProperty({ description: "User role", example: "user" })
  role: string;

  @ApiProperty({ description: "Whether user is banned", example: false })
  banned: boolean;

  @ApiPropertyOptional({ description: "Ban reason" })
  banReason?: string;

  @ApiPropertyOptional({ description: "Ban expiration date" })
  banExpires?: Date;

  @ApiProperty({
    description: "Two-factor authentication enabled",
    example: false,
  })
  twoFactorEnabled: boolean;

  @ApiProperty({ description: "Account creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;

  @ApiPropertyOptional({ description: "First login flag" })
  firstlogin?: boolean;
}

export class UserListItemDto {
  @ApiProperty({ description: "Unique user identifier" })
  id: string;

  @ApiProperty({ description: "User full name" })
  name: string;

  @ApiProperty({ description: "User email address" })
  email: string;

  @ApiPropertyOptional({ description: "User profile image URL" })
  image?: string;

  @ApiProperty({ description: "User score/rating" })
  score: number;

  @ApiProperty({ description: "User role" })
  role: string;

  @ApiProperty({ description: "Whether user is banned" })
  banned: boolean;

  @ApiProperty({ description: "Account creation timestamp" })
  createdAt: Date;
}

export class UserDetailDto extends UserDto {
  @ApiPropertyOptional({ description: "Total artworks count" })
  artworkCount?: number;

  @ApiPropertyOptional({ description: "Total collections count" })
  collectionCount?: number;

  @ApiPropertyOptional({ description: "Total reviews count" })
  reviewCount?: number;
}

export class UserListResponseDto {
  @ApiProperty({ description: "List of users", type: [UserListItemDto] })
  users: UserListItemDto[];

  @ApiProperty({ description: "Pagination information", type: Object })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserResponseDto {
  @ApiProperty({ description: "Success status", example: true })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "User retrieved successfully",
  })
  message?: string;

  @ApiProperty({ description: "User data", type: UserDetailDto })
  user: UserDetailDto;
}
