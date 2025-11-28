import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { AnalyticsDto, TrackProfileViewDto } from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate heat score for a user based on engagement metrics
   */
  async calculateHeatScore(userId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get user data
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          artworks: {
            where: {
              createdAt: { gte: thirtyDaysAgo },
            },
          },
          blogPosts: {
            where: {
              createdAt: { gte: thirtyDaysAgo },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Get engagement metrics
      const profileViews = user.profileViews || 0;

      // Get artwork interactions (likes, views)
      const artworkInteractions = await this.prisma.interaction.findMany({
        where: {
          artwork: {
            userId,
          },
          type: {
            in: ['LIKE', 'VIEW'],
          },
        },
      });

      const artworkLikes = artworkInteractions.filter(
        (i) => i.type === 'LIKE',
      ).length;
      const artworkViews = artworkInteractions.filter(
        (i) => i.type === 'VIEW',
      ).length;

      // Get sales count
      const salesCount = await this.prisma.artwork.count({
        where: {
          userId,
          status: 'SOLD',
        },
      });

      // Get comments count (artwork comments + blog comments)
      const artworkComments = await this.prisma.comment.count({
        where: {
          artwork: {
            userId,
          },
        },
      });

      const blogComments = await this.prisma.blogComment.count({
        where: {
          blogPost: {
            authorId: userId,
          },
        },
      });

      const comments = artworkComments + blogComments;

      // Follower growth (simplified - can be enhanced with actual follow system)
      const followerGrowth = 0; // Placeholder for future implementation

      // Recent activity score (last 30 days)
      const recentArtworkUploads = user.artworks.length;
      const recentBlogPosts = user.blogPosts.length;

      // Get recent comments made by user
      const recentComments = await this.prisma.comment.count({
        where: {
          authorName: user.name,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      // Get recent logins (sessions in last 30 days)
      const recentLogins = await this.prisma.session.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const recentActivityScore =
        recentArtworkUploads * 2 +
        recentBlogPosts * 1.5 +
        recentComments * 1 +
        recentLogins * 0.5;

      // Calculate heat score
      const rawScore =
        profileViews * 0.2 +
        artworkLikes * 0.15 +
        artworkViews * 0.15 +
        salesCount * 0.2 +
        comments * 0.1 +
        followerGrowth * 0.1 +
        recentActivityScore * 0.1;

      // Normalization factor (to keep scores in reasonable range)
      const normalizationFactor = 100;
      const heatScore = rawScore / normalizationFactor;

      // Update user's heat score
      await this.prisma.user.update({
        where: { id: userId },
        data: { heatScore },
      });

      return Math.max(0, heatScore);
    } catch (error) {
      this.logger.error(`Failed to calculate heat score for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track profile view and increment counter
   */
  async trackProfileView(
    userId: string,
    dto: TrackProfileViewDto = {},
  ): Promise<void> {
    try {
      const { viewerId, ip } = dto;

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Prevent duplicate views from same viewer within 24 hours
      if (viewerId) {
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        // Check if viewer has viewed this profile recently
        // This is a simplified check - in production, you might want a separate view tracking table
        // For now, we'll just increment if it's a different viewer
      }

      // Increment profile views counter
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          profileViews: {
            increment: 1,
          },
        },
      });

      // Recalculate heat score (async, don't wait)
      this.calculateHeatScore(userId).catch((err) => {
        this.logger.warn(`Failed to recalculate heat score after profile view:`, err);
      });
    } catch (error) {
      this.logger.error(`Failed to track profile view for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update last active timestamp for a user
   */
  async updateLastActiveAt(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update lastActiveAt for user ${userId}:`, error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get comprehensive analytics for a user
   */
  async getUserAnalytics(userId: string): Promise<AnalyticsDto> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          artworks: {
            where: {
              createdAt: { gte: thirtyDaysAgo },
            },
          },
          blogPosts: {
            where: {
              createdAt: { gte: thirtyDaysAgo },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Get engagement metrics
      const artworkInteractions = await this.prisma.interaction.findMany({
        where: {
          artwork: {
            userId,
          },
          type: {
            in: ['LIKE', 'VIEW'],
          },
        },
      });

      const artworkLikes = artworkInteractions.filter(
        (i) => i.type === 'LIKE',
      ).length;
      const artworkViews = artworkInteractions.filter(
        (i) => i.type === 'VIEW',
      ).length;

      const salesCount = await this.prisma.artwork.count({
        where: {
          userId,
          status: 'SOLD',
        },
      });

      const artworkComments = await this.prisma.comment.count({
        where: {
          artwork: {
            userId,
          },
        },
      });

      const blogComments = await this.prisma.blogComment.count({
        where: {
          blogPost: {
            authorId: userId,
          },
        },
      });

      const comments = artworkComments + blogComments;
      const followerGrowth = 0; // Placeholder

      const recentArtworkUploads = user.artworks.length;
      const recentBlogPosts = user.blogPosts.length;

      const recentComments = await this.prisma.comment.count({
        where: {
          authorName: user.name,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const recentLogins = await this.prisma.session.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const recentActivityScore =
        recentArtworkUploads * 2 +
        recentBlogPosts * 1.5 +
        recentComments * 1 +
        recentLogins * 0.5;

      return {
        userId: user.id,
        profileViews: user.profileViews || 0,
        heatScore: user.heatScore || 0,
        lastActiveAt: user.lastActiveAt,
        artworkLikes,
        artworkViews,
        salesCount,
        comments,
        followerGrowth,
        recentActivityScore,
        recentArtworkUploads,
        recentBlogPosts,
        recentComments,
        recentLogins,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Recalculate heat scores for all users (background job)
   */
  async recalculateAllHeatScores(): Promise<void> {
    try {
      this.logger.log('Starting heat score recalculation for all users...');

      const users = await this.prisma.user.findMany({
        select: { id: true },
      });

      let processed = 0;
      const batchSize = 10;

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);

        await Promise.all(
          batch.map((user) =>
            this.calculateHeatScore(user.id).catch((err) => {
              this.logger.warn(
                `Failed to recalculate heat score for user ${user.id}:`,
                err,
              );
            }),
          ),
        );

        processed += batch.length;
        this.logger.log(`Processed ${processed}/${users.length} users...`);
      }

      this.logger.log(
        `Heat score recalculation completed. Processed ${processed} users.`,
      );
    } catch (error) {
      this.logger.error('Failed to recalculate all heat scores:', error);
      throw error;
    }
  }
}


