import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { CreateArtworkDto, UpdateArtworkDto, ArtworkQueryDto } from './dto';
import { AuthGuard } from '@/core/guards/auth.guard';
// import { ArtworkStatus } from '@prisma/client';

@Controller('artworks')
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}

  @Post('submit')
  @UseGuards(AuthGuard)
  async submitArtwork(
    @Body() createArtworkDto: CreateArtworkDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        console.error('User ID not found in request:', {
          user: req.user,
          hasUser: !!req.user,
          userId: req.user?.id,
        });
        return {
          success: false,
          message: 'User ID not found. Please sign in again.',
        };
      }

      console.log('Artwork submission request:', {
        userId,
        userIdType: typeof userId,
        userIdLength: userId?.length,
        userEmail: req.user?.email,
      });

      const artwork = await this.artworkService.create(
        createArtworkDto,
        userId,
      );

      return {
        success: true,
        message: 'Artwork submitted successfully',
        artworkId: artwork.id,
        artwork,
      };
    } catch (error) {
      // Log the full error for debugging
      console.error('Error submitting artwork:', error);
      
      return {
        success: false,
        message:
          error.message ||
          error.response?.message ||
          'Failed to submit artwork. Please try again.',
      };
    }
  }

  @Get()
  async findAll(@Query() query: ArtworkQueryDto) {
    return this.artworkService.findAll(query);
  }

  @Get('my-artworks')
  @UseGuards(AuthGuard)
  async findMyArtworks(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.artworkService.findByUser(userId, page, limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    const artwork = await this.artworkService.findOne(id, userId);
    return {
      success: true,
      artwork,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateArtworkDto: UpdateArtworkDto,
    @Request() req: any, // This will be replaced with proper auth guard
  ) {
    const userId = req.user?.id || 'mock-user-id';
    return this.artworkService.update(id, updateArtworkDto, userId);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Request() req: any, // This will be replaced with proper auth guard
  ) {
    const userId = req.user?.id || 'mock-user-id';
    return this.artworkService.remove(id, userId);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.artworkService.updateStatus(id, status as any);
  }
}
