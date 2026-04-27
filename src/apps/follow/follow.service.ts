import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database";
import {
  FollowListResponseDto,
  FollowCountsDto,
  FollowStatusDto,
  FollowUserDto,
} from "./dto";

@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Follow a user
   */
  async followUser(followerId: string, followingId: string) {
    try {
      // Prevent users from following themselves
      if (followerId === followingId) {
        throw new BadRequestException("Cannot follow yourself");
      }

      // Check if target user exists
      const targetUser = await this.prisma.user.findUnique({
        where: { id: followingId },
      });

      if (!targetUser) {
        throw new NotFoundException("User not found");
      }

      // Check if already following
      const existingFollow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existingFollow) {
        throw new BadRequestException("Already following this user");
      }

      // Create follow relationship
      const follow = await this.prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
      });

      this.logger.log(
        `✅ User ${followerId} started following user ${followingId}`,
      );

      return {
        success: true,
        message: "Successfully followed user",
        follow,
      };
    } catch (error) {
      this.logger.error(`Failed to follow user: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(followerId: string, followingId: string) {
    try {
      // Check if follow relationship exists
      const existingFollow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!existingFollow) {
        throw new BadRequestException("Not following this user");
      }

      // Delete follow relationship
      await this.prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      this.logger.log(`✅ User ${followerId} unfollowed user ${followingId}`);

      return {
        success: true,
        message: "Successfully unfollowed user",
      };
    } catch (error) {
      this.logger.error(
        `Failed to unfollow user: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if a user is following another user
   */
  async isFollowing(
    followerId: string,
    followingId: string,
  ): Promise<FollowStatusDto> {
    try {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      return {
        isFollowing: !!follow,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check follow status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get paginated list of followers for a user
   */
  async getFollowers(
    userId: string,
    page: number = 1,
    limit: number = 20,
    viewerId?: string,
  ): Promise<FollowListResponseDto> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const skip = (page - 1) * limit;

      // Get followers with user details
      const [follows, total] = await Promise.all([
        this.prisma.follow.findMany({
          where: { followingId: userId },
          include: {
            follower: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                bio: true,
                location: true,
                website: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.follow.count({
          where: { followingId: userId },
        }),
      ]);

      // Get follow counts for each follower
      const usersWithCounts = await Promise.all(
        follows.map(async (follow) => {
          const follower = follow.follower;
          const [followerCount, followingCount] = await Promise.all([
            this.prisma.follow.count({
              where: { followingId: follower.id },
            }),
            this.prisma.follow.count({
              where: { followerId: follower.id },
            }),
          ]);

          // Check if viewer is following this follower
          let isFollowing = false;
          if (viewerId && viewerId !== follower.id) {
            const followCheck = await this.prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: viewerId,
                  followingId: follower.id,
                },
              },
            });
            isFollowing = !!followCheck;
          }

          return {
            id: follower.id,
            name: follower.name,
            email: follower.email,
            image: follower.image,
            bio: follower.bio,
            location: follower.location,
            website: follower.website,
            followerCount,
            followingCount,
            isFollowing,
          } as FollowUserDto;
        }),
      );

      const totalPages = Math.ceil(total / limit);

      return {
        users: usersWithCounts,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get followers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get paginated list of users being followed by a user
   */
  async getFollowing(
    userId: string,
    page: number = 1,
    limit: number = 20,
    viewerId?: string,
  ): Promise<FollowListResponseDto> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      const skip = (page - 1) * limit;

      // Get following with user details
      const [follows, total] = await Promise.all([
        this.prisma.follow.findMany({
          where: { followerId: userId },
          include: {
            following: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                bio: true,
                location: true,
                website: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.follow.count({
          where: { followerId: userId },
        }),
      ]);

      // Get follow counts for each user being followed
      const usersWithCounts = await Promise.all(
        follows.map(async (follow) => {
          const following = follow.following;
          const [followerCount, followingCount] = await Promise.all([
            this.prisma.follow.count({
              where: { followingId: following.id },
            }),
            this.prisma.follow.count({
              where: { followerId: following.id },
            }),
          ]);

          // Check if viewer is following this user
          let isFollowing = false;
          if (viewerId && viewerId !== following.id) {
            const followCheck = await this.prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: viewerId,
                  followingId: following.id,
                },
              },
            });
            isFollowing = !!followCheck;
          }

          return {
            id: following.id,
            name: following.name,
            email: following.email,
            image: following.image,
            bio: following.bio,
            location: following.location,
            website: following.website,
            followerCount,
            followingCount,
            isFollowing,
          } as FollowUserDto;
        }),
      );

      const totalPages = Math.ceil(total / limit);

      return {
        users: usersWithCounts,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get following: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get follower and following counts for a user
   */
  async getFollowCounts(userId: string): Promise<FollowCountsDto> {
    try {
      const [followerCount, followingCount] = await Promise.all([
        this.prisma.follow.count({
          where: { followingId: userId },
        }),
        this.prisma.follow.count({
          where: { followerId: userId },
        }),
      ]);

      return {
        followerCount,
        followingCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get follow counts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get mutual follows between two users
   */
  async getMutualFollows(
    userId1: string,
    userId2: string,
  ): Promise<FollowUserDto[]> {
    try {
      // Get users that both userId1 and userId2 are following
      const user1Following = await this.prisma.follow.findMany({
        where: { followerId: userId1 },
        select: { followingId: true },
      });

      const user2Following = await this.prisma.follow.findMany({
        where: { followerId: userId2 },
        select: { followingId: true },
      });

      const user1FollowingIds = new Set(
        user1Following.map((f) => f.followingId),
      );
      const user2FollowingIds = new Set(
        user2Following.map((f) => f.followingId),
      );

      // Find mutual follows
      const mutualIds = Array.from(user1FollowingIds).filter((id) =>
        user2FollowingIds.has(id),
      );

      if (mutualIds.length === 0) {
        return [];
      }

      // Get user details for mutual follows
      const mutualUsers = await this.prisma.user.findMany({
        where: {
          id: { in: mutualIds },
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          bio: true,
          location: true,
          website: true,
        },
      });

      // Get follow counts for each mutual user
      const usersWithCounts = await Promise.all(
        mutualUsers.map(async (user) => {
          const [followerCount, followingCount] = await Promise.all([
            this.prisma.follow.count({
              where: { followingId: user.id },
            }),
            this.prisma.follow.count({
              where: { followerId: user.id },
            }),
          ]);

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            bio: user.bio,
            location: user.location,
            website: user.website,
            followerCount,
            followingCount,
          } as FollowUserDto;
        }),
      );

      return usersWithCounts;
    } catch (error) {
      this.logger.error(
        `Failed to get mutual follows: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
