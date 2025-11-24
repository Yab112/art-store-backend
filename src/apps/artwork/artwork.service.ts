import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { EventService } from "../../libraries/event";
import { ConfigurationService } from "../../core/configuration";
import { SettingsService } from "../settings/settings.service";
import { CreateArtworkDto, UpdateArtworkDto } from "./dto";
import { ArtworkStatus, Prisma } from "@prisma/client";
import {
  ARTWORK_EVENTS,
  ArtworkSubmittedEvent,
  ArtworkUpdatedEvent,
  ArtworkDeletedEvent,
  ArtworkApprovedEvent,
  ArtworkRejectedEvent,
  ArtworkPriceUpdatedEvent,
  ArtworkCommentAddedEvent,
  ArtworkCommentUpdatedEvent,
  ArtworkCommentDeletedEvent,
  ArtworkLikedEvent,
  ArtworkUnlikedEvent,
} from "./events";
import { ARTWORK_MESSAGES, ARTWORK_CONSTANTS } from "./constants";
import { CreateCommentDto, UpdateCommentDto } from "./dto";

@Injectable()
export class ArtworkService {
  private readonly logger = new Logger(ArtworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly configurationService: ConfigurationService,
    private readonly settingsService: SettingsService
  ) {}

  async create(createArtworkDto: CreateArtworkDto, userId: string) {
    try {
      // Log immediately with console.log to ensure it shows
      console.log("=== ARTWORK SERVICE CREATE ===");
      console.log("Received userId:", userId);
      console.log("userId type:", typeof userId);
      console.log("userId length:", userId?.length);

      // Trim and validate userId
      const trimmedUserId = userId?.trim();
      console.log("Trimmed userId:", trimmedUserId);
      console.log("Trimmed userId length:", trimmedUserId?.length);

      this.logger.debug(
        `Creating artwork for user ID: "${trimmedUserId}" (length: ${trimmedUserId?.length})`
      );

      if (!trimmedUserId) {
        console.error("ERROR: User ID is empty after trim");
        throw new NotFoundException("User ID is required");
      }

      // Verify user exists BEFORE creating artwork (same as collections)
      console.log("Checking if user exists in database...");
      const user = await this.prisma.user.findUnique({
        where: { id: trimmedUserId },
        select: { id: true, name: true, email: true },
      });

      console.log(
        "User lookup result:",
        user ? `Found: ${user.id} (${user.email})` : "NOT FOUND"
      );

      if (!user) {
        // Log detailed error information
        console.error("USER NOT FOUND - Fetching sample users...");
        const allUsers = await this.prisma.user.findMany({
          select: { id: true, email: true },
          take: 10,
        });
        console.error(
          "Sample users in database:",
          JSON.stringify(allUsers, null, 2)
        );

        this.logger.error(`User not found in database: "${trimmedUserId}"`);
        this.logger.error(`User ID type: ${typeof trimmedUserId}`);
        this.logger.error(`User ID length: ${trimmedUserId.length}`);
        this.logger.error(
          `Sample users in database: ${JSON.stringify(allUsers, null, 2)}`
        );

        // Check if user exists with different casing or format
        const userByEmail = await this.prisma.user.findFirst({
          select: { id: true, email: true },
        });

        if (userByEmail) {
          console.error(
            `Sample user ID format: "${userByEmail.id}" (length: ${userByEmail.id.length})`
          );
          this.logger.error(
            `Sample user ID format: "${userByEmail.id}" (length: ${userByEmail.id.length})`
          );
        }

        throw new NotFoundException(
          `User with ID "${trimmedUserId}" not found in database. Please ensure you are logged in with a valid account.`
        );
      }

      console.log("User verified, proceeding with artwork creation...");
      this.logger.debug(
        `User verified: ${user.id} (${user.email}) - Proceeding with artwork creation`
      );

      // Convert dimensions to JSON format for Prisma
      const { dimensions, categoryIds, ...rest } = createArtworkDto;

      // CRITICAL: Use the exact user.id from the database lookup, not the trimmedUserId
      // This ensures we're using the exact ID format that exists in the database
      const artworkData: Prisma.ArtworkCreateInput = {
        ...rest,
        dimensions: dimensions as unknown as Prisma.InputJsonValue,
        user: {
          connect: { id: user.id },
        },
      };

      console.log("Artwork data prepared:");
      console.log("- userId from user lookup:", user.id);
      console.log("- userId type:", typeof user.id);
      console.log("- userId length:", user.id?.length);
      console.log("- trimmedUserId:", trimmedUserId);
      console.log("- userId matches trimmedUserId:", user.id === trimmedUserId);
      this.logger.debug(`Artwork data prepared, userId: "${user.id}"`);

      // Final verification: Check user exists one more time right before creating
      console.log("Final verification: Checking user exists one more time...");
      const finalUserCheck = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true },
      });
      console.log(
        "Final user check result:",
        finalUserCheck ? `User exists: ${finalUserCheck.id}` : "USER NOT FOUND"
      );

      if (!finalUserCheck) {
        console.error("CRITICAL: User disappeared between lookup and create!");
        throw new NotFoundException(
          `User ${user.id} not found in database. This should not happen.`
        );
      }

      console.log(
        "Attempting to create artwork in database with userId:",
        user.id
      );

      // Create artwork with categories in a transaction
      const artwork = await this.prisma.$transaction(async (tx) => {
        // Create the artwork
        const newArtwork = await tx.artwork.create({
          data: artworkData,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Associate categories if provided
        if (categoryIds && categoryIds.length > 0) {
          await tx.artworkOnCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              artworkId: newArtwork.id,
              categoryId,
            })),
          });
        }

        return newArtwork;
      });
      console.log("✅ Artwork created successfully:", artwork.id);

      // Emit artwork submitted event - use user from query or artwork.user
      const artworkUser = artwork.user || user;
      await this.eventService.emit<ArtworkSubmittedEvent>(
        ARTWORK_EVENTS.SUBMITTED,
        {
          artworkId: artwork.id,
          userId: artwork.userId,
          userName: artworkUser?.name || "Unknown",
          userEmail: artworkUser?.email || "",
          artist: artwork.artist,
          title: artwork.title,
          desiredPrice: artwork.desiredPrice,
          photos: artwork.photos,
          proofOfOrigin: artwork.proofOfOrigin,
          submittedAt: new Date(),
        }
      );

      this.logger.log(`✅ Artwork created: ${artwork.id}`);
      return artwork;
    } catch (error) {
      this.logger.error("❌ Failed to create artwork:", error);
      throw error;
    }
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: ArtworkStatus;
    search?: string;
    artist?: string;
    categoryId?: string;
    categoryIds?: string[];
    support?: string;
    origin?: string;
    yearOfArtwork?: string;
    minPrice?: number;
    maxPrice?: number;
    isApproved?: boolean;
    sortBy?: "createdAt" | "desiredPrice" | "title" | "artist" | "updatedAt";
    orderBy?: "asc" | "desc";
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        artist,
        categoryId,
        categoryIds,
        support,
        origin,
        yearOfArtwork,
        minPrice,
        maxPrice,
        isApproved,
        sortBy = "createdAt",
        orderBy = "desc",
      } = query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (isApproved !== undefined) {
        where.isApproved = isApproved;
      }

      if (artist) {
        where.artist = {
          contains: artist,
          mode: "insensitive",
        };
      }

      // Support both single categoryId (for backward compatibility) and categoryIds array
      if (categoryIds && categoryIds.length > 0) {
        where.categories = {
          some: {
            categoryId: {
              in: categoryIds,
            },
          },
        };
      } else if (categoryId) {
        where.categories = {
          some: {
            categoryId: categoryId,
          },
        };
      }

      if (support) {
        where.support = {
          contains: support,
          mode: "insensitive",
        };
      }

      if (origin) {
        where.origin = {
          contains: origin,
          mode: "insensitive",
        };
      }

      if (yearOfArtwork) {
        where.yearOfArtwork = yearOfArtwork;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.desiredPrice = {};
        if (minPrice !== undefined) {
          where.desiredPrice.gte = minPrice;
        }
        if (maxPrice !== undefined) {
          where.desiredPrice.lte = maxPrice;
        }
      }

      // Search across multiple fields
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { artist: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Build orderBy clause
      const orderByClause: any = {};
      orderByClause[sortBy] = orderBy;

      const [artworks, total] = await Promise.all([
        this.prisma.artwork.findMany({
          where,
          skip,
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
            categories: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
            interactions: {
              where: { type: "LIKE" },
              select: { id: true },
            },
            _count: {
              select: {
                comments: true,
                reviews: true,
              },
            },
          },
          orderBy: orderByClause,
        }),
        this.prisma.artwork.count({ where }),
      ]);

      // Transform artworks to include like counts and other stats
      const artworksWithStats = artworks.map((artwork) => ({
        ...artwork,
        categories: artwork.categories?.map((ac) => ac.category) || [],
        likeCount: artwork.interactions?.length || 0,
        commentCount: artwork._count?.comments || 0,
        reviewCount: artwork._count?.reviews || 0,
        interactions: undefined, // Remove interactions array from response
        _count: undefined, // Remove _count from response
      }));

      return {
        artworks: artworksWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("❌ Failed to fetch artworks:", error);
      throw error;
    }
  }

  async findOne(id: string, userId?: string) {
    try {
      const artwork = await this.prisma.artwork.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          interactions: {
            select: {
              id: true,
              type: true,
              userId: true,
              createdAt: true,
            },
          },
          comments: {
            select: {
              id: true,
              authorName: true,
              content: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 10, // Limit to recent comments
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              User: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 10, // Limit to recent reviews
          },
        },
      });

      if (!artwork) {
        throw new NotFoundException("Artwork not found");
      }

      // Type assertion to help TypeScript understand the included relations
      const artworkWithRelations = artwork as typeof artwork & {
        interactions: Array<{
          id: string;
          type: string;
          userId: string | null;
          createdAt: Date;
        }>;
        comments: Array<{
          id: string;
          authorName: string;
          content: string;
          createdAt: Date;
        }>;
        reviews: Array<{
          id: string;
          rating: number;
          comment: string | null;
          createdAt: Date;
          User: { id: string; name: string; email: string };
        }>;
      };

      // Calculate likes count (only LIKE interactions)
      const likeInteractions =
        artworkWithRelations.interactions?.filter((i) => i.type === "LIKE") ||
        [];
      const likeCount = likeInteractions.length;

      // Check if current user liked this artwork
      const isLiked =
        userId && likeInteractions.length > 0
          ? likeInteractions.some(
              (interaction) => interaction.userId === userId
            )
          : false;

      // Calculate average rating
      const reviews = artworkWithRelations.reviews || [];
      const averageRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, review) => sum + review.rating, 0) /
            reviews.length
          : undefined;

      // Map user for frontend consistency
      const reviewsWithUser = reviews.map((review) => ({
        ...review,
        user: review.User,
      }));

      return {
        ...artworkWithRelations,
        categories:
          artworkWithRelations.categories?.map((ac) => ac.category) || [],
        interactions: artworkWithRelations.interactions || [],
        comments: artworkWithRelations.comments || [],
        reviews: reviewsWithUser,
        likeCount,
        isLiked,
        commentCount: artworkWithRelations.comments?.length || 0,
        reviewCount: reviews.length,
        averageRating,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to fetch artwork ${id}:`, error);
      throw error;
    }
  }

  async update(id: string, updateArtworkDto: UpdateArtworkDto, userId: string) {
    try {
      // Check if artwork exists and belongs to user
      const existingArtwork = await this.prisma.artwork.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!existingArtwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      if (existingArtwork.userId !== userId) {
        throw new ForbiddenException(ARTWORK_MESSAGES.ERROR.UNAUTHORIZED);
      }

      // Convert dimensions to JSON if present
      const { dimensions, categoryIds, ...restUpdate } = updateArtworkDto;
      const updateData: Prisma.ArtworkUpdateInput = {
        ...restUpdate,
      };
      if (dimensions) {
        updateData.dimensions = dimensions as unknown as Prisma.InputJsonValue;
      }

      // Update artwork with categories in a transaction
      const artwork = await this.prisma.$transaction(async (tx) => {
        // Update the artwork
        const updatedArtwork = await tx.artwork.update({
          where: { id },
          data: updateData,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Update categories if provided
        if (categoryIds !== undefined) {
          // Remove existing categories
          await tx.artworkOnCategory.deleteMany({
            where: { artworkId: id },
          });

          // Add new categories
          if (categoryIds.length > 0) {
            await tx.artworkOnCategory.createMany({
              data: categoryIds.map((categoryId) => ({
                artworkId: id,
                categoryId,
              })),
            });
          }
        }

        return updatedArtwork;
      });

      // Track changes for event
      const changes: Array<{ field: string; oldValue: any; newValue: any }> =
        [];

      Object.keys(updateArtworkDto).forEach((key) => {
        if (
          updateArtworkDto[key] !== undefined &&
          updateArtworkDto[key] !== existingArtwork[key]
        ) {
          changes.push({
            field: key,
            oldValue: existingArtwork[key],
            newValue: updateArtworkDto[key],
          });
        }
      });

      // Emit artwork updated event - artwork.user is guaranteed by the include clause
      const artworkWithUser = artwork as typeof artwork & {
        user: { id: string; name: string; email: string };
      };
      await this.eventService.emit<ArtworkUpdatedEvent>(
        ARTWORK_EVENTS.UPDATED,
        {
          artworkId: artworkWithUser.id,
          userId: artworkWithUser.userId,
          userName: artworkWithUser.user.name,
          userEmail: artworkWithUser.user.email,
          changes,
          updatedAt: new Date(),
        }
      );

      // If price was updated, emit price updated event
      const priceChange = changes.find((c) => c.field === "desiredPrice");
      if (priceChange) {
        await this.eventService.emit<ArtworkPriceUpdatedEvent>(
          ARTWORK_EVENTS.PRICE_UPDATED,
          {
            artworkId: artworkWithUser.id,
            userId: artworkWithUser.userId,
            userName: artworkWithUser.user.name,
            userEmail: artworkWithUser.user.email,
            artist: artworkWithUser.artist,
            title: artworkWithUser.title,
            oldPrice: priceChange.oldValue,
            newPrice: priceChange.newValue,
            updatedAt: new Date(),
          }
        );
      }

      this.logger.log(`✅ Artwork updated: ${id}`);
      return artwork;
    } catch (error) {
      this.logger.error(`❌ Failed to update artwork ${id}:`, error);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    try {
      // Check if artwork exists and belongs to user
      const existingArtwork = await this.prisma.artwork.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!existingArtwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      if (existingArtwork.userId !== userId) {
        throw new ForbiddenException(ARTWORK_MESSAGES.ERROR.UNAUTHORIZED);
      }

      await this.prisma.artwork.delete({
        where: { id },
      });

      // Emit artwork deleted event
      await this.eventService.emit<ArtworkDeletedEvent>(
        ARTWORK_EVENTS.DELETED,
        {
          artworkId: id,
          userId: existingArtwork.userId,
          userName: existingArtwork.user.name,
          userEmail: existingArtwork.user.email,
          artist: existingArtwork.artist,
          title: existingArtwork.title,
          deletedAt: new Date(),
        }
      );

      this.logger.log(`✅ Artwork deleted: ${id}`);
      return { message: ARTWORK_MESSAGES.SUCCESS.DELETED };
    } catch (error) {
      this.logger.error(`❌ Failed to delete artwork ${id}:`, error);
      throw error;
    }
  }

  async updateStatus(id: string, status: ArtworkStatus, adminId?: string) {
    try {
      const artwork = await this.prisma.artwork.update({
        where: { id },
        data: {
          status,
          isApproved: status === ArtworkStatus.APPROVED,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Emit appropriate event based on status
      if (status === ArtworkStatus.APPROVED) {
        await this.eventService.emit<ArtworkApprovedEvent>(
          ARTWORK_EVENTS.APPROVED,
          {
            artworkId: artwork.id,
            userId: artwork.userId,
            userName: artwork.user.name,
            userEmail: artwork.user.email,
            artist: artwork.artist,
            title: artwork.title,
            approvedBy: adminId || "system",
            approvedAt: new Date(),
            publicUrl: `${this.configurationService.getServerBaseUrl()}/artworks/${artwork.id}`,
          }
        );
      } else if (status === ArtworkStatus.REJECTED) {
        await this.eventService.emit<ArtworkRejectedEvent>(
          ARTWORK_EVENTS.REJECTED,
          {
            artworkId: artwork.id,
            userId: artwork.userId,
            userName: artwork.user.name,
            userEmail: artwork.user.email,
            artist: artwork.artist,
            title: artwork.title,
            rejectedBy: adminId || "system",
            rejectedAt: new Date(),
            reason: "Does not meet quality standards", // TODO: Pass reason as parameter
            canResubmit: true,
          }
        );
      }

      this.logger.log(`✅ Artwork status updated: ${id} -> ${status}`);
      return artwork;
    } catch (error) {
      this.logger.error(`❌ Failed to update artwork status ${id}:`, error);
      throw error;
    }
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const [artworks, total] = await Promise.all([
        this.prisma.artwork.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.artwork.count({ where: { userId } }),
      ]);

      return {
        artworks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch user artworks for ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get artworks similar to a specific artwork based on shared collections
   * Finds artworks that are in the same collections as the given artwork
   * Excludes the current artwork and ranks by number of shared collections
   */
  async getSimilarArtworks(artworkId: string, limit: number = 12) {
    try {
      // 1. Get all collections that contain this artwork
      const artworkCollections = await this.prisma.collectionOnArtwork.findMany({
        where: { artworkId },
        select: { collectionId: true },
      });

      const collectionIds = artworkCollections.map((ac) => ac.collectionId);

      // If artwork is not in any collections, return empty
      if (collectionIds.length === 0) {
        this.logger.warn(`Artwork ${artworkId} is not in any collections`);
        return [];
      }

      this.logger.log(
        `[Similar Artworks] Artwork ${artworkId} is in ${collectionIds.length} collections: ${collectionIds.join(', ')}`
      );

      // 2. Get all CollectionOnArtwork records from those collections (excluding the current artwork)
      const artworksInCollections = await this.prisma.collectionOnArtwork.findMany({
        where: {
          collectionId: { in: collectionIds },
          artworkId: { not: artworkId }, // Exclude the current artwork
        },
        select: {
          artworkId: true,
          collectionId: true,
        },
      });

      // 3. Get unique artwork IDs and fetch the artworks with their details
      const uniqueArtworkIds = [...new Set(artworksInCollections.map((ac) => ac.artworkId))];

      if (uniqueArtworkIds.length === 0) {
        this.logger.warn(`No other artworks found in collections for artwork ${artworkId}`);
        return [];
      }

      // 4. Fetch artworks with their details (only approved ones)
      const artworks = await this.prisma.artwork.findMany({
        where: {
          id: { in: uniqueArtworkIds },
          isApproved: true,
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      // 5. Count shared collections for each artwork
      const artworkCollectionCount = new Map<string, { artwork: any; sharedCollections: number }>();

      artworks.forEach((artwork) => {
        // Count how many collections this artwork shares with the original artwork
        const sharedCount = artworksInCollections.filter(
          (ac) => ac.artworkId === artwork.id
        ).length;

        artworkCollectionCount.set(artwork.id, {
          artwork,
          sharedCollections: sharedCount,
        });
      });

      // 6. Sort by shared collections count (descending) and limit
      const rankedArtworks = Array.from(artworkCollectionCount.values())
        .sort((a, b) => b.sharedCollections - a.sharedCollections)
        .slice(0, limit)
        .map(({ sharedCollections, artwork }) => {
          // Transform categories to match expected format
          return {
            ...artwork,
            categories: artwork.categories.map((ac: any) => ac.category),
          };
        });

      // 7. Ensure no duplicates by ID (additional safeguard)
      const uniqueArtworks = rankedArtworks.filter((artwork, index, self) =>
        index === self.findIndex((a) => a.id === artwork.id)
      );

      this.logger.log(
        `[Similar Artworks] Found ${uniqueArtworks.length} unique similar artworks for artwork ${artworkId}`
      );
      return uniqueArtworks;
    } catch (error) {
      this.logger.error(`Failed to fetch similar artworks for artwork ${artworkId}:`, error);
      throw error;
    }
  }

  /**
   * Get artworks similar to a specific artwork based on shared categories
   * Returns artworks that share at least one category with the given artwork
   */
  async getSimilarArtworksByCategory(artworkId: string, limit: number = 12) {
    try {
      // 1. Get the current artwork and its categories
      const currentArtwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
        include: {
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!currentArtwork) {
        this.logger.warn(`Artwork ${artworkId} not found`);
        return [];
      }

      const categoryIds = currentArtwork.categories.map((ac) => ac.categoryId);

      // If artwork has no categories, return empty
      if (categoryIds.length === 0) {
        this.logger.warn(`Artwork ${artworkId} has no categories`);
        return [];
      }

      this.logger.log(
        `[Similar Artworks by Category] Artwork ${artworkId} has ${categoryIds.length} categories: ${categoryIds.join(', ')}`
      );

      // 2. Get all artwork IDs that share at least one category (excluding the current artwork)
      const artworksWithCategories = await this.prisma.artworkOnCategory.findMany({
        where: {
          categoryId: { in: categoryIds },
          artworkId: { not: artworkId }, // Exclude the current artwork
        },
        select: {
          artworkId: true,
          categoryId: true,
        },
      });

      if (artworksWithCategories.length === 0) {
        this.logger.warn(`No other artworks found with shared categories for artwork ${artworkId}`);
        return [];
      }

      // Get unique artwork IDs
      const uniqueArtworkIds = [...new Set(artworksWithCategories.map((ac) => ac.artworkId))];

      // 3. Fetch artworks with their details (only approved ones)
      const artworks = await this.prisma.artwork.findMany({
        where: {
          id: { in: uniqueArtworkIds },
          isApproved: true,
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (artworks.length === 0) {
        this.logger.warn(`No approved artworks found with shared categories for artwork ${artworkId}`);
        return [];
      }

      // 4. Count shared categories for each artwork
      const artworkCategoryCount = new Map<string, { artwork: any; sharedCategories: number }>();

      artworks.forEach((artwork) => {
        // Count how many categories this artwork shares with the original artwork
        const artworkCategoryIds = artwork.categories.map((ac: any) => ac.categoryId);
        const sharedCount = categoryIds.filter((id) => artworkCategoryIds.includes(id)).length;

        if (sharedCount > 0) {
          artworkCategoryCount.set(artwork.id, {
            artwork,
            sharedCategories: sharedCount,
          });
        }
      });

      // 4. Sort by shared categories count (descending) and limit
      const rankedArtworks = Array.from(artworkCategoryCount.values())
        .sort((a, b) => b.sharedCategories - a.sharedCategories)
        .slice(0, limit)
        .map(({ sharedCategories, artwork }) => {
          // Transform categories to match expected format
          return {
            ...artwork,
            categories: artwork.categories.map((ac: any) => ac.category),
          };
        });

      // 5. Ensure no duplicates by ID (additional safeguard)
      const uniqueArtworks = rankedArtworks.filter((artwork, index, self) =>
        index === self.findIndex((a) => a.id === artwork.id)
      );

      this.logger.log(
        `[Similar Artworks by Category] Found ${uniqueArtworks.length} unique similar artworks for artwork ${artworkId}`
      );
      return uniqueArtworks;
    } catch (error) {
      this.logger.error(`Failed to fetch similar artworks by category for artwork ${artworkId}:`, error);
      throw error;
    }
  }

  // ==================== COMMENTS ====================

  /**
   * Add a comment to an artwork
   * NOTE: Comment model needs schema update to include userId and updatedAt fields
   */
  async addComment(
    artworkId: string,
    createCommentDto: CreateCommentDto,
    userId: string
  ) {
    try {
      // Get artwork with owner details
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!artwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      // Get commenter details
      const commenter = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      if (!commenter) {
        throw new NotFoundException("User not found");
      }

      // Create comment
      const comment = await this.prisma.comment.create({
        data: {
          artworkId,
          authorName: commenter.name, // Using existing schema field
          content: createCommentDto.comment,
        },
      });

      // Emit comment added event
      await this.eventService.emit<ArtworkCommentAddedEvent>(
        ARTWORK_EVENTS.COMMENT_ADDED,
        {
          commentId: comment.id,
          artworkId,
          artworkTitle: artwork.title,
          artworkOwnerId: artwork.user.id,
          artworkOwnerName: artwork.user.name,
          artworkOwnerEmail: artwork.user.email,
          commenterUserId: userId,
          commenterName: commenter.name,
          commenterEmail: commenter.email,
          commenterAvatar: commenter.image,
          comment: createCommentDto.comment,
          createdAt: new Date(),
        }
      );

      this.logger.log(`✅ Comment added to artwork ${artworkId}`);
      return {
        success: true,
        message: ARTWORK_MESSAGES.SUCCESS.COMMENT_ADDED,
        comment,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to add comment to artwork ${artworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get comments for an artwork
   */
  async getComments(
    artworkId: string,
    page: number = 1,
    limit: number = ARTWORK_CONSTANTS.COMMENTS.DEFAULT_LIMIT
  ) {
    try {
      const skip = (page - 1) * limit;

      const [comments, total] = await Promise.all([
        this.prisma.comment.findMany({
          where: { artworkId },
          skip,
          take: limit,
          orderBy: {
            createdAt: "desc",
          },
        }),
        this.prisma.comment.count({ where: { artworkId } }),
      ]);

      return {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch comments for artwork ${artworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update a comment
   * NOTE: Comment model needs userId field for authorization
   */
  async updateComment(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
    userId: string
  ) {
    try {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.COMMENT_NOT_FOUND);
      }

      // NOTE: Cannot verify ownership without userId field in Comment model
      // TODO: Add userId to Comment model schema

      const oldComment = comment.content;
      const updatedComment = await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          content: updateCommentDto.comment,
        },
      });

      // Emit comment updated event
      await this.eventService.emit<ArtworkCommentUpdatedEvent>(
        ARTWORK_EVENTS.COMMENT_UPDATED,
        {
          commentId,
          artworkId: comment.artworkId,
          userId,
          oldComment,
          newComment: updateCommentDto.comment,
          updatedAt: new Date(),
        }
      );

      this.logger.log(`✅ Comment updated: ${commentId}`);
      return {
        success: true,
        message: ARTWORK_MESSAGES.SUCCESS.COMMENT_UPDATED,
        comment: updatedComment,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, userId: string) {
    try {
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.COMMENT_NOT_FOUND);
      }

      // NOTE: Cannot verify ownership without userId field in Comment model
      // TODO: Add userId to Comment model schema

      await this.prisma.comment.delete({
        where: { id: commentId },
      });

      // Emit comment deleted event
      await this.eventService.emit<ArtworkCommentDeletedEvent>(
        ARTWORK_EVENTS.COMMENT_DELETED,
        {
          commentId,
          artworkId: comment.artworkId,
          userId,
          deletedAt: new Date(),
        }
      );

      this.logger.log(`✅ Comment deleted: ${commentId}`);
      return {
        success: true,
        message: ARTWORK_MESSAGES.SUCCESS.COMMENT_DELETED,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to delete comment ${commentId}:`, error);
      throw error;
    }
  }

  // ==================== LIKES ====================

  /**
   * Like an artwork
   * Uses Interaction model with type='LIKE'
   */
  async likeArtwork(artworkId: string, userId: string) {
    try {
      // Get artwork with owner details
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!artwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      // Check if already liked - now using userId field directly
      // Note: userId field added to Interaction model - regenerate Prisma client
      const existingLike = await this.prisma.interaction.findFirst({
        where: {
          artworkId,
          type: "LIKE",
          userId: userId, // Direct userId field instead of metadata query
        } as any, // Type assertion until Prisma client is regenerated
      });

      if (existingLike) {
        throw new ForbiddenException(ARTWORK_MESSAGES.ERROR.ALREADY_LIKED);
      }

      // Get liker details
      const liker = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      if (!liker) {
        throw new NotFoundException("User not found");
      }

      // Create like - now with userId field
      // Note: userId field added to Interaction model - regenerate Prisma client
      const like = await this.prisma.interaction.create({
        data: {
          artworkId,
          userId: userId,
          type: "LIKE",
          metadata: {
            userName: liker.name,
          },
          artwork: {
            connect: { id: artworkId },
          },
        } as Prisma.InteractionCreateInput,
      });

      // Get total likes count
      const totalLikes = await this.prisma.interaction.count({
        where: {
          artworkId,
          type: "LIKE",
        },
      });

      // Emit artwork liked event
      await this.eventService.emit<ArtworkLikedEvent>(ARTWORK_EVENTS.LIKED, {
        artworkId,
        artworkTitle: artwork.title,
        artworkOwnerId: artwork.user.id,
        artworkOwnerName: artwork.user.name,
        artworkOwnerEmail: artwork.user.email,
        likerUserId: userId,
        likerName: liker.name,
        likerEmail: liker.email,
        likerAvatar: liker.image,
        likedAt: new Date(),
        totalLikes,
      });

      this.logger.log(`✅ Artwork liked: ${artworkId} by ${userId}`);
      return {
        success: true,
        message: ARTWORK_MESSAGES.SUCCESS.LIKED,
        totalLikes,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to like artwork ${artworkId}:`, error);
      throw error;
    }
  }

  /**
   * Unlike an artwork
   */
  async unlikeArtwork(artworkId: string, userId: string) {
    try {
      // Get artwork
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      });

      if (!artwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      const existingLike = await this.prisma.interaction.findFirst({
        where: {
          artworkId,
          type: "LIKE",
          userId: userId,
        } as Prisma.InteractionWhereInput,
      });

      if (!existingLike) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_LIKED);
      }

      // Remove like
      await this.prisma.interaction.delete({
        where: { id: existingLike.id },
      });

      // Get total likes count
      const totalLikes = await this.prisma.interaction.count({
        where: {
          artworkId,
          type: "LIKE",
        },
      });

      // Emit artwork unliked event
      await this.eventService.emit<ArtworkUnlikedEvent>(
        ARTWORK_EVENTS.UNLIKED,
        {
          artworkId,
          userId,
          unlikedAt: new Date(),
          totalLikes,
        }
      );

      this.logger.log(`✅ Artwork unliked: ${artworkId} by ${userId}`);
      return {
        success: true,
        message: ARTWORK_MESSAGES.SUCCESS.UNLIKED,
        totalLikes,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to unlike artwork ${artworkId}:`, error);
      throw error;
    }
  }

  /**
   * Get like count and user's like status for an artwork
   */
  async getLikes(artworkId: string, userId?: string) {
    try {
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      });

      if (!artwork) {
        throw new NotFoundException(ARTWORK_MESSAGES.ERROR.NOT_FOUND);
      }

      const totalLikes = await this.prisma.interaction.count({
        where: {
          artworkId,
          type: "LIKE",
        },
      });

      let isLikedByUser = false;
      if (userId) {
        const userLike = await this.prisma.interaction.findFirst({
          where: {
            artworkId,
            type: "LIKE",
            userId: userId,
          } as Prisma.InteractionWhereInput,
        });
        isLikedByUser = !!userLike;
      }

      return {
        success: true,
        artworkId,
        totalLikes,
        isLikedByUser,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to get likes for artwork ${artworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get trending artists based on comprehensive metrics
   * Calculates trending score from: engagement (views, likes, comments, favorites), 
   * sales (totalSales, salesCount, earnings), and artwork count
   */
  async getTrendingArtists(limit: number = 10) {
    try {
      // Get platform commission rate for earnings calculation
      const platformCommissionRate =
        await this.settingsService.getPlatformCommissionRate();

      // Get all approved artworks with their engagement data and user info
      const artworks = await this.prisma.artwork.findMany({
        where: {
          isApproved: true,
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          interactions: {
            select: {
              type: true,
            },
          },
          comments: {
            select: {
              id: true,
            },
          },
          favorites: {
            select: {
              id: true,
            },
          },
          orderItems: {
            where: {
              order: {
                status: 'PAID',
              },
            },
            select: {
              price: true,
              order: {
                select: {
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      // Group artworks by userId (actual artist) and calculate metrics
      const artistMap = new Map<
        string,
        {
          userId: string;
          name: string;
          avatar: string;
          artworkCount: number;
          totalViews: number;
          totalLikes: number;
          totalComments: number;
          totalFavorites: number;
          totalSales: number;
          salesCount: number;
          totalEarnings: number;
          engagementScore: number;
        }
      >();

      artworks.forEach((artwork) => {
        if (!artwork.userId || !artwork.user) return;

        const userId = artwork.userId;
        const existing = artistMap.get(userId);

        // Count interactions by type (case-insensitive)
        const views = artwork.interactions.filter((i) => 
          i.type?.toUpperCase() === 'VIEW'
        ).length;
        const likes = artwork.interactions.filter((i) => 
          i.type?.toUpperCase() === 'LIKE'
        ).length;

        const comments = artwork.comments.length;
        const favorites = artwork.favorites.length;

        // Calculate sales metrics for this artwork
        const artworkSales = artwork.orderItems
          .filter((item) => item.order.status === 'PAID')
          .reduce(
            (acc, item) => {
              const salePrice = Number(item.price);
              const commission = salePrice * platformCommissionRate;
              const earnings = salePrice - commission;
              return {
                totalSales: acc.totalSales + salePrice,
                salesCount: acc.salesCount + 1,
                totalEarnings: acc.totalEarnings + earnings,
              };
            },
            { totalSales: 0, salesCount: 0, totalEarnings: 0 }
          );

        // Get user profile avatar (prefer user image, fallback to placeholder)
        const artistAvatar = artwork.user.image || '/placeholder.svg';

        if (existing) {
          existing.artworkCount += 1;
          existing.totalViews += views;
          existing.totalLikes += likes;
          existing.totalComments += comments;
          existing.totalFavorites += favorites;
          existing.totalSales += artworkSales.totalSales;
          existing.salesCount += artworkSales.salesCount;
          existing.totalEarnings += artworkSales.totalEarnings;
          // Update avatar if user has a profile image
          if (artwork.user.image) {
            existing.avatar = artwork.user.image;
          }
        } else {
          artistMap.set(userId, {
            userId,
            name: artwork.user.name || artwork.artist || 'Unknown Artist',
            avatar: artistAvatar,
            artworkCount: 1,
            totalViews: views,
            totalLikes: likes,
            totalComments: comments,
            totalFavorites: favorites,
            totalSales: artworkSales.totalSales,
            salesCount: artworkSales.salesCount,
            totalEarnings: artworkSales.totalEarnings,
            engagementScore: 0, // Will calculate below
          });
        }
      });

      // Calculate comprehensive trending score for each artist
      // Weighted formula: 
      // - Engagement: views (1x) + likes (3x) + comments (2x) + favorites (2x) + artwork count (1x)
      // - Sales: totalSales (0.01x per euro) + salesCount (10x) + totalEarnings (0.01x per euro)
      const artistsWithScores = Array.from(artistMap.values()).map((artist) => {
        const engagementScore =
          artist.totalViews * 1 +
          artist.totalLikes * 3 +
          artist.totalComments * 2 +
          artist.totalFavorites * 2 +
          artist.artworkCount * 1;

        const salesScore =
          artist.totalSales * 0.01 + // 1 point per 100 euros in sales
          artist.salesCount * 10 + // 10 points per sale
          artist.totalEarnings * 0.01; // 1 point per 100 euros in earnings

        const trendingScore = engagementScore + salesScore;

        return {
          ...artist,
          engagementScore,
          trendingScore,
        };
      });

      // Sort by trending score (descending) and limit
      const trendingArtists = artistsWithScores
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit)
        .map(({ engagementScore, trendingScore, ...artist }) => artist); // Remove scores from response

      return trendingArtists;
    } catch (error) {
      this.logger.error('❌ Failed to get trending artists:', error);
      throw error;
    }
  }

  /**
   * Get trending artworks based on engagement metrics
   * Calculates trending score from: views, likes, comments, favorites, and recency
   */
  async getTrendingArtworks(limit: number = 12) {
    try {
      // Get all approved artworks with their engagement data
      const artworks = await this.prisma.artwork.findMany({
        where: {
          isApproved: true,
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          interactions: {
            select: {
              type: true,
              createdAt: true,
            },
          },
          comments: {
            select: {
              id: true,
              createdAt: true,
            },
          },
          favorites: {
            select: {
              id: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate trending score for each artwork
      const now = new Date();
      const artworksWithScores = artworks.map((artwork) => {
        // Count interactions by type (case-insensitive)
        const views = artwork.interactions.filter(
          (i) => i.type?.toUpperCase() === 'VIEW'
        ).length;
        const likes = artwork.interactions.filter(
          (i) => i.type?.toUpperCase() === 'LIKE'
        ).length;
        const comments = artwork.comments.length;
        const favorites = artwork.favorites.length;

        // Calculate time decay factor (artworks created in last 7 days get bonus)
        const daysSinceCreation =
          (now.getTime() - artwork.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const recencyBonus = daysSinceCreation <= 7 ? 1.5 : daysSinceCreation <= 30 ? 1.2 : 1.0;

        // Calculate engagement score with time decay
        // Weighted formula: views (1x) + likes (3x) + comments (2x) + favorites (2.5x)
        const engagementScore =
          (views * 1 + likes * 3 + comments * 2 + favorites * 2.5) * recencyBonus;

        return {
          artwork,
          engagementScore,
        };
      });

      // Sort by engagement score (descending) and limit
      const trendingArtworks = artworksWithScores
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, limit)
        .map(({ artwork }) => artwork);

      return trendingArtworks;
    } catch (error) {
      this.logger.error('❌ Failed to get trending artworks:', error);
      throw error;
    }
  }
}