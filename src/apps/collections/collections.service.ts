import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { EventService } from '../../libraries/event';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddArtworkDto,
  AddArtworksDto,
} from './dto';
import {
  COLLECTION_EVENTS,
  CollectionCreatedEvent,
  CollectionUpdatedEvent,
  CollectionDeletedEvent,
  CollectionPublishedEvent,
  CollectionUnpublishedEvent,
  ArtworkAddedToCollectionEvent,
  ArtworkRemovedFromCollectionEvent,
  ArtworksBulkAddedEvent,
} from './events';
import { COLLECTION_CONSTANTS, COLLECTION_MESSAGES } from './constants';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  /**
   * Create a new collection
   */
  async create(createCollectionDto: CreateCollectionDto, userId: string) {
    try {
      // Check if user has reached max collections
      const userCollectionsCount = await this.prisma.collection.count({
        where: { createdBy: userId },
      });

      if (
        userCollectionsCount >= COLLECTION_CONSTANTS.MAX_COLLECTIONS_PER_USER
      ) {
        throw new BadRequestException(
          COLLECTION_MESSAGES.ERROR.MAX_COLLECTIONS_REACHED,
        );
      }

      // Get user details for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const collection = await this.prisma.collection.create({
        data: {
          name: createCollectionDto.name,
          description: createCollectionDto.description,
          coverImage: createCollectionDto.coverImage,
          visibility:
            createCollectionDto.visibility ||
            COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
          createdBy: userId,
        },
      });

      // Emit collection created event
      await this.eventService.emit<CollectionCreatedEvent>(
        COLLECTION_EVENTS.CREATED,
        {
          collectionId: collection.id,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          name: collection.name,
          description: collection.description,
          visibility:
            collection.visibility || COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
          createdAt: new Date(),
        },
      );

      this.logger.log(`Collection created: ${collection.id}`);
      return collection;
    } catch (error) {
      this.logger.error('Failed to create collection:', error);
      throw error;
    }
  }

  /**
   * Find all public collections with pagination
   */
  async findAll(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [collections, total] = await Promise.all([
        this.prisma.collection.findMany({
          where: {
            visibility: COLLECTION_CONSTANTS.VISIBILITY.PUBLIC,
          },
          skip,
          take: limit,
          include: {
            artworks: {
              select: {
                artwork: {
                  select: {
                    id: true,
                    title: true,
                    artist: true,
                    photos: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.collection.count({
          where: {
            visibility: COLLECTION_CONSTANTS.VISIBILITY.PUBLIC,
          },
        }),
      ]);

      // Transform to include artwork count
      const collectionsWithCount = collections.map((collection) => ({
        ...collection,
        artworkCount: collection.artworks.length,
      }));

      return {
        collections: collectionsWithCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch collections:', error);
      throw error;
    }
  }

  /**
   * Find one collection by ID
   */
  async findOne(id: string, userId?: string) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: { id },
        include: {
          artworks: {
            include: {
              artwork: {
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
              },
            },
          },
        },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      // Check if user has access to private collection
      if (
        collection.visibility === COLLECTION_CONSTANTS.VISIBILITY.PRIVATE &&
        collection.createdBy !== userId
      ) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      return {
        ...collection,
        artworkCount: collection.artworks.length,
        artworks: collection.artworks.map((ca) => ca.artwork),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch collection ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update collection
   */
  async update(
    id: string,
    updateCollectionDto: UpdateCollectionDto,
    userId: string,
  ) {
    try {
      // Check ownership
      const existingCollection = await this.prisma.collection.findUnique({
        where: { id },
      });

      if (!existingCollection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (existingCollection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      // Get user for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const collection = await this.prisma.collection.update({
        where: { id },
        data: updateCollectionDto,
      });

      // Track changes
      const changes: Array<{ field: string; oldValue: any; newValue: any }> =
        [];
      Object.keys(updateCollectionDto).forEach((key) => {
        if (
          updateCollectionDto[key] !== undefined &&
          updateCollectionDto[key] !== existingCollection[key]
        ) {
          changes.push({
            field: key,
            oldValue: existingCollection[key],
            newValue: updateCollectionDto[key],
          });
        }
      });

      // Emit collection updated event
      await this.eventService.emit<CollectionUpdatedEvent>(
        COLLECTION_EVENTS.UPDATED,
        {
          collectionId: collection.id,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          changes,
          updatedAt: new Date(),
        },
      );

      this.logger.log(`Collection updated: ${id}`);
      return collection;
    } catch (error) {
      this.logger.error(`Failed to update collection ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete collection
   */
  async remove(id: string, userId: string) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: { id },
        include: {
          artworks: true,
        },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (collection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      // Get user for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      await this.prisma.collection.delete({
        where: { id },
      });

      // Emit collection deleted event
      await this.eventService.emit<CollectionDeletedEvent>(
        COLLECTION_EVENTS.DELETED,
        {
          collectionId: id,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          name: collection.name,
          artworkCount: collection.artworks.length,
          deletedAt: new Date(),
        },
      );

      this.logger.log(`Collection deleted: ${id}`);
      return { message: COLLECTION_MESSAGES.SUCCESS.DELETED };
    } catch (error) {
      this.logger.error(`Failed to delete collection ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get user's collections
   */
  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [collections, total] = await Promise.all([
        this.prisma.collection.findMany({
          where: { createdBy: userId },
          skip,
          take: limit,
          include: {
            artworks: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.collection.count({
          where: { createdBy: userId },
        }),
      ]);

      const collectionsWithCount = collections.map((collection) => ({
        ...collection,
        artworkCount: collection.artworks.length,
      }));

      return {
        collections: collectionsWithCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch user collections for ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Add artwork to collection
   */
  async addArtwork(collectionId: string, artworkId: string, userId: string) {
    try {
      // Check collection ownership
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
        include: { artworks: true },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (collection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      // Check artwork exists
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      });

      if (!artwork) {
        throw new NotFoundException(
          COLLECTION_MESSAGES.ERROR.ARTWORK_NOT_FOUND,
        );
      }

      // Check max artworks limit
      if (
        collection.artworks.length >=
        COLLECTION_CONSTANTS.MAX_ARTWORKS_PER_COLLECTION
      ) {
        throw new BadRequestException(
          COLLECTION_MESSAGES.ERROR.MAX_ARTWORKS_REACHED,
        );
      }

      // Check if already in collection
      const existing = await this.prisma.collectionOnArtwork.findFirst({
        where: {
          collectionId,
          artworkId,
        },
      });

      if (existing) {
        throw new BadRequestException(
          COLLECTION_MESSAGES.ERROR.ARTWORK_ALREADY_IN_COLLECTION,
        );
      }

      // Add artwork
      await this.prisma.collectionOnArtwork.create({
        data: {
          collectionId,
          artworkId,
        },
      });

      // Get user for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      // Emit artwork added event
      await this.eventService.emit<ArtworkAddedToCollectionEvent>(
        COLLECTION_EVENTS.ARTWORK_ADDED,
        {
          collectionId,
          collectionName: collection.name,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          artworkId,
          artworkTitle: artwork.title,
          artworkArtist: artwork.artist,
          artworkPhotoUrl: artwork.photos[0],
          addedAt: new Date(),
        },
      );

      this.logger.log(
        `Artwork ${artworkId} added to collection ${collectionId}`,
      );
      return { message: COLLECTION_MESSAGES.SUCCESS.ARTWORK_ADDED };
    } catch (error) {
      this.logger.error('Failed to add artwork to collection:', error);
      throw error;
    }
  }

  /**
   * Remove artwork from collection
   */
  async removeArtwork(collectionId: string, artworkId: string, userId: string) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (collection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      });

      const collectionArtwork = await this.prisma.collectionOnArtwork.findFirst(
        {
          where: {
            collectionId,
            artworkId,
          },
        },
      );

      if (!collectionArtwork) {
        throw new NotFoundException(
          COLLECTION_MESSAGES.ERROR.ARTWORK_NOT_IN_COLLECTION,
        );
      }

      await this.prisma.collectionOnArtwork.delete({
        where: { id: collectionArtwork.id },
      });

      // Emit artwork removed event
      await this.eventService.emit<ArtworkRemovedFromCollectionEvent>(
        COLLECTION_EVENTS.ARTWORK_REMOVED,
        {
          collectionId,
          collectionName: collection.name,
          userId,
          artworkId,
          artworkTitle: artwork?.title,
          removedAt: new Date(),
        },
      );

      this.logger.log(
        `Artwork ${artworkId} removed from collection ${collectionId}`,
      );
      return { message: COLLECTION_MESSAGES.SUCCESS.ARTWORK_REMOVED };
    } catch (error) {
      this.logger.error('Failed to remove artwork from collection:', error);
      throw error;
    }
  }

  /**
   * Publish collection (make it public)
   */
  async publish(collectionId: string, userId: string) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
        include: { artworks: true },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (collection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      // Check minimum artworks requirement
      if (
        collection.artworks.length <
        COLLECTION_CONSTANTS.MIN_ARTWORKS_FOR_PUBLISH
      ) {
        throw new BadRequestException(COLLECTION_MESSAGES.ERROR.CANNOT_PUBLISH);
      }

      const updated = await this.prisma.collection.update({
        where: { id: collectionId },
        data: { visibility: COLLECTION_CONSTANTS.VISIBILITY.PUBLIC },
      });

      // Get user for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      // Emit collection published event
      await this.eventService.emit<CollectionPublishedEvent>(
        COLLECTION_EVENTS.PUBLISHED,
        {
          collectionId,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          name: collection.name,
          description: collection.description,
          artworkCount: collection.artworks.length,
          coverImage: collection.coverImage,
          publicUrl: `http://localhost:3000/collections/${collectionId}`,
          publishedAt: new Date(),
        },
      );

      this.logger.log(`Collection published: ${collectionId}`);
      return {
        message: COLLECTION_MESSAGES.SUCCESS.PUBLISHED,
        collection: updated,
      };
    } catch (error) {
      this.logger.error('Failed to publish collection:', error);
      throw error;
    }
  }

  /**
   * Unpublish collection (make it private)
   */
  async unpublish(collectionId: string, userId: string) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
      });

      if (!collection) {
        throw new NotFoundException(COLLECTION_MESSAGES.ERROR.NOT_FOUND);
      }

      if (collection.createdBy !== userId) {
        throw new ForbiddenException(COLLECTION_MESSAGES.ERROR.UNAUTHORIZED);
      }

      const updated = await this.prisma.collection.update({
        where: { id: collectionId },
        data: { visibility: COLLECTION_CONSTANTS.VISIBILITY.PRIVATE },
      });

      // Get user for event
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      // Emit collection unpublished event
      await this.eventService.emit<CollectionUnpublishedEvent>(
        COLLECTION_EVENTS.UNPUBLISHED,
        {
          collectionId,
          userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          name: collection.name,
          unpublishedAt: new Date(),
        },
      );

      this.logger.log(`Collection unpublished: ${collectionId}`);
      return {
        message: COLLECTION_MESSAGES.SUCCESS.UNPUBLISHED,
        collection: updated,
      };
    } catch (error) {
      this.logger.error('Failed to unpublish collection:', error);
      throw error;
    }
  }
}
