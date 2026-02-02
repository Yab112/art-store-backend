import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  Ip,
} from "@nestjs/common";
import { ProfileService } from "./profile.service";
import {
  UpdateProfileDto,
  UpdatePreferencesDto,
  UpdateSettingsDto,
  DeactivateAccountDto,
} from "./dto";
import { UpdatePaymentMethodPreferenceDto } from "./dto/update-payment-method-preference.dto";
import { AuthGuard } from "@/core/guards/auth.guard";
import { Public } from "@/core/decorators/public.decorator";
import { UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";

/**
 * Profile Controller
 * Handles all profile-related endpoints
 */
@ApiTags("Profile")
@UseGuards(AuthGuard)
@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * GET /profile/payment-method-preference
   * Get user's preferred payment method for purchases
   * MUST come before @Get(":id") to avoid route conflicts
   */
  @Get("payment-method-preference")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get user's preferred payment method" })
  async getPaymentMethodPreference(@Request() req: any) {
    try {
      const userId = req.user.id;
      const preference =
        await this.profileService.getPaymentMethodPreference(userId);
      return {
        success: true,
        data: preference,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch payment method preference",
      };
    }
  }

  /**
   * PUT /profile/payment-method-preference
   * Update user's preferred payment method for purchases
   * MUST come before @Get(":id") to avoid route conflicts
   */
  @Put("payment-method-preference")
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Update user's preferred payment method" })
  async updatePaymentMethodPreference(
    @Body() dto: UpdatePaymentMethodPreferenceDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.profileService.updatePaymentMethodPreference(
        userId,
        dto.paymentMethodPreference,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update payment method preference",
      };
    }
  }

  /**
   * GET /profile/:id
   * Fetch public user profile with their artworks & collections (Public)
   * This endpoint is public and doesn't require authentication
   */
  @Get(":id")
  @Public()
  async getPublicProfile(
    @Param("id") id: string,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    try {
      // Try to get user from session, but don't require it
      const viewerUserId = req.user?.id; // Optional - user might not be logged in
      const profile = await this.profileService.getPublicProfile(
        id,
        viewerUserId,
        ip,
      );

      return {
        success: true,
        profile,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch profile",
      };
    }
  }

  /**
   * GET /profile
   * Fetch authenticated user profile
   */
  @Get()
  @UseGuards(AuthGuard)
  async getAuthenticatedProfile(@Request() req: any) {
    try {
      const userId = req.user.id;
      const profile = await this.profileService.getAuthenticatedProfile(userId);

      return {
        success: true,
        profile,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch profile",
      };
    }
  }

  /**
   * PUT /profile or PATCH /profile
   * Update user profile details
   */
  @Put()
  @UseGuards(AuthGuard)
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.profileService.updateProfile(userId, updateProfileDto);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update profile",
      };
    }
  }

  /**
   * PATCH /profile
   * Alternative endpoint for partial profile updates
   */
  @Patch()
  @UseGuards(AuthGuard)
  async patchProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @Request() req: any,
  ) {
    return this.updateProfile(updateProfileDto, req);
  }

  /**
   * PUT /profile/preferences
   * Update user preferences such as notifications or language
   */
  @Put("preferences")
  @UseGuards(AuthGuard)
  async updatePreferences(
    @Body() updatePreferencesDto: UpdatePreferencesDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.profileService.updatePreferences(
        userId,
        updatePreferencesDto,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update preferences",
      };
    }
  }

  /**
   * GET /profile/settings
   * Fetch user settings
   */
  @Get("settings")
  @UseGuards(AuthGuard)
  async getSettings(@Request() req: any) {
    try {
      const userId = req.user.id;
      const settings = await this.profileService.getSettings(userId);

      return {
        success: true,
        settings,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch settings",
      };
    }
  }

  /**
   * PUT /profile/settings
   * Update user account settings
   */
  @Put("settings")
  @UseGuards(AuthGuard)
  async updateSettings(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.profileService.updateSettings(
        userId,
        updateSettingsDto,
      );
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update settings",
      };
    }
  }

  /**
   * POST /profile/subscribe-newsletter
   * Public endpoint to subscribe to newsletter by email
   */
  @Post("subscribe-newsletter")
  @Public()
  @ApiOperation({ summary: "Subscribe to newsletter (public endpoint)" })
  async subscribeNewsletter(@Body() body: { email: string }) {
    try {
      return await this.profileService.subscribeNewsletter(body.email);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to subscribe to newsletter",
      };
    }
  }

  /**
   * GET /profile/uploads
   * List uploaded artworks including drafts
   */
  @Get("uploads")
  @UseGuards(AuthGuard)
  async getUploadedArtworks(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 10,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.profileService.getUploadedArtworks(
        userId,
        page,
        limit,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch uploads",
      };
    }
  }

  /**
   * GET /profile/activity
   * Retrieve user activity logs
   */
  @Get("activity")
  @UseGuards(AuthGuard)
  async getActivityLogs(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.profileService.getActivityLogs(
        userId,
        page,
        limit,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch activity logs",
      };
    }
  }

  /**
   * POST /profile/deactivate
   * Deactivate user account
   */
  @Post("deactivate")
  @UseGuards(AuthGuard)
  async deactivateAccount(
    @Body() deactivateDto: DeactivateAccountDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      return await this.profileService.deactivateAccount(userId, deactivateDto);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to deactivate account",
      };
    }
  }

  /**
   * PUT /profile/avatar
   * Update profile avatar with S3 URL (uploaded from frontend)
   */
  @Put("avatar")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Update profile avatar",
    description:
      "Update profile avatar with S3 public URL. Frontend should upload to S3 first using presigned URL, then send the public URL here.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        avatarUrl: {
          type: "string",
          description: "S3 public URL of the avatar image",
          example: "https://bucket.s3.region.amazonaws.com/images/abc123.jpg",
        },
      },
      required: ["avatarUrl"],
    },
  })
  @ApiResponse({ status: 200, description: "Avatar updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid URL" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateAvatar(
    @Body("avatarUrl") avatarUrl: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;

      if (!avatarUrl) {
        return {
          success: false,
          message: "Avatar URL is required",
        };
      }

      // Update profile with new avatar URL
      await this.profileService.updateProfile(userId, {
        avatar: avatarUrl,
      });

      return {
        success: true,
        message: "Avatar updated successfully",
        avatarUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update avatar",
      };
    }
  }

  /**
   * PUT /profile/cover
   * Update profile cover image with S3 URL (uploaded from frontend)
   */
  @Put("cover")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Update profile cover image",
    description:
      "Update profile cover image with S3 public URL. Frontend should upload to S3 first using presigned URL, then send the public URL here.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        coverUrl: {
          type: "string",
          description: "S3 public URL of the cover image",
          example: "https://bucket.s3.region.amazonaws.com/images/abc123.jpg",
        },
      },
      required: ["coverUrl"],
    },
  })
  @ApiResponse({ status: 200, description: "Cover image updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid URL" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateCover(@Body("coverUrl") coverUrl: string, @Request() req: any) {
    try {
      const userId = req.user.id;

      if (!coverUrl) {
        return {
          success: false,
          message: "Cover URL is required",
        };
      }

      // Update profile with new cover image URL
      await this.profileService.updateProfile(userId, {
        coverImage: coverUrl,
      });

      return {
        success: true,
        message: "Cover image updated successfully",
        coverUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update cover image",
      };
    }
  }
}
