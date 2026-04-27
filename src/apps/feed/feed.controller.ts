import {
  Controller,
  Get,
  Query,
  Request,
  ParseIntPipe,
  ParseEnumPipe,
} from "@nestjs/common";
import { FeedService } from "./feed.service";
import { FeedQueryDto, FeedContentType } from "./dto";
import { AuthGuard } from "@/core/guards/auth.guard";
import { UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";

/**
 * Feed Controller
 * Handles feed-related endpoints
 */
@ApiTags("Feed")
@Controller("feed")
@UseGuards(AuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * GET /feed
   * Get feed of artworks and blog posts from followed users
   */
  @Get()
  @ApiOperation({
    summary: "Get follow feed",
    description:
      "Get a paginated feed of artworks and blog posts from users you follow. Requires authentication.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({
    name: "type",
    required: false,
    enum: FeedContentType,
    description: "Filter by content type: all, artworks, or blog_posts",
  })
  @ApiResponse({
    status: 200,
    description: "Feed retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getFeed(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query("type", new ParseEnumPipe(FeedContentType, { optional: true }))
    type: FeedContentType = FeedContentType.ALL,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.feedService.getFeed(userId, page, limit, type);

      return {
        success: true,
        message: "Feed retrieved successfully",
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch feed",
      };
    }
  }
}
