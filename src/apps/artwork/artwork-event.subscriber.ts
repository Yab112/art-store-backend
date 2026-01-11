import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../libraries/email';
import {
  ARTWORK_EVENTS,
  ArtworkSubmittedEvent,
  ArtworkUpdatedEvent,
  ArtworkDeletedEvent,
  ArtworkApprovedEvent,
  ArtworkRejectedEvent,
  ArtworkSoldEvent,
  ArtworkWithdrawnEvent,
  ArtworkPriceUpdatedEvent,
  ArtworkViewedEvent,
  ArtworkCommentAddedEvent,
  ArtworkCommentUpdatedEvent,
  ArtworkCommentDeletedEvent,
  ArtworkLikedEvent,
  ArtworkUnlikedEvent,
} from './events';
import { ARTWORK_EMAIL_SUBJECTS } from './constants';

/**
 * Artwork Event Subscriber
 * Handles all artwork-related events and triggers appropriate actions
 */
@Injectable()
export class ArtworkEventSubscriber {
  private readonly logger = new Logger(ArtworkEventSubscriber.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Handle artwork submitted event
   * Send confirmation email to artist
   */
  @OnEvent(ARTWORK_EVENTS.SUBMITTED)
  async handleArtworkSubmitted(event: ArtworkSubmittedEvent) {
    try {
      this.logger.log(
        `Artwork submitted: ${event.artworkId} by ${event.userName}`,
      );

      // Prepare categories string for email template
      let categoriesString = 'Not specified';
      if (event.categories && Array.isArray(event.categories) && event.categories.length > 0) {
        categoriesString = event.categories.map(cat => cat.name).join(', ');
      }
      
      this.logger.log(
        `📧 Preparing email with categories: ${categoriesString}`
      );

      // Prepare all template variables
      const templateVariables: Record<string, string> = {
        artistName: event.userName || 'Unknown',
        artworkId: event.artworkId || '',
        artist: event.artist || 'Unknown',
        title: event.title || 'Untitled',
        desiredPrice: event.desiredPrice?.toString() || '0',
        photoCount: event.photos?.length?.toString() || '0',
        categories: categoriesString,
        submittedAt: event.submittedAt?.toISOString() || new Date().toISOString(),
      };
      
      this.logger.log(
        `📧 Template variables: ${JSON.stringify(Object.keys(templateVariables))}`
      );
      this.logger.log(
        `📧 Categories value: "${templateVariables.categories}"`
      );

      // Send confirmation email to artist
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: ARTWORK_EMAIL_SUBJECTS.SUBMITTED,
        template: 'artwork-submitted',
        variables: templateVariables,
      });

      this.logger.log(`Submission confirmation sent to ${event.userEmail}`);

      // TODO: Notify admin/moderators for review
      // TODO: Log analytics event
      // TODO: Create notification in database
    } catch (error) {
      this.logger.error('Failed to handle artwork submitted event:', error);
    }
  }

  /**
   * Handle artwork updated event
   * Send update confirmation if major changes
   */
  @OnEvent(ARTWORK_EVENTS.UPDATED)
  async handleArtworkUpdated(event: ArtworkUpdatedEvent) {
    try {
      this.logger.log(
        `Artwork updated: ${event.artworkId} - ${event.changes.length} changes`,
      );

      // Check if price was updated
      const priceChange = event.changes.find(
        (change) => change.field === 'desiredPrice',
      );

      if (priceChange) {
        await this.emailService.send({
          name: event.userName,
          email: event.userEmail,
          subject: ARTWORK_EMAIL_SUBJECTS.PRICE_UPDATE,
          template: 'artwork-price-updated',
          variables: {
            artistName: event.userName,
            artworkId: event.artworkId,
            oldPrice: priceChange.oldValue.toString(),
            newPrice: priceChange.newValue.toString(),
            updatedAt: event.updatedAt.toISOString(),
          },
        });
      }

      // TODO: Log activity
      // TODO: Notify followers if public artwork
    } catch (error) {
      this.logger.error('Failed to handle artwork updated event:', error);
    }
  }

  /**
   * Handle artwork deleted event
   * Send confirmation and cleanup
   */
  @OnEvent(ARTWORK_EVENTS.DELETED)
  async handleArtworkDeleted(event: ArtworkDeletedEvent) {
    try {
      this.logger.log(`Artwork deleted: ${event.artworkId}`);

      // Send deletion confirmation
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: ARTWORK_EMAIL_SUBJECTS.DELETED,
        template: 'artwork-deleted',
        variables: {
          artistName: event.userName,
          artworkId: event.artworkId,
          artist: event.artist,
          title: event.title || 'Untitled',
          deletedAt: event.deletedAt.toISOString(),
          reason: event.reason || 'User requested',
        },
      });

      this.logger.log(`Deletion confirmation sent to ${event.userEmail}`);

      // TODO: Remove from search index
      // TODO: Cancel any pending orders
      // TODO: Archive artwork data
    } catch (error) {
      this.logger.error('Failed to handle artwork deleted event:', error);
    }
  }

  /**
   * Handle artwork approved event
   * Send approval notification and publish artwork
   */
  @OnEvent(ARTWORK_EVENTS.APPROVED)
  async handleArtworkApproved(event: ArtworkApprovedEvent) {
    try {
      this.logger.log(
        `Artwork approved: ${event.artworkId} by ${event.approvedBy}`,
      );

      // Send approval email to artist
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: ARTWORK_EMAIL_SUBJECTS.APPROVED,
        template: 'artwork-approved',
        variables: {
          artistName: event.userName,
          artworkId: event.artworkId,
          artist: event.artist,
          title: event.title || 'Untitled',
          approvedAt: event.approvedAt.toISOString(),
          publicUrl:
            event.publicUrl ||
            `http://localhost:3000/artwork/${event.artworkId}`,
        },
      });

      this.logger.log(`Approval notification sent to ${event.userEmail}`);

      // TODO: Add to search index
      // TODO: Notify followers
      // TODO: Add to recommendation engine
      // TODO: Create system notification
    } catch (error) {
      this.logger.error('Failed to handle artwork approved event:', error);
    }
  }

  /**
   * Handle artwork rejected event
   * Send rejection notification with reason
   */
  @OnEvent(ARTWORK_EVENTS.REJECTED)
  async handleArtworkRejected(event: ArtworkRejectedEvent) {
    try {
      this.logger.log(
        `Artwork rejected: ${event.artworkId} by ${event.rejectedBy}`,
      );

      // Send rejection email with reason
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: ARTWORK_EMAIL_SUBJECTS.REJECTED,
        template: 'artwork-rejected',
        variables: {
          artistName: event.userName,
          artworkId: event.artworkId,
          artist: event.artist,
          title: event.title || 'Untitled',
          reason: event.reason,
          canResubmit: event.canResubmit ? 'Yes' : 'No',
          rejectedAt: event.rejectedAt.toISOString(),
        },
      });

      this.logger.log(`Rejection notification sent to ${event.userEmail}`);

      // TODO: Log moderation action
      // TODO: Create support ticket if dispute requested
    } catch (error) {
      this.logger.error('Failed to handle artwork rejected event:', error);
    }
  }

  /**
   * Handle artwork sold event
   * Send congratulations and process sale
   */
  @OnEvent(ARTWORK_EVENTS.SOLD)
  async handleArtworkSold(event: ArtworkSoldEvent) {
    try {
      this.logger.log(
        `Artwork sold: ${event.artworkId} for ${event.salePrice}`,
      );

      // Send congratulations email to seller
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: ARTWORK_EMAIL_SUBJECTS.SOLD,
        template: 'artwork-sold',
        variables: {
          artistName: event.userName,
          artworkId: event.artworkId,
          artist: event.artist,
          title: event.title || 'Untitled',
          salePrice: event.salePrice.toString(),
          soldAt: event.soldAt.toISOString(),
          transactionId: event.transactionId || 'N/A',
        },
      });

      this.logger.log(`Sale notification sent to ${event.userEmail}`);

      // TODO: Process payment to seller
      // TODO: Update inventory
      // TODO: Generate receipt
      // TODO: Notify buyer
      // TODO: Update analytics
    } catch (error) {
      this.logger.error('Failed to handle artwork sold event:', error);
    }
  }

  /**
   * Handle artwork withdrawn event
   * Confirm withdrawal and update listings
   */
  @OnEvent(ARTWORK_EVENTS.WITHDRAWN)
  async handleArtworkWithdrawn(event: ArtworkWithdrawnEvent) {
    try {
      this.logger.log(`Artwork withdrawn: ${event.artworkId}`);

      // Send withdrawal confirmation
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: 'Artwork Withdrawn',
        template: 'artwork-withdrawn',
        variables: {
          artistName: event.userName,
          artworkId: event.artworkId,
          artist: event.artist,
          title: event.title || 'Untitled',
          withdrawnAt: event.withdrawnAt.toISOString(),
          reason: event.reason || 'User requested',
        },
      });

      this.logger.log(`Withdrawal confirmation sent to ${event.userEmail}`);

      // TODO: Remove from public listings
      // TODO: Cancel pending negotiations
      // TODO: Update search index
    } catch (error) {
      this.logger.error('Failed to handle artwork withdrawn event:', error);
    }
  }

  /**
   * Handle price updated event
   * Notify interested buyers
   */
  @OnEvent(ARTWORK_EVENTS.PRICE_UPDATED)
  async handlePriceUpdated(event: ArtworkPriceUpdatedEvent) {
    try {
      this.logger.log(
        `Artwork price updated: ${event.artworkId} - ${event.oldPrice} -> ${event.newPrice}`,
      );

      // If price decreased, notify watchers
      if (event.newPrice < event.oldPrice) {
        // TODO: Notify users who favorited this artwork
        // TODO: Send price drop notifications
      }

      // TODO: Update search index with new price
      // TODO: Update recommendation scores
    } catch (error) {
      this.logger.error('Failed to handle price updated event:', error);
    }
  }

  /**
   * Handle artwork viewed event
   * Log analytics and track popularity
   */
  @OnEvent(ARTWORK_EVENTS.VIEWED)
  async handleArtworkViewed(event: ArtworkViewedEvent) {
    try {
      this.logger.debug(
        `Artwork viewed: ${event.artworkId} by ${event.viewerUserId || 'anonymous'}`,
      );

      // TODO: Log view in analytics database
      // TODO: Update view count
      // TODO: Track user browsing history
      // TODO: Update recommendation engine
    } catch (error) {
      this.logger.error('Failed to handle artwork viewed event:', error);
    }
  }

  // ==================== COMMENTS ====================

  /**
   * Handle comment added event
   * Send notification to artwork owner
   */
  @OnEvent(ARTWORK_EVENTS.COMMENT_ADDED)
  async handleCommentAdded(event: ArtworkCommentAddedEvent) {
    try {
      this.logger.log(
        `Comment added to artwork ${event.artworkId} by ${event.commenterName}`,
      );

      // Don't send email if the commenter is the artwork owner
      if (event.commenterUserId !== event.artworkOwnerId) {
        // Send notification email to artwork owner
        await this.emailService.send({
          name: event.artworkOwnerName,
          email: event.artworkOwnerEmail,
          subject: ARTWORK_EMAIL_SUBJECTS.COMMENT_RECEIVED,
          template: 'artwork-comment-received',
          variables: {
            artworkOwnerName: event.artworkOwnerName,
            artworkId: event.artworkId,
            artworkTitle: event.artworkTitle || 'Untitled',
            commenterName: event.commenterName,
            commenterAvatar: event.commenterAvatar || '',
            comment: event.comment,
            commentedAt: event.createdAt.toISOString(),
            artworkUrl: `http://localhost:3000/artwork/${event.artworkId}`,
          },
        });

        this.logger.log(
          `Comment notification sent to ${event.artworkOwnerEmail}`,
        );
      }

      // TODO: Create in-app notification
      // TODO: Notify other commenters (thread watchers)
      // TODO: Check for spam/inappropriate content
    } catch (error) {
      this.logger.error('Failed to handle comment added event:', error);
    }
  }

  /**
   * Handle comment updated event
   * Log the update
   */
  @OnEvent(ARTWORK_EVENTS.COMMENT_UPDATED)
  async handleCommentUpdated(event: ArtworkCommentUpdatedEvent) {
    try {
      this.logger.log(`Comment updated: ${event.commentId}`);

      // TODO: Log comment edit history
      // TODO: Check for spam/inappropriate content
      // TODO: Update moderation queue if needed
    } catch (error) {
      this.logger.error('Failed to handle comment updated event:', error);
    }
  }

  /**
   * Handle comment deleted event
   * Clean up and log
   */
  @OnEvent(ARTWORK_EVENTS.COMMENT_DELETED)
  async handleCommentDeleted(event: ArtworkCommentDeletedEvent) {
    try {
      this.logger.log(`Comment deleted: ${event.commentId}`);

      // TODO: Remove from search index
      // TODO: Update comment count
      // TODO: Log moderation action if deleted by moderator
    } catch (error) {
      this.logger.error('Failed to handle comment deleted event:', error);
    }
  }

  // ==================== LIKES ====================

  /**
   * Handle artwork liked event
   * Send notification to artwork owner
   */
  @OnEvent(ARTWORK_EVENTS.LIKED)
  async handleArtworkLiked(event: ArtworkLikedEvent) {
    try {
      this.logger.log(
        `Artwork liked: ${event.artworkId} by ${event.likerName} (Total: ${event.totalLikes})`,
      );

      // Don't send email if the liker is the artwork owner
      if (event.likerUserId !== event.artworkOwnerId) {
        // Send notification email to artwork owner
        await this.emailService.send({
          name: event.artworkOwnerName,
          email: event.artworkOwnerEmail,
          subject: ARTWORK_EMAIL_SUBJECTS.LIKE_RECEIVED,
          template: 'artwork-like-received',
          variables: {
            artworkOwnerName: event.artworkOwnerName,
            artworkId: event.artworkId,
            artworkTitle: event.artworkTitle || 'Untitled',
            likerName: event.likerName,
            likerAvatar: event.likerAvatar || '',
            totalLikes: event.totalLikes.toString(),
            likedAt: event.likedAt.toISOString(),
            artworkUrl: `http://localhost:3000/artwork/${event.artworkId}`,
          },
        });

        this.logger.log(`Like notification sent to ${event.artworkOwnerEmail}`);
      }

      // TODO: Create in-app notification
      // TODO: Update artwork popularity score
      // TODO: Trigger milestone notifications (e.g., 10, 50, 100 likes)
    } catch (error) {
      this.logger.error('Failed to handle artwork liked event:', error);
    }
  }

  /**
   * Handle artwork unliked event
   * Update analytics
   */
  @OnEvent(ARTWORK_EVENTS.UNLIKED)
  async handleArtworkUnliked(event: ArtworkUnlikedEvent) {
    try {
      this.logger.log(
        `Artwork unliked: ${event.artworkId} (Total: ${event.totalLikes})`,
      );

      // TODO: Update artwork popularity score
      // TODO: Log analytics
    } catch (error) {
      this.logger.error('Failed to handle artwork unliked event:', error);
    }
  }
}
