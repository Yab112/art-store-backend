import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { EventService } from "../../libraries/event";
import { ConfigurationService } from "../../core/configuration";
import { CreateBlogPostDto, UpdateBlogPostDto, BlogPostQueryDto } from "./dto";
import { Prisma } from "@prisma/client";
import {
  BLOG_EVENTS,
  BlogPostCreatedEvent,
  BlogPostUpdatedEvent,
  BlogPostDeletedEvent,
  BlogPostPublishedEvent,
  BlogPostUnpublishedEvent,
  BlogPostApprovedEvent,
  BlogPostRejectedEvent,
} from "./events";
import { BLOG_MESSAGES, BLOG_CONSTANTS } from "./constants";
import slugify from "slugify";

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly configurationService: ConfigurationService
  ) {}

  /**
   * Create a new blog post
   */
  async create(createBlogPostDto: CreateBlogPostDto, userId: string) {
    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      // Generate slug if not provided
      let slug = createBlogPostDto.slug;
      if (!slug) {
        slug = slugify(createBlogPostDto.title, { lower: true, strict: true });
      } else {
        slug = slugify(slug, { lower: true, strict: true });
      }

      // Check if slug already exists
      const existingPost = await this.prisma.blogPost.findUnique({
        where: { slug },
      });

      if (existingPost) {
        throw new BadRequestException(BLOG_MESSAGES.SLUG_EXISTS);
      }

      // Prepare blog post data
      // All users can create, but posts start as PENDING and need admin approval
      const blogPostData: Prisma.BlogPostCreateInput = {
        title: createBlogPostDto.title,
        slug,
        content: createBlogPostDto.content,
        excerpt: createBlogPostDto.excerpt,
        featuredImage: createBlogPostDto.featuredImage,
        status: "PENDING", // Always starts as PENDING, needs admin approval
        published: false, // Can't be published until approved
        publishedAt: null,
        author: {
          connect: { id: user.id },
        },
      };

      // Create blog post
      const blogPost = await this.prisma.blogPost.create({
        data: blogPostData,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      this.logger.log(`Blog post created: ${blogPost.id} by ${user.name}`);

      // Emit event
      const event = new BlogPostCreatedEvent(
        blogPost.id,
        blogPost.title,
        blogPost.slug,
        blogPost.authorId,
        user.name,
        user.email,
        blogPost.published,
        blogPost.createdAt
      );

      await this.eventService.emit(BLOG_EVENTS.CREATED, event);

      // If published, emit published event for email notifications
      if (blogPost.published) {
        const publishedEvent = new BlogPostPublishedEvent(
          blogPost.id,
          blogPost.title,
          blogPost.slug,
          blogPost.publishedAt!,
          blogPost.excerpt || undefined,
          blogPost.featuredImage || undefined
        );
        await this.eventService.emit(BLOG_EVENTS.PUBLISHED, publishedEvent);
      }

      return {
        message: BLOG_MESSAGES.CREATED,
        data: blogPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get all blog posts with pagination and filters
   */
  async findAll(query: BlogPostQueryDto, requestingUserId?: string) {
    try {
      const {
        page = BLOG_CONSTANTS.DEFAULT_PAGE,
        limit = BLOG_CONSTANTS.DEFAULT_LIMIT,
        published,
        search,
        authorId,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      // Debug logging
      this.logger.debug(
        `Blog findAll - status: ${status}, authorId: ${authorId}, requestingUserId: ${requestingUserId}, published: ${published}`
      );

      // Build where clause
      const where: Prisma.BlogPostWhereInput = {};

      // Check if user is viewing their own posts
      const isViewingOwnPosts =
        requestingUserId && authorId === requestingUserId;

      // Only show approved and published posts to non-admins
      // BUT: Allow users to see ALL their own posts (including PENDING/REJECTED)
      // Admins can see all statuses
      if (requestingUserId) {
        const requestingUser = await this.prisma.user.findUnique({
          where: { id: requestingUserId },
          select: { role: true },
        });

        const isAdmin =
          requestingUser && requestingUser.role?.toLowerCase() === "admin";

        if (!isAdmin && !isViewingOwnPosts) {
          // Regular user viewing other people's posts - only show approved and published
          where.status = "APPROVED";
          where.published = true;
        } else if (!isAdmin && isViewingOwnPosts) {
          // Regular user viewing their own posts - show all statuses
          // Apply status filter if provided (this takes priority)
          if (status) {
            where.status = status as Prisma.EnumBlogPostStatusFilter;
            this.logger.debug(
              `Applied status filter for own posts: ${status}, type: ${typeof status}`
            );
          }
          // Apply published filter if provided
          if (published !== undefined) {
            where.published = published;
          }
        } else if (!isAdmin && authorId && !isViewingOwnPosts) {
          // User is authenticated but viewing someone else's posts
          // Only show APPROVED and published posts
          where.status = "APPROVED";
          where.published = true;
        } else if (isAdmin) {
          // Admin can see everything - apply filters if provided
          if (status) {
            where.status = status as Prisma.EnumBlogPostStatusFilter;
          }
          if (published !== undefined) {
            where.published = published;
          }
        }
      } else {
        // Public access - only show approved and published posts
        where.status = "APPROVED";
        where.published = true;
      }

      if (authorId) {
        where.authorId = authorId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
        ];
      }

      // Build orderBy
      const orderBy: Prisma.BlogPostOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      // Debug: Log the where clause before query
      this.logger.debug(`Blog findAll where clause: ${JSON.stringify(where)}`);

      // Get total count
      const total = await this.prisma.blogPost.count({ where });

      // Get blog posts
      const blogPosts = await this.prisma.blogPost.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(total / limit);

      // Debug: Log results
      this.logger.debug(
        `Blog findAll results: ${blogPosts.length} posts found (total: ${total}), status filter was: ${status}`
      );
      if (blogPosts.length > 0 && status) {
        this.logger.debug(
          `Sample post statuses: ${blogPosts.map((p) => p.status).join(", ")}`
        );
      }

      return {
        data: blogPosts,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch blog posts: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Get a single blog post by ID or slug
   */
  async findOne(identifier: string, incrementViews = false) {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          identifier
        );

      const where = isUuid ? { id: identifier } : { slug: identifier };

      const blogPost = await this.prisma.blogPost.findUnique({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      if (!blogPost) {
        throw new NotFoundException(BLOG_MESSAGES.NOT_FOUND);
      }

      // Increment views if requested
      if (incrementViews) {
        await this.prisma.blogPost.update({
          where: { id: blogPost.id },
          data: { views: { increment: 1 } },
        });
        blogPost.views += 1;
      }

      return blogPost;
    } catch (error) {
      this.logger.error(
        `Failed to fetch blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Update a blog post
   */
  async update(
    id: string,
    updateBlogPostDto: UpdateBlogPostDto,
    userId: string
  ) {
    try {
      // Check if blog post exists
      const existingPost = await this.prisma.blogPost.findUnique({
        where: { id },
        include: { author: true },
      });

      if (!existingPost) {
        throw new NotFoundException(BLOG_MESSAGES.NOT_FOUND);
      }

      // Check if user is the author
      if (existingPost.authorId !== userId) {
        // Check if user is admin
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });

        if (user?.role?.toLowerCase() !== "admin") {
          throw new ForbiddenException(BLOG_MESSAGES.FORBIDDEN);
        }
      } else {
        // Author can only edit within 7 days of creation
        const daysSinceCreation = Math.floor(
          (Date.now() - existingPost.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysSinceCreation > 7) {
          throw new ForbiddenException(
            "You can only edit your blog post within 7 days of creation"
          );
        }
      }

      // Handle slug update
      let slug = existingPost.slug;
      if (
        updateBlogPostDto.slug &&
        updateBlogPostDto.slug !== existingPost.slug
      ) {
        slug = slugify(updateBlogPostDto.slug, { lower: true, strict: true });
        // Check if new slug exists
        const slugExists = await this.prisma.blogPost.findUnique({
          where: { slug },
        });
        if (slugExists && slugExists.id !== id) {
          throw new BadRequestException(BLOG_MESSAGES.SLUG_EXISTS);
        }
      } else if (
        updateBlogPostDto.title &&
        updateBlogPostDto.title !== existingPost.title
      ) {
        // Auto-generate slug from title if title changed and slug not provided
        slug = slugify(updateBlogPostDto.title, { lower: true, strict: true });
        const slugExists = await this.prisma.blogPost.findUnique({
          where: { slug },
        });
        if (slugExists && slugExists.id !== id) {
          // Append timestamp if slug exists
          slug = `${slug}-${Date.now()}`;
        }
      }

      // Prepare update data
      const updateData: Prisma.BlogPostUpdateInput = {};

      if (updateBlogPostDto.title !== undefined) {
        updateData.title = updateBlogPostDto.title;
      }
      if (slug !== existingPost.slug) {
        updateData.slug = slug;
      }
      if (updateBlogPostDto.content !== undefined) {
        updateData.content = updateBlogPostDto.content;
      }
      if (updateBlogPostDto.excerpt !== undefined) {
        updateData.excerpt = updateBlogPostDto.excerpt;
      }
      if (updateBlogPostDto.featuredImage !== undefined) {
        updateData.featuredImage = updateBlogPostDto.featuredImage;
      }

      // Handle publish status change
      const wasPublished = existingPost.published;
      if (updateBlogPostDto.published !== undefined) {
        updateData.published = updateBlogPostDto.published;
        if (updateBlogPostDto.published && !wasPublished) {
          // Publishing for the first time
          updateData.publishedAt = new Date();
        } else if (!updateBlogPostDto.published && wasPublished) {
          // Unpublishing
          updateData.publishedAt = null;
        }
      }

      // Update blog post and set editedAt timestamp
      const updatedPost = await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...updateData,
          editedAt: new Date(), // Track edit timestamp
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      this.logger.log(`Blog post updated: ${id}`);

      // Emit update event
      const event = new BlogPostUpdatedEvent(
        updatedPost.id,
        updatedPost.title,
        updatedPost.slug,
        updatedPost.authorId,
        updatedPost.published,
        updatedPost.updatedAt
      );
      await this.eventService.emit(BLOG_EVENTS.UPDATED, event);

      // If just published, emit published event
      if (updateBlogPostDto.published && !wasPublished) {
        const publishedEvent = new BlogPostPublishedEvent(
          updatedPost.id,
          updatedPost.title,
          updatedPost.slug,
          updatedPost.publishedAt!,
          updatedPost.excerpt || undefined,
          updatedPost.featuredImage || undefined
        );
        await this.eventService.emit(BLOG_EVENTS.PUBLISHED, publishedEvent);
      }

      return {
        message: BLOG_MESSAGES.UPDATED,
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Delete a blog post
   */
  async remove(id: string, userId: string) {
    try {
      // Check if blog post exists
      const existingPost = await this.prisma.blogPost.findUnique({
        where: { id },
        include: { author: true },
      });

      if (!existingPost) {
        throw new NotFoundException(BLOG_MESSAGES.NOT_FOUND);
      }

      // Only author can delete their own posts (no admin required)
      if (existingPost.authorId !== userId) {
        throw new ForbiddenException("You can only delete your own blog posts");
      }

      // Delete blog post
      await this.prisma.blogPost.delete({
        where: { id },
      });

      this.logger.log(`Blog post deleted: ${id}`);

      // Emit delete event
      const event = new BlogPostDeletedEvent(
        id,
        existingPost.title,
        existingPost.authorId,
        new Date()
      );
      await this.eventService.emit(BLOG_EVENTS.DELETED, event);

      return {
        message: BLOG_MESSAGES.DELETED,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Approve a blog post (admin only)
   */
  async approve(id: string, userId: string) {
    try {
      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role?.toLowerCase() !== "admin") {
        throw new ForbiddenException(
          "Only administrators can approve blog posts"
        );
      }

      const blogPost = await this.findOne(id);

      if (blogPost.status === "APPROVED") {
        throw new BadRequestException("Blog post is already approved");
      }

      const updatedPost = await this.prisma.blogPost.update({
        where: { id },
        data: {
          status: "APPROVED",
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Emit approved event for email notifications
      const approvedEvent = new BlogPostApprovedEvent(
        updatedPost.id,
        updatedPost.title,
        updatedPost.slug,
        updatedPost.authorId,
        updatedPost.author.name || "User",
        updatedPost.author.email,
        new Date(),
        userId
      );
      await this.eventService.emit(BLOG_EVENTS.APPROVED, approvedEvent);

      return {
        message: "Blog post approved successfully",
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to approve blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Reject a blog post (admin only)
   */
  async reject(id: string, userId: string, reason?: string) {
    try {
      // Check if user is admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role?.toLowerCase() !== "admin") {
        throw new ForbiddenException(
          "Only administrators can reject blog posts"
        );
      }

      const blogPost = await this.findOne(id);

      const updatedPost = await this.prisma.blogPost.update({
        where: { id },
        data: {
          status: "REJECTED",
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Emit rejected event for email notifications
      const rejectedEvent = new BlogPostRejectedEvent(
        updatedPost.id,
        updatedPost.title,
        updatedPost.slug,
        updatedPost.authorId,
        updatedPost.author.name || "User",
        updatedPost.author.email,
        new Date(),
        userId,
        reason
      );
      await this.eventService.emit(BLOG_EVENTS.REJECTED, rejectedEvent);

      return {
        message: "Blog post rejected",
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to reject blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Publish a blog post (users can publish their own approved posts, admins can publish any approved post)
   */
  async publish(id: string, userId: string) {
    try {
      const blogPost = await this.findOne(id);

      // Debug logging
      this.logger.debug(
        `Publish attempt - blogPostId: ${id}, userId: ${userId}, authorId: ${blogPost.authorId}, status: ${blogPost.status}`
      );

      // Check if blog post is approved
      if (blogPost.status !== "APPROVED") {
        throw new BadRequestException(
          "Blog post must be approved before it can be published"
        );
      }

      // Check if user is admin or the author of the blog post
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const isAdmin = user?.role?.toLowerCase() === "admin";
      const isAuthor = blogPost.authorId === userId;

      this.logger.debug(
        `Publish check - isAdmin: ${isAdmin}, isAuthor: ${isAuthor}, authorId: ${blogPost.authorId}, userId: ${userId}`
      );

      if (!isAdmin && !isAuthor) {
        throw new ForbiddenException(
          "You can only publish your own blog posts or you must be an administrator"
        );
      }

      const updatedPost = await this.prisma.blogPost.update({
        where: { id },
        data: {
          published: true,
          publishedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Emit published event for email notifications
      const publishedEvent = new BlogPostPublishedEvent(
        updatedPost.id,
        updatedPost.title,
        updatedPost.slug,
        updatedPost.publishedAt!,
        updatedPost.excerpt || undefined,
        updatedPost.featuredImage || undefined
      );
      await this.eventService.emit(BLOG_EVENTS.PUBLISHED, publishedEvent);

      return {
        message: BLOG_MESSAGES.PUBLISHED,
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to publish blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Unpublish a blog post (users can unpublish their own posts, admins can unpublish any post)
   */
  async unpublish(id: string, userId: string) {
    try {
      const blogPost = await this.findOne(id);

      // Check if user is admin or the author of the blog post
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const isAdmin = user?.role?.toLowerCase() === "admin";
      const isAuthor = blogPost.authorId === userId;

      if (!isAdmin && !isAuthor) {
        throw new ForbiddenException(
          "You can only unpublish your own blog posts or you must be an administrator"
        );
      }

      const updatedPost = await this.prisma.blogPost.update({
        where: { id },
        data: {
          published: false,
          publishedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });

      // Emit unpublished event for email notifications
      const unpublishedEvent = new BlogPostUnpublishedEvent(
        updatedPost.id,
        updatedPost.title,
        updatedPost.slug,
        updatedPost.authorId,
        updatedPost.author.name || "User",
        updatedPost.author.email,
        new Date()
      );
      await this.eventService.emit(BLOG_EVENTS.UNPUBLISHED, unpublishedEvent);

      return {
        message: BLOG_MESSAGES.UNPUBLISHED,
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to unpublish blog post: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
