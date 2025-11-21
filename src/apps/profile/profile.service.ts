import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database';
import { EventService } from '../../libraries/event';
import {
  UpdateProfileDto,
  UpdatePreferencesDto,
  UpdateSettingsDto,
  DeactivateAccountDto,
} from './dto';

import { PROFILE_MESSAGES } from './constants';
import {
  AccountDeactivatedEvent,
  PreferencesUpdatedEvent,
  PROFILE_EVENTS,
  ProfileUpdatedEvent,
  ProfileViewedEvent,
  SettingsUpdatedEvent,
} from './events';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  /**
   * Fetch public user profile by ID
   */
  async getPublicProfile(
    profileId: string,
    viewerUserId?: string,
    viewerIp?: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: profileId },
        include: {
          artworks: {
            where: { status: 'APPROVED' },
            select: {
              id: true,
              title: true,
              artist: true,
              photos: true,
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
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
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
          },
        );
      }

      return {
        id: user.id,
        name: user.name,
        image: user.image,
        coverImage: (user as any).coverImage,
        role: user.role,
        score: user.score,
        createdAt: user.createdAt,
        artworkCount: user.artworks.length,
        artworks: user.artworks,
        reviewCount: user.reviews.length,
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
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        coverImage: (user as any).coverImage,
        role: user.role,
        score: user.score,
        twoFactorEnabled: user.twoFactorEnabled,
        firstlogin: user.firstlogin,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        artworkCount: user.artworks.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch authenticated profile ${userId}:`,
        error,
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
      if (updateProfileDto.name !== undefined && updateProfileDto.name !== '')
        updateData.name = updateProfileDto.name;
      if (updateProfileDto.avatar !== undefined && updateProfileDto.avatar !== '')
        updateData.image = updateProfileDto.avatar;
      if (updateProfileDto.coverImage !== undefined && updateProfileDto.coverImage !== '')
        updateData.coverImage = updateProfileDto.coverImage;
      if (updateProfileDto.bio !== undefined && updateProfileDto.bio !== '')
        updateData.bio = updateProfileDto.bio;
      if (updateProfileDto.location !== undefined && updateProfileDto.location !== '')
        updateData.location = updateProfileDto.location;
      if (updateProfileDto.website !== undefined && updateProfileDto.website !== '')
        updateData.website = updateProfileDto.website;
      if (updateProfileDto.phone !== undefined && updateProfileDto.phone !== '')
        updateData.phone = updateProfileDto.phone;

      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Track changes for event
      const changes: Array<{ field: string; oldValue: any; newValue: any }> =
        [];

      const fieldsToTrack = [
        { dtoField: 'name', dbField: 'name' },
        { dtoField: 'avatar', dbField: 'image' },
        { dtoField: 'coverImage', dbField: 'coverImage' },
        { dtoField: 'bio', dbField: 'bio' },
        { dtoField: 'location', dbField: 'location' },
        { dtoField: 'website', dbField: 'website' },
        { dtoField: 'phone', dbField: 'phone' },
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
        },
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
   * TODO: Implement UserPreferences model in Prisma schema if needed
   */
  async getPreferences(userId: string) {
    // TODO: Implement preferences model in Prisma schema
    throw new NotFoundException('Preferences feature not yet implemented');
    // try {
    //   const user = await this.prisma.user.findUnique({
    //     where: { id: userId },
    //     include: { preferences: true },
    //   });

    //   if (!user) {
    //     throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
    //   }

    //   // Create default preferences if they don't exist
    //   if (!user.preferences) {
    //     const defaultPreferences = await this.prisma.userPreferences.create({
    //       data: { userId },
    //     });
    //     return defaultPreferences;
    //   }

    //   return user.preferences;
    // } catch (error) {
    //   this.logger.error(
    //     `Failed to fetch preferences for user ${userId}:`,
    //     error,
    //   );
    //   throw error;
    // }
  }

  /**
   * Update user preferences
   * TODO: Implement UserPreferences model in Prisma schema if needed
   */
  async updatePreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto,
  ) {
    // TODO: Implement preferences model in Prisma schema
    throw new NotFoundException('Preferences feature not yet implemented');
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
          settingsType: 'security',
          changes: updateSettingsDto,
          updatedAt: new Date(),
        },
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
    limit: number = 10,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [artworks, total] = await Promise.all([
        this.prisma.artwork.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
    userAgent?: string,
  ) {
    // TODO: Implement activityLog model in Prisma schema
    // Activity logging is currently disabled
    this.logger.debug(
      `Activity logged (not persisted): ${action} for user ${userId}`,
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
            deactivateDto.reason || 'User requested account deactivation',
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
        },
      );

      this.logger.log(`Account deactivated for user ${userId}`);
      return {
        success: true,
        message: PROFILE_MESSAGES.SUCCESS.ACCOUNT_DEACTIVATED,
      };
    } catch (error) {
      this.logger.error(
        `Failed to deactivate account for user ${userId}:`,
        error,
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
          message: 'Account is not deactivated',
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
        message: 'Account successfully reactivated',
      };
    } catch (error) {
      this.logger.error(
        `Failed to reactivate account for user ${userId}:`,
        error,
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
            where: { type: 'view' },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(PROFILE_MESSAGES.ERROR.PROFILE_NOT_FOUND);
      }

      // Calculate statistics
      const totalArtworks = user.artworks.length;
      const approvedArtworks = user.artworks.filter(
        (a) => a.status === 'APPROVED',
      ).length;
      const pendingArtworks = user.artworks.filter(
        (a) => a.status === 'PENDING',
      ).length;
      const soldArtworks = user.artworks.filter(
        (a) => a.status === 'SOLD',
      ).length;

      // Get total views from interactions
      const totalViews = await this.prisma.interaction.count({
        where: {
          artwork: {
            userId: userId,
          },
          type: 'view',
        },
      });

      // Get total likes
      const totalLikes = await this.prisma.interaction.count({
        where: {
          artwork: {
            userId: userId,
          },
          type: 'like',
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
        error,
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
        message: 'Avatar deleted successfully',
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
      `Cover image delete requested for user ${userId} (not implemented)`,
    );
    return {
      success: true,
      message: 'Cover image deletion not yet implemented',
    };
  }
}
