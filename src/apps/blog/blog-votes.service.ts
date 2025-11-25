import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { VoteDto, VoteTypeDto } from './dto';

@Injectable()
export class BlogVotesService {
  private readonly logger = new Logger(BlogVotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vote on a blog post (like or dislike)
   */
  async vote(blogPostId: string, voteDto: VoteDto, userId: string) {
    try {
      // Verify blog post exists
      const blogPost = await this.prisma.blogPost.findUnique({
        where: { id: blogPostId },
        select: { id: true, likes: true, dislikes: true },
      });

      if (!blogPost) {
        throw new NotFoundException('Blog post not found');
      }

      // Check if user already voted
      const existingVote = await this.prisma.blogVote.findUnique({
        where: {
          blogPostId_userId: {
            blogPostId,
            userId,
          },
        },
      });

      let updatedPost;
      let vote;

      if (existingVote) {
        // User already voted - update or remove vote
        if (existingVote.type === voteDto.type) {
          // Same vote type - remove the vote
          await this.prisma.blogVote.delete({
            where: { id: existingVote.id },
          });

          // Decrement the count
          const updateData: any = {};
          if (voteDto.type === VoteTypeDto.LIKE) {
            updateData.likes = { decrement: 1 };
          } else {
            updateData.dislikes = { decrement: 1 };
          }

          updatedPost = await this.prisma.blogPost.update({
            where: { id: blogPostId },
            data: updateData,
          });

          return {
            message: 'Vote removed',
            data: {
              blogPostId,
              voteType: null,
              likes: updatedPost.likes,
              dislikes: updatedPost.dislikes,
            },
          };
        } else {
          // Different vote type - update the vote
          vote = await this.prisma.blogVote.update({
            where: { id: existingVote.id },
            data: { type: voteDto.type },
          });

          // Update counts - decrement old, increment new
          const updateData: any = {};
          if (existingVote.type === VoteTypeDto.LIKE) {
            updateData.likes = { decrement: 1 };
            updateData.dislikes = { increment: 1 };
          } else {
            updateData.likes = { increment: 1 };
            updateData.dislikes = { decrement: 1 };
          }

          updatedPost = await this.prisma.blogPost.update({
            where: { id: blogPostId },
            data: updateData,
          });
        }
      } else {
        // New vote
        vote = await this.prisma.blogVote.create({
          data: {
            blogPostId,
            userId,
            type: voteDto.type,
          },
        });

        // Increment the count
        const updateData: any = {};
        if (voteDto.type === VoteTypeDto.LIKE) {
          updateData.likes = { increment: 1 };
        } else {
          updateData.dislikes = { increment: 1 };
        }

        updatedPost = await this.prisma.blogPost.update({
          where: { id: blogPostId },
          data: updateData,
        });
      }

      return {
        message: `Blog post ${voteDto.type === VoteTypeDto.LIKE ? 'liked' : 'disliked'}`,
        data: {
          blogPostId,
          voteType: voteDto.type,
          likes: updatedPost.likes,
          dislikes: updatedPost.dislikes,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to vote on blog post: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's vote on a blog post
   */
  async getUserVote(blogPostId: string, userId: string) {
    try {
      const vote = await this.prisma.blogVote.findUnique({
        where: {
          blogPostId_userId: {
            blogPostId,
            userId,
          },
        },
      });

      return {
        voteType: vote?.type || null,
      };
    } catch (error) {
      this.logger.error(`Failed to get user vote: ${error.message}`, error.stack);
      throw error;
    }
  }
}

