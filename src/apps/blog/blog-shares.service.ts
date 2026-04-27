import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { ShareDto } from "./dto";

@Injectable()
export class BlogSharesService {
  private readonly logger = new Logger(BlogSharesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Share a blog post (authenticated users only)
   */
  async share(blogPostId: string, shareDto: ShareDto, userId: string) {
    try {
      // Verify blog post exists and is published
      const blogPost = await this.prisma.blogPost.findUnique({
        where: { id: blogPostId },
        select: { id: true, published: true, status: true, shares: true },
      });

      if (!blogPost) {
        throw new NotFoundException("Blog post not found");
      }

      if (!blogPost.published || blogPost.status !== "APPROVED") {
        throw new NotFoundException("Blog post is not available for sharing");
      }

      // Create share record (userId is required now)
      await this.prisma.blogShare.create({
        data: {
          blogPostId,
          userId, // Now required - authenticated users only
          platform: shareDto.platform || null,
        },
      });

      // Increment share count
      const updatedPost = await this.prisma.blogPost.update({
        where: { id: blogPostId },
        data: {
          shares: { increment: 1 },
        },
      });

      this.logger.log(
        `Blog post shared: ${blogPostId} on ${shareDto.platform || "unknown"}`,
      );

      return {
        message: "Blog post shared successfully",
        data: {
          blogPostId,
          shares: updatedPost.shares,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to share blog post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get share statistics for a blog post
   */
  async getShareStats(blogPostId: string) {
    try {
      const stats = await this.prisma.blogShare.groupBy({
        by: ["platform"],
        where: {
          blogPostId,
        },
        _count: {
          id: true,
        },
      });

      return {
        blogPostId,
        platformStats: stats.map((stat) => ({
          platform: stat.platform || "unknown",
          count: stat._count.id,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get share stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
