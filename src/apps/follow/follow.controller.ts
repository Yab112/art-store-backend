import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { FollowService } from "./follow.service";
import { FollowQueryDto } from "./dto";
import { AuthGuard } from "@/core/guards/auth.guard";
import { Public } from "@/core/decorators/public.decorator";
import { UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

/**
 * Follow Controller
 * Handles all follow-related endpoints
 */
@ApiTags("Follow")
@Controller("follow")
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  /**
   * POST /follow/:userId
   * Follow a user (authenticated)
   */
  @Post(":userId")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Follow a user",
    description: "Follow another user. Requires authentication.",
  })
  @ApiParam({ name: "userId", description: "User ID to follow" })
  @ApiResponse({
    status: 200,
    description: "Successfully followed user",
  })
  @ApiResponse({
    status: 400,
    description: "Already following or cannot follow yourself",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async followUser(@Param("userId") userId: string, @Request() req: any) {
    try {
      const followerId = req.user.id;
      return await this.followService.followUser(followerId, userId);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to follow user",
      };
    }
  }

  /**
   * DELETE /follow/:userId
   * Unfollow a user (authenticated)
   */
  @Delete(":userId")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Unfollow a user",
    description: "Unfollow another user. Requires authentication.",
  })
  @ApiParam({ name: "userId", description: "User ID to unfollow" })
  @ApiResponse({
    status: 200,
    description: "Successfully unfollowed user",
  })
  @ApiResponse({ status: 400, description: "Not following this user" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async unfollowUser(@Param("userId") userId: string, @Request() req: any) {
    try {
      const followerId = req.user.id;
      return await this.followService.unfollowUser(followerId, userId);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to unfollow user",
      };
    }
  }

  /**
   * GET /follow/:userId/followers
   * Get user's followers (public, paginated)
   */
  @Get(":userId/followers")
  @Public()
  @ApiOperation({
    summary: "Get user followers",
    description:
      "Get a paginated list of users following the specified user. Public endpoint.",
  })
  @ApiParam({ name: "userId", description: "User ID to get followers for" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: "Followers retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getFollowers(
    @Param("userId") userId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
    @Request() req: any,
  ) {
    try {
      const viewerId = req.user?.id; // Optional - user might not be logged in
      const result = await this.followService.getFollowers(
        userId,
        page,
        limit,
        viewerId,
      );

      return {
        success: true,
        message: "Followers retrieved successfully",
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch followers",
      };
    }
  }

  /**
   * GET /follow/:userId/following
   * Get user's following list (public, paginated)
   */
  @Get(":userId/following")
  @Public()
  @ApiOperation({
    summary: "Get user following list",
    description:
      "Get a paginated list of users that the specified user is following. Public endpoint.",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to get following list for",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: "Following list retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getFollowing(
    @Param("userId") userId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
    @Request() req: any,
  ) {
    try {
      const viewerId = req.user?.id; // Optional - user might not be logged in
      const result = await this.followService.getFollowing(
        userId,
        page,
        limit,
        viewerId,
      );

      return {
        success: true,
        message: "Following list retrieved successfully",
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch following list",
      };
    }
  }

  /**
   * GET /follow/:userId/status
   * Check if current user is following target user (authenticated)
   */
  @Get(":userId/status")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Check follow status",
    description:
      "Check if the authenticated user is following the specified user.",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to check follow status for",
  })
  @ApiResponse({
    status: 200,
    description: "Follow status retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getFollowStatus(@Param("userId") userId: string, @Request() req: any) {
    try {
      const followerId = req.user.id;
      const result = await this.followService.isFollowing(followerId, userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to check follow status",
      };
    }
  }

  /**
   * GET /follow/:userId/counts
   * Get follower/following counts (public)
   */
  @Get(":userId/counts")
  @Public()
  @ApiOperation({
    summary: "Get follow counts",
    description:
      "Get the number of followers and following for a user. Public endpoint.",
  })
  @ApiParam({ name: "userId", description: "User ID to get counts for" })
  @ApiResponse({
    status: 200,
    description: "Follow counts retrieved successfully",
  })
  async getFollowCounts(@Param("userId") userId: string) {
    try {
      const result = await this.followService.getFollowCounts(userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to get follow counts",
      };
    }
  }
}
