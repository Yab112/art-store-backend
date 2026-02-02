import { ApiProperty } from "@nestjs/swagger";

export class FollowUserDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User name" })
  name: string;

  @ApiProperty({ description: "User email", required: false })
  email?: string;

  @ApiProperty({ description: "User avatar image URL", required: false })
  image?: string;

  @ApiProperty({ description: "User bio", required: false })
  bio?: string;

  @ApiProperty({ description: "User location", required: false })
  location?: string;

  @ApiProperty({ description: "User website", required: false })
  website?: string;

  @ApiProperty({ description: "Number of followers", required: false })
  followerCount?: number;

  @ApiProperty({
    description: "Number of users being followed",
    required: false,
  })
  followingCount?: number;

  @ApiProperty({
    description: "Whether current user is following this user",
    required: false,
  })
  isFollowing?: boolean;
}

export class FollowListResponseDto {
  @ApiProperty({ description: "List of users", type: [FollowUserDto] })
  users: FollowUserDto[];

  @ApiProperty({ description: "Total number of users" })
  total: number;

  @ApiProperty({ description: "Current page number" })
  page: number;

  @ApiProperty({ description: "Number of items per page" })
  limit: number;

  @ApiProperty({ description: "Total number of pages" })
  totalPages: number;
}

export class FollowCountsDto {
  @ApiProperty({ description: "Number of followers" })
  followerCount: number;

  @ApiProperty({ description: "Number of users being followed" })
  followingCount: number;
}

export class FollowStatusDto {
  @ApiProperty({ description: "Whether the user is following the target user" })
  isFollowing: boolean;
}
