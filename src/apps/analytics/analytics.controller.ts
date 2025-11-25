import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { TrackProfileViewDto } from './dto/analytics.dto';
import { AuthGuard } from '../../core/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get user analytics
   */
  @Get('profile/:userId')
  @UseGuards(AuthGuard)
  async getProfileAnalytics(@Param('userId') userId: string) {
    try {
      const analytics = await this.analyticsService.getUserAnalytics(userId);
      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track profile view
   */
  @Post('track-view/:userId')
  async trackProfileView(
    @Param('userId') userId: string,
    @Body() dto: TrackProfileViewDto,
  ) {
    try {
      await this.analyticsService.trackProfileView(userId, dto);
      return {
        success: true,
        message: 'Profile view tracked successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to track profile view for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get heat score for a user
   */
  @Get('heat-score/:userId')
  async getHeatScore(@Param('userId') userId: string) {
    try {
      const heatScore = await this.analyticsService.calculateHeatScore(userId);
      return {
        success: true,
        data: {
          userId,
          heatScore,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get heat score for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Recalculate all heat scores (admin only)
   */
  @Post('recalculate-all')
  @UseGuards(AuthGuard)
  async recalculateAllHeatScores(@CurrentUser() user: any) {
    try {
      // Check if user is admin
      if (user.role !== 'ADMIN') {
        return {
          success: false,
          message: 'Unauthorized. Admin access required.',
        };
      }

      // Run in background (don't wait)
      this.analyticsService.recalculateAllHeatScores().catch((err) => {
        this.logger.error('Background heat score recalculation failed:', err);
      });

      return {
        success: true,
        message: 'Heat score recalculation started in background',
      };
    } catch (error) {
      this.logger.error('Failed to start heat score recalculation:', error);
      throw error;
    }
  }
}

