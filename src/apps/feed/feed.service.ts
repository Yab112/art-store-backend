import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { FollowService } from '../follow/follow.service';
import { FeedQueryDto, FeedResponseDto, FeedItem } from './dto';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly followService: FollowService,
  ) {}

  /**
   * Get feed of artworks and blog posts from followed users
   */
  async getFeed(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type: 'all' | 'artworks' | 'blog_posts' = 'all',
  ): Promise<FeedResponseDto> {
    try {
      // Get list of users being followed
      const followingResult = await this.followService.getFollowing(
        userId,
        1,
        1000, // Get all followed users (adjust if needed)
      );

      const followingIds = followingResult.users.map((user) => user.id);

      if (followingIds.length === 0) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }

      const skip = (page - 1) * limit;
      const items: FeedItem[] = [];

      // Fetch artworks and blog posts based on type
      if (type === 'all' || type === 'artworks') {
        const artworks = await this.prisma.artwork.findMany({
          where: {
            userId: { in: followingIds },
            status: 'APPROVED',
            isApproved: true,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: type === 'artworks' ? limit : Math.ceil(limit / 2),
          skip: type === 'artworks' ? skip : 0,
        });

        for (const artwork of artworks) {
          items.push({
            type: 'artwork',
            id: artwork.id,
            createdAt: artwork.createdAt,
            artwork: {
              id: artwork.id,
              title: artwork.title || undefined,
              artist: artwork.artist,
              photos: artwork.photos,
              desiredPrice: artwork.desiredPrice,
              status: artwork.status,
              createdAt: artwork.createdAt,
              user: {
                id: artwork.user.id,
                name: artwork.user.name,
                image: artwork.user.image || undefined,
              },
            },
          });
        }
      }

      if (type === 'all' || type === 'blog_posts') {
        const blogPosts = await this.prisma.blogPost.findMany({
          where: {
            authorId: { in: followingIds },
            published: true,
            status: 'APPROVED',
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { publishedAt: 'desc' },
          take: type === 'blog_posts' ? limit : Math.ceil(limit / 2),
          skip: type === 'blog_posts' ? skip : 0,
        });

        for (const blogPost of blogPosts) {
          items.push({
            type: 'blog_post',
            id: blogPost.id,
            createdAt: blogPost.publishedAt || blogPost.createdAt,
            blogPost: {
              id: blogPost.id,
              title: blogPost.title,
              slug: blogPost.slug,
              excerpt: blogPost.excerpt || undefined,
              featuredImage: blogPost.featuredImage || undefined,
              publishedAt: blogPost.publishedAt || undefined,
              createdAt: blogPost.createdAt,
              author: {
                id: blogPost.author.id,
                name: blogPost.author.name,
                image: blogPost.author.image || undefined,
              },
              views: blogPost.views,
              likes: blogPost.likes,
            },
          });
        }
      }

      // Sort all items by creation date (newest first)
      items.sort((a, b) => {
        const dateA = a.createdAt.getTime();
        const dateB = b.createdAt.getTime();
        return dateB - dateA;
      });

      // Apply pagination if type is 'all'
      let paginatedItems = items;
      if (type === 'all') {
        paginatedItems = items.slice(skip, skip + limit);
      }

      // Get total counts
      const [artworkCount, blogPostCount] = await Promise.all([
        type === 'all' || type === 'artworks'
          ? this.prisma.artwork.count({
              where: {
                userId: { in: followingIds },
                status: 'APPROVED',
                isApproved: true,
              },
            })
          : 0,
        type === 'all' || type === 'blog_posts'
          ? this.prisma.blogPost.count({
              where: {
                authorId: { in: followingIds },
                published: true,
                status: 'APPROVED',
              },
            })
          : 0,
      ]);

      const total = type === 'all' ? artworkCount + blogPostCount : type === 'artworks' ? artworkCount : blogPostCount;
      const totalPages = Math.ceil(total / limit);

      return {
        items: paginatedItems,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Failed to get feed: ${error.message}`, error.stack);
      throw error;
    }
  }
}

