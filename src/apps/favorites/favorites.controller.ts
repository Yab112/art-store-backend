import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto';
import { AuthGuard } from '@/core/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

/**
 * Favorites Controller
 * Handles all favorites-related endpoints
 */
@ApiTags('Favorites')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /**
   * POST /favorites
   * Add artwork to favorites
   */
  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Add artwork to favorites',
    description: 'Add an artwork to the authenticated user\'s favorites list.',
  })
  @ApiBody({ type: AddFavoriteDto })
  @ApiResponse({
    status: 201,
    description: 'Artwork added to favorites successfully',
  })
  @ApiResponse({ status: 400, description: 'Artwork already in favorites or max favorites reached' })
  @ApiResponse({ status: 404, description: 'Artwork not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addToFavorites(
    @Body() addFavoriteDto: AddFavoriteDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const favorite = await this.favoritesService.addToFavorites(
        userId,
        addFavoriteDto.artworkId,
      );

      return {
        success: true,
        message: 'Artwork added to favorites successfully',
        favorite,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to add to favorites',
      };
    }
  }

  /**
   * GET /favorites
   * Get user's favorites list
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get user favorites',
    description: 'Retrieve a paginated list of artworks in the authenticated user\'s favorites.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Favorites retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserFavorites(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.favoritesService.getUserFavorites(
        userId,
        page,
        limit,
      );

      return {
        success: true,
        message: 'Favorites retrieved successfully',
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to fetch favorites',
      };
    }
  }

  /**
   * DELETE /favorites/:artworkId
   * Remove artwork from favorites
   */
  @Delete(':artworkId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Remove artwork from favorites',
    description: 'Remove an artwork from the authenticated user\'s favorites list.',
  })
  @ApiParam({ name: 'artworkId', description: 'Artwork ID to remove from favorites' })
  @ApiResponse({
    status: 200,
    description: 'Artwork removed from favorites successfully',
  })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeFromFavorites(
    @Param('artworkId') artworkId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.favoritesService.removeFromFavorites(
        userId,
        artworkId,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to remove from favorites',
      };
    }
  }

  /**
   * GET /favorites/check/:artworkId
   * Check if artwork is in favorites
   */
  @Get('check/:artworkId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Check if artwork is in favorites',
    description: 'Check if an artwork is in the authenticated user\'s favorites.',
  })
  @ApiParam({ name: 'artworkId', description: 'Artwork ID to check' })
  @ApiResponse({
    status: 200,
    description: 'Check result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        isFavorite: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkFavorite(
    @Param('artworkId') artworkId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const isFavorite = await this.favoritesService.isFavorite(
        userId,
        artworkId,
      );

      return {
        success: true,
        isFavorite,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to check favorite',
      };
    }
  }

  /**
   * GET /favorites/count
   * Get user's favorites count
   */
  @Get('count')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get favorites count',
    description: 'Get the total number of artworks in the authenticated user\'s favorites.',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorites count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        count: { type: 'number', example: 42 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFavoritesCount(@Request() req: any) {
    try {
      const userId = req.user.id;
      const count = await this.favoritesService.getFavoritesCount(userId);

      return {
        success: true,
        count,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get favorites count',
      };
    }
  }
}

