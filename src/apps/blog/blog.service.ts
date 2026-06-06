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
import { Prisma, BlogPostStatus } from "@prisma/client";
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
    private readonly configurationService: ConfigurationService,
  ) {}

  /**
   * Get all blog categories
   */
  async findAllCategories() {
    return this.prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get all blog topics
   */
  async findAllTopics() {
    return this.prisma.blogTopic.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * Find all unique authors who have published blog posts
   */
  async findAllAuthors() {
    const posts = await this.prisma.blogPost.findMany({
      where: { status: "APPROVED", published: true },
      select: {
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

    const authors = posts.map((p) => p.author).filter((a) => !!a);

    // Filter unique authors by ID
    const uniqueAuthors = Array.from(
      new Map(authors.map((a) => [a!.id, a])).values(),
    );

    return uniqueAuthors;
  }

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
        subtitle: createBlogPostDto.subtitle,
        content: createBlogPostDto.content,
        excerpt: createBlogPostDto.excerpt,
        featuredImage: createBlogPostDto.featuredImage,
        layout: createBlogPostDto.layout || "STANDARD",
        badge: createBlogPostDto.badge,
        status: "PENDING", // Always starts as PENDING, needs admin approval
        published: createBlogPostDto.published || false,
        publishedAt: createBlogPostDto.published ? new Date() : null,
        isLive: createBlogPostDto.isLive || false,
        isBreaking: createBlogPostDto.isBreaking || false,
        isDrop: createBlogPostDto.isDrop || false,
        dropDate: createBlogPostDto.dropDate
          ? new Date(createBlogPostDto.dropDate)
          : null,
        mediaType: createBlogPostDto.mediaType || "IMAGE",
        videoUrl: createBlogPostDto.videoUrl,
        videoDuration: createBlogPostDto.videoDuration,
        priority: createBlogPostDto.priority || 0,
        locationTag: createBlogPostDto.locationTag,
        ctaText: createBlogPostDto.ctaText,
        ctaLink: createBlogPostDto.ctaLink,
        author: {
          connect: { id: user.id },
        },
      };

      // Connect category if provided
      if (createBlogPostDto.categoryId) {
        blogPostData.category = {
          connect: { id: createBlogPostDto.categoryId },
        };
      }

      // Connect topic if provided
      if (createBlogPostDto.topicId) {
        blogPostData.topic = { connect: { id: createBlogPostDto.topicId } };
      }

      // Connect featured artist if provided
      if (createBlogPostDto.featuredArtistId) {
        blogPostData.featuredArtist = {
          connect: { id: createBlogPostDto.featuredArtistId },
        };
      }

      // Connect related artworks if provided
      if (
        createBlogPostDto.relatedArtworkIds &&
        createBlogPostDto.relatedArtworkIds.length > 0
      ) {
        blogPostData.relatedArtworks = {
          create: createBlogPostDto.relatedArtworkIds.map((artworkId) => ({
            artwork: { connect: { id: artworkId } },
          })),
        };
      }

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
          category: true,
          topic: true,
          featuredArtist: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          relatedArtworks: {
            include: {
              artwork: true,
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
        blogPost.createdAt,
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
          blogPost.featuredImage || undefined,
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
        error.stack,
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
        categoryId,
        topicId,
        isBreaking,
        isLive,
        isDrop,
        minPriority,
      } = query;

      // Debug logging
      this.logger.debug(
        `Blog findAll - status: ${status}, authorId: ${authorId}, requestingUserId: ${requestingUserId}, published: ${published}`,
      );

      // Check user role for admin privileges
      const userRole = requestingUserId
        ? await this.prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { role: true },
          })
        : null;
      const isAdmin = userRole?.role?.toLowerCase() === "admin";

      // Check if user is viewing their own posts
      const isViewingOwnPosts =
        requestingUserId && authorId === requestingUserId;

      // Build where clause
      const where: Prisma.BlogPostWhereInput = {};

      // Handle visibility and status filtering
      if (isAdmin) {
        // Admins can see everything, but respect requested filters
        if (status) where.status = status;
        if (published !== undefined) where.published = published;
        if (authorId) where.authorId = authorId;
      } else if (requestingUserId && authorId === requestingUserId) {
        // Author viewing their own posts
        where.authorId = requestingUserId;
        if (status) where.status = status;
        if (published !== undefined) where.published = published;
      } else {
        // Public access - only show approved and published posts
        where.status = "APPROVED";
        where.published = true;
        if (authorId) where.authorId = authorId;
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
        ];
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (topicId) {
        where.topicId = topicId;
      }

      if (isBreaking !== undefined) {
        where.isBreaking = isBreaking;
      }

      if (isLive !== undefined) {
        where.isLive = isLive;
      }

      if (isDrop !== undefined) {
        where.isDrop = isDrop;
      }

      if (minPriority !== undefined) {
        where.priority = { gte: minPriority };
      }

      // Build orderBy - Always prioritize "priority" field, then publishedAt/createdAt
      const orderBy: Prisma.BlogPostOrderByWithRelationInput[] = [];

      // Priority always comes first
      orderBy.push({ priority: "desc" });

      if (sortBy === "createdAt") {
        if (isAdmin || isViewingOwnPosts) {
          // Internal view: sort by creation time so newest submissions are first
          orderBy.push({ createdAt: sortOrder });
        } else {
          // Public view: sort by publication time first, then creation time
          orderBy.push({ publishedAt: sortOrder });
          orderBy.push({ createdAt: sortOrder });
        }
      } else {
        const order: any = {};
        order[sortBy] = sortOrder;
        orderBy.push(order);
      }

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
          category: true,
          topic: true,
          featuredArtist: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          relatedArtworks: {
            include: {
              artwork: true,
            },
          },
        },
      });

      const totalPages = Math.ceil(total / limit);

      // Debug: Log results
      this.logger.debug(
        `Blog findAll results: ${blogPosts.length} posts found (total: ${total}), status filter was: ${status}`,
      );
      if (blogPosts.length > 0 && status) {
        this.logger.debug(
          `Sample post statuses: ${blogPosts.map((p) => p.status).join(", ")}`,
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
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all blog posts for admin (all statuses)
   */
  async findAllAdmin(query: BlogPostQueryDto, requestingUserId: string) {
    try {
      // Verify user is admin
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { role: true },
      });

      if (requestingUser?.role?.toLowerCase() !== "admin") {
        throw new ForbiddenException(
          "Only administrators can access this endpoint",
        );
      }

      const {
        page = BLOG_CONSTANTS.DEFAULT_PAGE,
        limit = BLOG_CONSTANTS.DEFAULT_LIMIT,
        published,
        search,
        authorId,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
        categoryId,
        topicId,
        isBreaking,
        isLive,
        isDrop,
        minPriority,
      } = query;

      const where: Prisma.BlogPostWhereInput = {};

      if (status) {
        where.status = status;
      }

      if (published !== undefined) {
        where.published = published;
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

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (topicId) {
        where.topicId = topicId;
      }

      if (isBreaking !== undefined) {
        where.isBreaking = isBreaking;
      }

      if (isLive !== undefined) {
        where.isLive = isLive;
      }

      if (isDrop !== undefined) {
        where.isDrop = isDrop;
      }

      if (minPriority !== undefined) {
        where.priority = { gte: minPriority };
      }

      const orderBy: Prisma.BlogPostOrderByWithRelationInput[] = [
        { priority: "desc" },
        { [sortBy]: sortOrder },
      ];

      const [total, blogPosts] = await Promise.all([
        this.prisma.blogPost.count({ where }),
        this.prisma.blogPost.findMany({
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
            category: true,
            topic: true,
            featuredArtist: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            relatedArtworks: {
              include: {
                artwork: true,
              },
            },
          },
        }),
      ]);

      return {
        data: blogPosts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch admin blog posts: ${error.message}`,
        error.stack,
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
          identifier,
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
          category: true,
          topic: true,
          featuredArtist: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          relatedArtworks: {
            include: {
              artwork: true,
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
        error.stack,
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
    userId: string,
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
            (1000 * 60 * 60 * 24),
        );

        if (daysSinceCreation > 7) {
          throw new ForbiddenException(
            "You can only edit your blog post within 7 days of creation",
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

      // Add new fields to updateData
      if (updateBlogPostDto.subtitle !== undefined)
        updateData.subtitle = updateBlogPostDto.subtitle;
      if (updateBlogPostDto.layout !== undefined)
        updateData.layout = updateBlogPostDto.layout;
      if (updateBlogPostDto.badge !== undefined)
        updateData.badge = updateBlogPostDto.badge;
      if (updateBlogPostDto.isLive !== undefined)
        updateData.isLive = updateBlogPostDto.isLive;
      if (updateBlogPostDto.isBreaking !== undefined)
        updateData.isBreaking = updateBlogPostDto.isBreaking;
      if (updateBlogPostDto.isDrop !== undefined)
        updateData.isDrop = updateBlogPostDto.isDrop;
      if (updateBlogPostDto.dropDate !== undefined) {
        updateData.dropDate = updateBlogPostDto.dropDate
          ? new Date(updateBlogPostDto.dropDate)
          : null;
      }
      if (updateBlogPostDto.mediaType !== undefined)
        updateData.mediaType = updateBlogPostDto.mediaType;
      if (updateBlogPostDto.videoUrl !== undefined)
        updateData.videoUrl = updateBlogPostDto.videoUrl;
      if (updateBlogPostDto.videoDuration !== undefined)
        updateData.videoDuration = updateBlogPostDto.videoDuration;
      if (updateBlogPostDto.priority !== undefined)
        updateData.priority = updateBlogPostDto.priority;
      if (updateBlogPostDto.locationTag !== undefined)
        updateData.locationTag = updateBlogPostDto.locationTag;
      if (updateBlogPostDto.ctaText !== undefined)
        updateData.ctaText = updateBlogPostDto.ctaText;
      if (updateBlogPostDto.ctaLink !== undefined)
        updateData.ctaLink = updateBlogPostDto.ctaLink;

      // Handle relations
      if (updateBlogPostDto.categoryId !== undefined) {
        if (updateBlogPostDto.categoryId === null) {
          updateData.category = { disconnect: true };
        } else {
          updateData.category = {
            connect: { id: updateBlogPostDto.categoryId },
          };
        }
      }

      if (updateBlogPostDto.topicId !== undefined) {
        if (updateBlogPostDto.topicId === null) {
          updateData.topic = { disconnect: true };
        } else {
          updateData.topic = { connect: { id: updateBlogPostDto.topicId } };
        }
      }

      if (updateBlogPostDto.featuredArtistId !== undefined) {
        if (updateBlogPostDto.featuredArtistId === null) {
          updateData.featuredArtist = { disconnect: true };
        } else {
          updateData.featuredArtist = {
            connect: { id: updateBlogPostDto.featuredArtistId },
          };
        }
      }

      if (updateBlogPostDto.relatedArtworkIds !== undefined) {
        updateData.relatedArtworks = {
          deleteMany: {},
          create: updateBlogPostDto.relatedArtworkIds.map((artworkId) => ({
            artwork: { connect: { id: artworkId } },
          })),
        };
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
        updatedPost.updatedAt,
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
          updatedPost.featuredImage || undefined,
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
        error.stack,
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
        new Date(),
      );
      await this.eventService.emit(BLOG_EVENTS.DELETED, event);

      return {
        message: BLOG_MESSAGES.DELETED,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete blog post: ${error.message}`,
        error.stack,
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
          "Only administrators can approve blog posts",
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
        userId,
      );
      await this.eventService.emit(BLOG_EVENTS.APPROVED, approvedEvent);

      return {
        message: "Blog post approved successfully",
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to approve blog post: ${error.message}`,
        error.stack,
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
          "Only administrators can reject blog posts",
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
        reason,
      );
      await this.eventService.emit(BLOG_EVENTS.REJECTED, rejectedEvent);

      return {
        message: "Blog post rejected",
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to reject blog post: ${error.message}`,
        error.stack,
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
        `Publish attempt - blogPostId: ${id}, userId: ${userId}, authorId: ${blogPost.authorId}, status: ${blogPost.status}`,
      );

      // Check if blog post is approved
      if (blogPost.status !== "APPROVED") {
        throw new BadRequestException(
          "Blog post must be approved before it can be published",
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
        `Publish check - isAdmin: ${isAdmin}, isAuthor: ${isAuthor}, authorId: ${blogPost.authorId}, userId: ${userId}`,
      );

      if (!isAdmin && !isAuthor) {
        throw new ForbiddenException(
          "You can only publish your own blog posts or you must be an administrator",
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
        updatedPost.featuredImage || undefined,
      );
      await this.eventService.emit(BLOG_EVENTS.PUBLISHED, publishedEvent);

      return {
        message: BLOG_MESSAGES.PUBLISHED,
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to publish blog post: ${error.message}`,
        error.stack,
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
          "You can only unpublish your own blog posts or you must be an administrator",
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
        new Date(),
      );
      await this.eventService.emit(BLOG_EVENTS.UNPUBLISHED, unpublishedEvent);

      return {
        message: BLOG_MESSAGES.UNPUBLISHED,
        data: updatedPost,
      };
    } catch (error) {
      this.logger.error(
        `Failed to unpublish blog post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
