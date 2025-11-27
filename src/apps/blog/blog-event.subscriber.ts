import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../libraries/email';
import { PrismaService } from '../../core/database';
import { ConfigurationService } from '../../core/configuration';
import {
  BLOG_EVENTS,
  BlogPostPublishedEvent,
  BlogPostCreatedEvent,
  BlogPostUpdatedEvent,
  BlogPostDeletedEvent,
  BlogPostUnpublishedEvent,
  BlogPostApprovedEvent,
  BlogPostRejectedEvent,
} from './events';
import { BLOG_EMAIL_SUBJECTS } from './constants';

/**
 * Blog Event Subscriber
 * Handles all blog-related events and triggers appropriate actions
 */
@Injectable()
export class BlogEventSubscriber {
  private readonly logger = new Logger(BlogEventSubscriber.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configurationService: ConfigurationService,
  ) {}

  /**
   * Handle blog post created event
   * Send email notification to author
   */
  @OnEvent(BLOG_EVENTS.CREATED)
  async handleBlogPostCreated(event: BlogPostCreatedEvent) {
    try {
      this.logger.log(
        `Blog post created: ${event.blogPostId} - ${event.title} by ${event.authorName}`,
      );

      const baseUrl = this.configurationService.getServerBaseUrl();
      const blogPostUrl = `${baseUrl}/blog/${event.slug}`;

      await this.emailService.send({
        name: event.authorName,
        email: event.authorEmail,
        subject: BLOG_EMAIL_SUBJECTS.POST_CREATED.replace('{{title}}', event.title),
        template: 'blog-post-created',
        variables: {
          userName: event.authorName,
          blogTitle: event.title,
          blogPostUrl: blogPostUrl,
          createdAt: event.createdAt.toISOString(),
          status: event.published ? 'Published' : 'Pending Approval',
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send creation email to ${event.authorEmail}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post creation email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post created event:',
        error,
      );
    }
  }

  /**
   * Handle blog post updated event
   * Send email notification to author
   */
  @OnEvent(BLOG_EVENTS.UPDATED)
  async handleBlogPostUpdated(event: BlogPostUpdatedEvent) {
    try {
      this.logger.log(
        `Blog post updated: ${event.blogPostId} - ${event.title}`,
      );

      // Get author information
      const author = await this.prisma.user.findUnique({
        where: { id: event.authorId },
        select: { name: true, email: true },
      });

      if (!author) {
        this.logger.warn(`Author not found for blog post ${event.blogPostId}`);
        return;
      }

      const baseUrl = this.configurationService.getServerBaseUrl();
      const blogPostUrl = `${baseUrl}/blog/${event.slug}`;

      await this.emailService.send({
        name: author.name || 'User',
        email: author.email,
        subject: BLOG_EMAIL_SUBJECTS.POST_UPDATED.replace('{{title}}', event.title),
        template: 'blog-post-updated',
        variables: {
          userName: author.name || 'User',
          blogTitle: event.title,
          blogPostUrl: blogPostUrl,
          updatedAt: event.updatedAt.toISOString(),
          published: event.published ? 'Yes' : 'No',
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send update email to ${author.email}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post update email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post updated event:',
        error,
      );
    }
  }

  /**
   * Handle blog post deleted event
   * Send email notification to author
   */
  @OnEvent(BLOG_EVENTS.DELETED)
  async handleBlogPostDeleted(event: BlogPostDeletedEvent) {
    try {
      this.logger.log(
        `Blog post deleted: ${event.blogPostId} - ${event.title}`,
      );

      // Get author information
      const author = await this.prisma.user.findUnique({
        where: { id: event.authorId },
        select: { name: true, email: true },
      });

      if (!author) {
        this.logger.warn(`Author not found for blog post ${event.blogPostId}`);
        return;
      }

      await this.emailService.send({
        name: author.name || 'User',
        email: author.email,
        subject: BLOG_EMAIL_SUBJECTS.POST_DELETED.replace('{{title}}', event.title),
        template: 'blog-post-deleted',
        variables: {
          userName: author.name || 'User',
          blogTitle: event.title,
          deletedAt: event.deletedAt.toISOString(),
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send deletion email to ${author.email}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post deletion email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post deleted event:',
        error,
      );
    }
  }

  /**
   * Handle blog post approved event
   * Send email notification to author
   */
  @OnEvent(BLOG_EVENTS.APPROVED)
  async handleBlogPostApproved(event: BlogPostApprovedEvent) {
    try {
      this.logger.log(
        `Blog post approved: ${event.blogPostId} - ${event.title}`,
      );

      const baseUrl = this.configurationService.getServerBaseUrl();
      const blogPostUrl = `${baseUrl}/blog/${event.slug}`;

      await this.emailService.send({
        name: event.authorName,
        email: event.authorEmail,
        subject: BLOG_EMAIL_SUBJECTS.POST_APPROVED.replace('{{title}}', event.title),
        template: 'blog-post-approved',
        variables: {
          userName: event.authorName,
          blogTitle: event.title,
          blogPostUrl: blogPostUrl,
          approvedAt: event.approvedAt.toISOString(),
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send approval email to ${event.authorEmail}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post approval email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post approved event:',
        error,
      );
    }
  }

  /**
   * Handle blog post rejected event
   * Send email notification to author with rejection reason
   */
  @OnEvent(BLOG_EVENTS.REJECTED)
  async handleBlogPostRejected(event: BlogPostRejectedEvent) {
    try {
      this.logger.log(
        `Blog post rejected: ${event.blogPostId} - ${event.title}`,
      );

      await this.emailService.send({
        name: event.authorName,
        email: event.authorEmail,
        subject: BLOG_EMAIL_SUBJECTS.POST_REJECTED.replace('{{title}}', event.title),
        template: 'blog-post-rejected',
        variables: {
          userName: event.authorName,
          blogTitle: event.title,
          rejectedAt: event.rejectedAt.toISOString(),
          reason: event.reason || 'No reason provided',
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send rejection email to ${event.authorEmail}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post rejection email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post rejected event:',
        error,
      );
    }
  }

  /**
   * Handle blog post unpublished event
   * Send email notification to author
   */
  @OnEvent(BLOG_EVENTS.UNPUBLISHED)
  async handleBlogPostUnpublished(event: BlogPostUnpublishedEvent) {
    try {
      this.logger.log(
        `Blog post unpublished: ${event.blogPostId} - ${event.title}`,
      );

      await this.emailService.send({
        name: event.authorName,
        email: event.authorEmail,
        subject: BLOG_EMAIL_SUBJECTS.POST_UNPUBLISHED.replace('{{title}}', event.title),
        template: 'blog-post-unpublished',
        variables: {
          userName: event.authorName,
          blogTitle: event.title,
          unpublishedAt: event.unpublishedAt.toISOString(),
        },
      }).catch((error) => {
        this.logger.error(
          `Failed to send unpublish email to ${event.authorEmail}: ${error.message}`,
        );
      });

      this.logger.log(`Blog post unpublish email sent to author`);
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post unpublished event:',
        error,
      );
    }
  }

  /**
   * Handle blog post published event
   * Send email notifications to all subscribed users
   */
  @OnEvent(BLOG_EVENTS.PUBLISHED)
  async handleBlogPostPublished(event: BlogPostPublishedEvent) {
    try {
      this.logger.log(
        `Blog post published: ${event.blogPostId} - ${event.title}`,
      );

      // Get all users who have email subscription enabled
      const subscribedUsers = await this.prisma.user.findMany({
        where: {
          emailSubscription: true,
          emailVerified: true, // Only send to verified emails
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      this.logger.log(
        `Found ${subscribedUsers.length} subscribed users to notify`,
      );

      // Get the base URL for the blog post link
      const baseUrl = this.configurationService.getServerBaseUrl();
      const blogPostUrl = `${baseUrl}/blog/${event.slug}`;

      // Send email to each subscribed user
      const emailPromises = subscribedUsers.map((user) =>
        this.emailService.send({
          name: user.name,
          email: user.email,
          subject: BLOG_EMAIL_SUBJECTS.NEW_POST.replace('{{title}}', event.title),
          template: 'blog-post-published',
          variables: {
            userName: user.name,
            blogTitle: event.title,
            blogExcerpt: event.excerpt || 'Read our latest blog post!',
            blogPostUrl: blogPostUrl,
            featuredImage: event.featuredImage || '',
            publishedAt: event.publishedAt.toISOString(),
          },
        }).catch((error) => {
          // Log error but don't fail the entire process
          this.logger.error(
            `Failed to send email to ${user.email}: ${error.message}`,
          );
          return null;
        }),
      );

      // Wait for all emails to be sent (or fail gracefully)
      const results = await Promise.allSettled(emailPromises);
      
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(
        `Blog post notification emails sent: ${successful} successful, ${failed} failed`,
      );

      // TODO: Log analytics event
      // TODO: Create notifications in database for users
    } catch (error) {
      this.logger.error(
        'Failed to handle blog post published event:',
        error,
      );
    }
  }
}

