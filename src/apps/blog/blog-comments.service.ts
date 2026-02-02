import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { CreateCommentDto, UpdateCommentDto } from "./dto";

@Injectable()
export class BlogCommentsService {
  private readonly logger = new Logger(BlogCommentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a comment on a blog post
   */
  async create(
    blogPostId: string,
    createCommentDto: CreateCommentDto,
    userId: string,
  ) {
    try {
      // Verify blog post exists and is published
      const blogPost = await this.prisma.blogPost.findUnique({
        where: { id: blogPostId },
        select: { id: true, published: true, status: true },
      });

      if (!blogPost) {
        throw new NotFoundException("Blog post not found");
      }

      if (!blogPost.published || blogPost.status !== "APPROVED") {
        throw new ForbiddenException(
          "You can only comment on published blog posts",
        );
      }

      // If parent comment, verify it exists
      if (createCommentDto.parentId) {
        const parentComment = await this.prisma.blogComment.findUnique({
          where: { id: createCommentDto.parentId },
        });

        if (!parentComment || parentComment.blogPostId !== blogPostId) {
          throw new NotFoundException("Parent comment not found");
        }
      }

      const comment = await this.prisma.blogComment.create({
        data: {
          blogPostId,
          userId,
          content: createCommentDto.content,
          parentId: createCommentDto.parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          parent: createCommentDto.parentId
            ? {
                select: {
                  id: true,
                  content: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              }
            : undefined,
          _count: {
            select: {
              replies: true,
            },
          },
        },
      });

      this.logger.log(
        `Comment created: ${comment.id} on blog post ${blogPostId}`,
      );

      return {
        message: "Comment created successfully",
        data: comment,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all comments for a blog post
   */
  async findAll(blogPostId: string, page = 1, limit = 20) {
    try {
      const comments = await this.prisma.blogComment.findMany({
        where: {
          blogPostId,
          parentId: null, // Only get top-level comments
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      });

      const total = await this.prisma.blogComment.count({
        where: {
          blogPostId,
          parentId: null,
        },
      });

      return {
        data: comments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch comments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update a comment
   */
  async update(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
  ) {
    try {
      const comment = await this.prisma.blogComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException("Comment not found");
      }

      if (comment.userId !== userId) {
        throw new ForbiddenException("You can only edit your own comments");
      }

      const updatedComment = await this.prisma.blogComment.update({
        where: { id: commentId },
        data: {
          content: updateCommentDto.content,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      return {
        message: "Comment updated successfully",
        data: updatedComment,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  async remove(commentId: string, userId: string) {
    try {
      const comment = await this.prisma.blogComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException("Comment not found");
      }

      if (comment.userId !== userId) {
        throw new ForbiddenException("You can only delete your own comments");
      }

      await this.prisma.blogComment.delete({
        where: { id: commentId },
      });

      return {
        message: "Comment deleted successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
