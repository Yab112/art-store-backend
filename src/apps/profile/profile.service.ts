import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { EventService } from "../../libraries/event";
import { AnalyticsService } from "../analytics/analytics.service";
import {
  UpdateProfileDto,
  UpdatePreferencesDto,
  UpdateSettingsDto,
  DeactivateAccountDto,
} from "./dto";

import { PROFILE_MESSAGES } from "./constants";
import {
  AccountDeactivatedEvent,
  PreferencesUpdatedEvent,
  PROFILE_EVENTS,
  ProfileUpdatedEvent,
  ProfileViewedEvent,
  SettingsUpdatedEvent,
} from "./events";

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly analyticsService: AnalyticsService
  ) {}

  /**
   * Fetch public user profile by ID
   */
  async getPublicProfile(
    profileId: string,
    viewerUserId?: string,
    viewerIp?: string
  ) {
    try {
      // Get user with relations (without artworks - they should be fetched separately via paginated endpoint)
      const user = await this.prisma.user.findUnique({
        where: { id: profileId },
        include: {
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
          talentTypes: {
            select: {
              talentType: {
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

      // Get artwork count separately (more efficient than loading all artworks)
      const artworkCount = await this.prisma.artwork.count({
        where: {
          userId: profileId,
          status: "APPROVED",
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Track profile view (async, don't wait)
      if (viewerIp && viewerUserId !== profileId) {
        // Don't track if user is viewing their own profile
        this.analyticsService
          .trackProfileView(profileId, {
            viewerId: viewerUserId,
            ip: viewerIp,
          })
          .catch((err) => {
            this.logger.warn("Failed to track profile view:", err);
          });
      }

      // Update lastActiveAt if viewer is the profile owner
      if (viewerUserId === profileId) {
        this.analyticsService.updateLastActiveAt(profileId).catch((err) => {
          this.logger.warn("Failed to update lastActiveAt:", err);
        });
      }

      // Emit profile viewed event
      if (viewerIp) {
        await this.eventService.emit<ProfileViewedEvent>(
          PROFILE_EVENTS.PROFILE_VIEWED,
          {
            profileUserId: profileId,
            viewerUserId,
            viewerIp,
            timestamp: new Date(),
          }
        );
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        coverImage: user.coverImage,
        role: user.role,
        score: user.score,
        createdAt: user.createdAt,
        artworkCount: artworkCount,
        // Don't return artworks array - they should be fetched via paginated artworks endpoint
        artworks: [],
        reviewCount: user.reviews.length,
        // User profile fields
        bio: user.bio || null,
        location: user.location || null,
        website: user.website || null,
        emailVerified: user.emailVerified || false,
        // Analytics fields
        profileViews: user.profileViews || 0,
        heatScore: user.heatScore || 0,
        lastActiveAt: user.lastActiveAt,
        // Format talent types with nested structure to match frontend expectations
        talentTypes:
          user.talentTypes?.map((ut) => ({
            talentType: {
              id: ut.talentType.id,
              name: ut.talentType.name,
              slug: ut.talentType.slug,
            },
          })) || [],
      };
    } catch (error) {
      this.logger.error(`Failed to fetch public profile ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch authenticated user's own profile
   */
  async getAuthenticatedProfile(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          artworks: {
            select: {
              id: true,
              title: true,
              artist: true,
              photos: true,
              status: true,
              desiredPrice: true,
              createdAt: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
          collections: {
            select: {
              id: true,
              name: true,
              visibility: true,
            },
          },
          talentTypes: {
            select: {
              talentType: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Log to debug what we're getting from database
      this.logger.debug(`User data for ${userId}:`, {
        bio: user.bio,
        location: user.location,
        website: user.website,
        coverImage: user.coverImage,
        emailSubscription: user.emailSubscription,
        profileViews: user.profileViews,
        heatScore: user.heatScore,
        lastActiveAt: user.lastActiveAt,
        talentTypesCount: user.talentTypes?.length,
      });

      const profileData = {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image ?? null,
        coverImage: user.coverImage ?? null,
        bio: user.bio ?? null,
        location: user.location ?? null,
        website: user.website ?? null,
        role: user.role,
        score: user.score ?? 0,
        twoFactorEnabled: user.twoFactorEnabled,
        firstlogin: user.firstlogin ?? null,
        banned: user.banned,
        banReason: user.banReason ?? null,
        banExpires: user.banExpires ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        artworkCount: user.artworks.length,
        reviewCount: user.reviews.length,
        collectionCount: user.collections.length,
        // Analytics & Engagement
        profileViews: user.profileViews ?? 0,
        heatScore: user.heatScore ?? 0,
        lastActiveAt: user.lastActiveAt ?? null,
        // Preferences & Settings
        emailSubscription: user.emailSubscription ?? true,
        themePreference: user.themePreference ?? "light",
        languagePreference: user.languagePreference ?? "en",
        timezone: user.timezone ?? "UTC",
        messagingPreferences: user.messagingPreferences ?? {},
        // Earnings
        earning: user.earning ? Number(user.earning) : 0,
        // Talent Types
        talentTypes:
          user.talentTypes?.map((ut) => ({
            id: ut.talentType.id,
            name: ut.talentType.name,
            slug: ut.talentType.slug,
            description: ut.talentType.description,
            icon: ut.talentType.image, // Map image to icon for frontend compatibility
          })) ?? [],
      };

      // Log the complete response
      this.logger.debug(`Returning profile data for ${userId}:`, {
        hasBio: !!profileData.bio,
        hasLocation: !!profileData.location,
        hasWebsite: !!profileData.website,
        profileViews: profileData.profileViews,
        heatScore: profileData.heatScore,
        talentTypesCount: profileData.talentTypes.length,
      });

      return profileData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch authenticated profile ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    try {
      // Get current user data for comparison
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Prepare update data
      // Convert empty strings to undefined to make fields truly optional
      const updateData: any = {};
      if (updateProfileDto.name !== undefined && updateProfileDto.name !== "")
        updateData.name = updateProfileDto.name;
      if (
        updateProfileDto.avatar !== undefined &&
        updateProfileDto.avatar !== ""
      )
        updateData.image = updateProfileDto.avatar;
      if (
        updateProfileDto.coverImage !== undefined &&
        updateProfileDto.coverImage !== ""
      )
        updateData.coverImage = updateProfileDto.coverImage;
      if (updateProfileDto.bio !== undefined && updateProfileDto.bio !== "")
        updateData.bio = updateProfileDto.bio;
      if (
        updateProfileDto.location !== undefined &&
        updateProfileDto.location !== ""
      )
        updateData.location = updateProfileDto.location;
      if (
        updateProfileDto.website !== undefined &&
        updateProfileDto.website !== ""
      )
        updateData.website = updateProfileDto.website;
      if (updateProfileDto.phone !== undefined && updateProfileDto.phone !== "")
        updateData.phone = updateProfileDto.phone;

      // Update user first
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Handle talent types (many-to-many relationship)
      if (updateProfileDto.talentTypeIds !== undefined) {
        // Validate all talent types exist
        if (updateProfileDto.talentTypeIds.length > 0) {
          const talentTypes = await this.prisma.talentType.findMany({
            where: {
              id: { in: updateProfileDto.talentTypeIds },
            },
          });

          if (talentTypes.length !== updateProfileDto.talentTypeIds.length) {
            const foundIds = talentTypes.map((tt) => tt.id);
            const missingIds = updateProfileDto.talentTypeIds.filter(
              (id) => !foundIds.includes(id)
            );
            throw new NotFoundException(
              `Talent type(s) not found: ${missingIds.join(", ")}`
            );
          }
        }

        // Delete existing talent type associations
        await this.prisma.userOnTalentType.deleteMany({
          where: { userId },
        });

        // Create new associations
        if (updateProfileDto.talentTypeIds.length > 0) {
          await this.prisma.userOnTalentType.createMany({
            data: updateProfileDto.talentTypeIds.map((talentTypeId) => ({
              userId,
              talentTypeId,
            })),
          });
        }
      }

      // Track changes for event
      const changes: Array<{ field: string; oldValue: any; newValue: any }> =
        [];

      const fieldsToTrack = [
        { dtoField: "name", dbField: "name" },
        { dtoField: "avatar", dbField: "image" },
        { dtoField: "coverImage", dbField: "coverImage" },
        { dtoField: "bio", dbField: "bio" },
        { dtoField: "location", dbField: "location" },
        { dtoField: "website", dbField: "website" },
        { dtoField: "phone", dbField: "phone" },
      ];

      for (const { dtoField, dbField } of fieldsToTrack) {
        if (
          updateProfileDto[dtoField] !== undefined &&
          updateProfileDto[dtoField] !== currentUser[dbField]
        ) {
          changes.push({
            field: dbField,
            oldValue: currentUser[dbField],
            newValue: updateProfileDto[dtoField],
          });
        }
      }

      // Emit profile updated event
      await this.eventService.emit<ProfileUpdatedEvent>(
        PROFILE_EVENTS.PROFILE_UPDATED,
        {
          userId: updatedUser.id,
          userName: updatedUser.name,
          email: updatedUser.email,
          changes,
          updatedAt: new Date(),
        }
      );

      this.logger.log(`Profile updated for user ${userId}`);
      return {
        success: true,
        message: PROFILE_MESSAGES.SUCCESS.PROFILE_UPDATED,
        profile: updatedUser,
      };
    } catch (error) {
      this.logger.error(`Failed to update profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          themePreference: true,
          languagePreference: true,
          timezone: true,
          messagingPreferences: true,
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      return {
        success: true,
        data: {
          themePreference: user.themePreference || "light",
          languagePreference: user.languagePreference || "en",
          timezone: user.timezone || "UTC",
          messagingPreferences: user.messagingPreferences || {},
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch preferences for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      const updateData: any = {};

      if (updatePreferencesDto.themePreference !== undefined) {
        updateData.themePreference = updatePreferencesDto.themePreference;
      }
      if (updatePreferencesDto.languagePreference !== undefined) {
        updateData.languagePreference = updatePreferencesDto.languagePreference;
      }
      if (updatePreferencesDto.timezone !== undefined) {
        updateData.timezone = updatePreferencesDto.timezone;
      }
      if (updatePreferencesDto.messagingPreferences !== undefined) {
        updateData.messagingPreferences =
          updatePreferencesDto.messagingPreferences;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Emit preferences updated event
      await this.eventService.emit<PreferencesUpdatedEvent>(
        PROFILE_EVENTS.PREFERENCES_UPDATED,
        {
          userId: updatedUser.id,
          userName: updatedUser.name,
          email: updatedUser.email,
          preferences: {
            themePreference: updatedUser.themePreference,
            languagePreference: updatedUser.languagePreference,
            timezone: updatedUser.timezone,
            messagingPreferences: updatedUser.messagingPreferences,
          },
          updatedAt: new Date(),
        }
      );

      this.logger.log(`Preferences updated for user ${userId}`);

      return {
        success: true,
        message:
          PROFILE_MESSAGES.SUCCESS.PREFERENCES_UPDATED ||
          "Preferences updated successfully",
        data: {
          themePreference: updatedUser.themePreference,
          languagePreference: updatedUser.languagePreference,
          timezone: updatedUser.timezone,
          messagingPreferences: updatedUser.messagingPreferences,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to update preferences for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch user settings
   */
  async getSettings(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // TODO: Implement settings model in Prisma schema
      // Return basic settings from User model
      return {
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        email: user.email,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user settings
   */
  async updateSettings(userId: string, updateSettingsDto: UpdateSettingsDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Prepare settings update data
      const settingsData: any = {};

      // Privacy settings
      if (updateSettingsDto.allowMessagesFromAnyone !== undefined)
        settingsData.allowMessagesFromAnyone =
          updateSettingsDto.allowMessagesFromAnyone;
      if (updateSettingsDto.showOnlineStatus !== undefined)
        settingsData.showOnlineStatus = updateSettingsDto.showOnlineStatus;
      if (updateSettingsDto.allowComments !== undefined)
        settingsData.allowComments = updateSettingsDto.allowComments;
      if (updateSettingsDto.allowTagging !== undefined)
        settingsData.allowTagging = updateSettingsDto.allowTagging;
      if (updateSettingsDto.searchable !== undefined)
        settingsData.searchable = updateSettingsDto.searchable;
      if (updateSettingsDto.indexable !== undefined)
        settingsData.indexable = updateSettingsDto.indexable;

      // Security settings
      if (updateSettingsDto.loginNotifications !== undefined)
        settingsData.loginNotifications = updateSettingsDto.loginNotifications;
      if (updateSettingsDto.suspiciousActivityAlerts !== undefined)
        settingsData.suspiciousActivityAlerts =
          updateSettingsDto.suspiciousActivityAlerts;

      // TODO: Implement settings model in Prisma schema
      // For now, only update User table for security settings and email
      const userUpdateData: any = {};
      if (updateSettingsDto.twoFactorEnabled !== undefined)
        userUpdateData.twoFactorEnabled = updateSettingsDto.twoFactorEnabled;
      if (updateSettingsDto.email !== undefined) {
        userUpdateData.email = updateSettingsDto.email;
        userUpdateData.emailVerified = false; // Reset verification when email changes
      }

      let updatedUser = user;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await this.prisma.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      // Emit settings updated event
      await this.eventService.emit<SettingsUpdatedEvent>(
        PROFILE_EVENTS.SETTINGS_UPDATED,
        {
          userId,
          userName: user.name,
          email: user.email,
          settingsType: "security",
          changes: updateSettingsDto,
          updatedAt: new Date(),
        }
      );

      this.logger.log(`Settings updated for user ${userId}`);
      return {
        success: true,
        message: PROFILE_MESSAGES.SUCCESS.SETTINGS_UPDATED,
        settings: {
          twoFactorEnabled: updatedUser.twoFactorEnabled,
          email: updatedUser.email,
          emailVerified: updatedUser.emailVerified,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * List user's uploaded artworks (including drafts)
   */
  async getUploadedArtworks(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      const skip = (page - 1) * limit;

      const [artworks, total] = await Promise.all([
        this.prisma.artwork.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
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
      this.logger.error(`Failed to fetch artworks for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve user activity logs
   * TODO: Implement ActivityLog model in Prisma schema if needed
   */
  async getActivityLogs(userId: string, page: number = 1, limit: number = 20) {
    // TODO: Implement activityLog model in Prisma schema
    return {
      activities: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0,
      },
    };
  }

  /**
   * Log user activity
   * TODO: Implement ActivityLog model in Prisma schema if needed
   */
  async logActivity(
    userId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    metadata?: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    // TODO: Implement activityLog model in Prisma schema
    // Activity logging is currently disabled
    this.logger.debug(
      `Activity logged (not persisted): ${action} for user ${userId}`
    );
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string, deactivateDto: DeactivateAccountDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Mark user as banned (deactivated)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          banned: true,
          banReason:
            deactivateDto.reason || "User requested account deactivation",
        },
      });

      // Emit account deactivated event
      await this.eventService.emit<AccountDeactivatedEvent>(
        PROFILE_EVENTS.ACCOUNT_DEACTIVATED,
        {
          userId,
          userName: user.name,
          email: user.email,
          reason: deactivateDto.reason,
          deactivatedAt: new Date(),
          canReactivate: !deactivateDto.deleteData,
        }
      );

      this.logger.log(`Account deactivated for user ${userId}`);
      return {
        success: true,
        message: PROFILE_MESSAGES.SUCCESS.ACCOUNT_DEACTIVATED,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deactivate account for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Reactivate user account
   */
  async reactivateAccount(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      if (!user.banned) {
        return {
          success: false,
          message: "Account is not deactivated",
        };
      }

      // Reactivate user
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          banned: false,
          banReason: null,
          banExpires: null,
        },
      });

      this.logger.log(`Account reactivated for user ${userId}`);
      return {
        success: true,
        message: "Account successfully reactivated",
      };
    } catch (error) {
      this.logger.error(
        `Failed to reactivate account for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get user profile statistics
   */
  async getStatistics(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          artworks: true,
          reviews: true,
          interactions: {
            where: { type: "view" },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Calculate statistics
      const totalArtworks = user.artworks.length;
      const approvedArtworks = user.artworks.filter(
        (a) => a.status === "APPROVED"
      ).length;
      const pendingArtworks = user.artworks.filter(
        (a) => a.status === "PENDING"
      ).length;
      const soldArtworks = user.artworks.filter(
        (a) => a.status === "SOLD"
      ).length;

      // Get total views from interactions
      const totalViews = await this.prisma.interaction.count({
        where: {
          artwork: {
            userId: userId,
          },
          type: "view",
        },
      });

      // Get total likes
      const totalLikes = await this.prisma.interaction.count({
        where: {
          artwork: {
            userId: userId,
          },
          type: "like",
        },
      });

      // TODO: Implement activityLog model in Prisma schema
      const activityCount = 0;

      return {
        totalArtworks,
        approvedArtworks,
        pendingArtworks,
        soldArtworks,
        totalReviews: user.reviews.length,
        totalViews,
        totalLikes,
        activityCount,
        accountScore: user.score,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch statistics for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { image: null },
      });

      this.logger.log(`Avatar deleted for user ${userId}`);
      return {
        success: true,
        message: "Avatar deleted successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to delete avatar for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete user cover image
   * TODO: Add coverImage field to User model if needed
   */
  async deleteCover(userId: string) {
    // TODO: Implement coverImage field in User model
    this.logger.log(
      `Cover image delete requested for user ${userId} (not implemented)`
    );
    return {
      success: true,
      message: "Cover image deletion not yet implemented",
    };
  }

  /**
   * Get user's preferred payment method for purchases
   */
  async getPaymentMethodPreference(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { paymentMethodPreference: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        paymentMethodPreference: user.paymentMethodPreference || 'paypal', // Default to paypal
      };
    } catch (error) {
      this.logger.error('Failed to get payment method preference:', error);
      throw error;
    }
  }

  /**
   * Update user's preferred payment method for purchases
   */
  async updatePaymentMethodPreference(userId: string, paymentMethodPreference: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Validate payment method
      if (paymentMethodPreference !== 'paypal' && paymentMethodPreference !== 'chapa') {
        throw new BadRequestException('Invalid payment method. Must be "paypal" or "chapa"');
      }

      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { paymentMethodPreference },
        select: { paymentMethodPreference: true },
      });

      this.logger.log(`Payment method preference updated for user ${userId}: ${paymentMethodPreference}`);

      return {
        success: true,
        message: 'Payment method preference updated successfully',
        data: {
          paymentMethodPreference: updated.paymentMethodPreference,
        },
      };
    } catch (error) {
      this.logger.error('Failed to update payment method preference:', error);
      throw error;
    }
  }
}
