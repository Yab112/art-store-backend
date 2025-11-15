import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../libraries/email';
import {
  COLLECTION_EVENTS,
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  CollectionDeletedEvent,
  CollectionPublishedEvent,
  CollectionUnpublishedEvent,
  CollectionFeaturedEvent,
  ArtworkAddedToCollectionEvent, 
  ArtworksBulkAddedEvent,
} from './events';
import { COLLECTION_EMAIL_SUBJECTS } from './constants';  

/**
 * Collection Event Subscriber
 * Handles all collection-related events and triggers appropriate actions
 */
@Injectable()
export class CollectionsEventSubscriber {
  private readonly logger = new Logger(CollectionsEventSubscriber.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Handle collection created event
   */
  @OnEvent(COLLECTION_EVENTS.CREATED)
  async handleCollectionCreated(event: CollectionCreatedEvent) {
    try {
      this.logger.log(
        `Collection created: ${event.collectionId} by ${event.userName}`,
      );

      // Send confirmation email
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: COLLECTION_EMAIL_SUBJECTS.CREATED,
        template: 'collection-created',
        variables: {
          userName: event.userName,
          collectionId: event.collectionId,
          collectionName: event.name,
          description: event.description || 'No description',
          visibility: event.visibility,
          createdAt: event.createdAt.toISOString(),
        },
      });

      this.logger.log(
        `Collection creation confirmation sent to ${event.userEmail}`,
      );

      // TODO: Log analytics
      // TODO: Create notification
    } catch (error) {
      this.logger.error('Failed to handle collection created event:', error);
    }
  }

  /**
   * Handle collection updated event
   */
  @OnEvent(COLLECTION_EVENTS.UPDATED)
  async handleCollectionUpdated(event: CollectionUpdatedEvent) {
    try {
      this.logger.log(
        `Collection updated: ${event.collectionId} - ${event.changes.length} changes`,
      );

      // TODO: Log activity
      // TODO: Notify followers if visibility changed to public
    } catch (error) {
      this.logger.error('Failed to handle collection updated event:', error);
    }
  }

  /**
   * Handle collection deleted event
   */
  @OnEvent(COLLECTION_EVENTS.DELETED)
  async handleCollectionDeleted(event: CollectionDeletedEvent) {
    try {
      this.logger.log(`Collection deleted: ${event.collectionId}`);

      // Send deletion confirmation
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: 'Collection Deleted',
        template: 'collection-deleted',
        variables: {
          userName: event.userName,
          collectionId: event.collectionId,
          collectionName: event.name,
          artworkCount: event.artworkCount.toString(),
          deletedAt: event.deletedAt.toISOString(),
        },
      });

      this.logger.log(
        `Collection deletion confirmation sent to ${event.userEmail}`,
      );

      // TODO: Remove from search index
      // TODO: Archive data
    } catch (error) {
      this.logger.error('Failed to handle collection deleted event:', error);
    }
  }

  /**
   * Handle collection published event
   */
  @OnEvent(COLLECTION_EVENTS.PUBLISHED)
  async handleCollectionPublished(event: CollectionPublishedEvent) {
    try {
      this.logger.log(`Collection published: ${event.collectionId}`);

      // Send publication confirmation
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: COLLECTION_EMAIL_SUBJECTS.PUBLISHED,
        template: 'collection-published',
        variables: {
          userName: event.userName,
          collectionName: event.name,
          description: event.description || 'No description',
          artworkCount: event.artworkCount.toString(),
          publicUrl: event.publicUrl,
          publishedAt: event.publishedAt.toISOString(),
        },
      });

      this.logger.log(
        `Collection publication notification sent to ${event.userEmail}`,
      );

      // TODO: Add to search index
      // TODO: Notify followers
      // TODO: Add to recommendations
    } catch (error) {
      this.logger.error('Failed to handle collection published event:', error);
    }
  }

  /**
   * Handle collection unpublished event
   */
  @OnEvent(COLLECTION_EVENTS.UNPUBLISHED)
  async handleCollectionUnpublished(event: CollectionUnpublishedEvent) {
    try {
      this.logger.log(`Collection unpublished: ${event.collectionId}`);

      // TODO: Remove from search index
      // TODO: Update recommendations
    } catch (error) {
      this.logger.error(
        'Failed to handle collection unpublished event:',
        error,
      );
    }
  }

  /**
   * Handle collection featured event
   */
  @OnEvent(COLLECTION_EVENTS.FEATURED)
  async handleCollectionFeatured(event: CollectionFeaturedEvent) {
    try {
      this.logger.log(
        `Collection featured: ${event.collectionId} by ${event.featuredBy}`,
      );

      // Send featured notification
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: COLLECTION_EMAIL_SUBJECTS.FEATURED,
        template: 'collection-featured',
        variables: {
          userName: event.userName,
          collectionName: event.name,
          publicUrl: event.publicUrl,
          featuredAt: event.featuredAt.toISOString(),
        },
      });

      this.logger.log(
        `Collection featured notification sent to ${event.userEmail}`,
      );

      // TODO: Add to featured collections list
      // TODO: Send push notification
    } catch (error) {
      this.logger.error('Failed to handle collection featured event:', error);
    }
  }

  /**
   * Handle artwork added to collection event
   */
  @OnEvent(COLLECTION_EVENTS.ARTWORK_ADDED)
  async handleArtworkAdded(event: ArtworkAddedToCollectionEvent) {
    try {
      this.logger.log(
        `Artwork ${event.artworkId} added to collection ${event.collectionId}`,
      );

      // Send artwork added notification
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: COLLECTION_EMAIL_SUBJECTS.ARTWORK_ADDED,
        template: 'artwork-added-to-collection',
        variables: {
          userName: event.userName,
          collectionName: event.collectionName,
          artworkTitle: event.artworkTitle || 'Untitled',
          artworkArtist: event.artworkArtist,
          artworkPhotoUrl: event.artworkPhotoUrl || '',
          addedAt: event.addedAt.toISOString(),
        },
      });

      this.logger.log(`Artwork added notification sent to ${event.userEmail}`);

      // TODO: Update collection cover if first artwork
      // TODO: Notify collection followers
    } catch (error) {
      this.logger.error('Failed to handle artwork added event:', error);
    }
  }

  /**
   * Handle bulk artworks added event
   */
  @OnEvent(COLLECTION_EVENTS.ARTWORKS_BULK_ADDED)
  async handleArtworksBulkAdded(event: ArtworksBulkAddedEvent) {
    try {
      this.logger.log(
        `${event.artworkCount} artworks added to collection ${event.collectionId}`,
      );

      // Send bulk add notification
      await this.emailService.send({
        name: event.userName,
        email: event.userEmail,
        subject: 'Multiple Artworks Added to Collection',
        template: 'artworks-bulk-added',
        variables: {
          userName: event.userName,
          collectionName: event.collectionName,
          artworkCount: event.artworkCount.toString(),
          addedAt: event.addedAt.toISOString(),
        },
      });

      // TODO: Update collection statistics
    } catch (error) {
      this.logger.error('Failed to handle bulk artworks added event:', error);
    }
  }

  /**
   * Handle collection viewed event
   */
  @OnEvent(COLLECTION_EVENTS.VIEWED)
  async handleCollectionViewed(event: any) {
    try {
      this.logger.debug(
        `Collection ${event.collectionId} viewed by ${event.viewerUserId || 'anonymous'}`,
      );

      // TODO: Log analytics
      // TODO: Update view count
      // TODO: Track popular collections
    } catch (error) {
      this.logger.error('Failed to handle collection viewed event:', error);
    }
  }
}
