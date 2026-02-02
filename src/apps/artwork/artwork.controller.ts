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
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ArtworkService } from "./artwork.service";
import { CreateArtworkDto, UpdateArtworkDto, ArtworkQueryDto } from "./dto";
import { AuthGuard } from "@/core/guards/auth.guard";
// import { ArtworkStatus } from '@prisma/client';

@ApiTags("Artworks")
@Controller("artworks")
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}

  @Post("submit")
  @UseGuards(AuthGuard)
  async submitArtwork(
    @Body() createArtworkDto: CreateArtworkDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        console.error("User ID not found in request:", {
          user: req.user,
          hasUser: !!req.user,
          userId: req.user?.id,
        });
        return {
          success: false,
          message: "User ID not found. Please sign in again.",
        };
      }

      console.log("Artwork submission request:", {
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
        message: "Artwork submitted successfully",
        artworkId: artwork.id,
        artwork,
      };
    } catch (error) {
      // Log the full error for debugging
      console.error("Error submitting artwork:", error);

      return {
        success: false,
        message:
          error.message ||
          error.response?.message ||
          "Failed to submit artwork. Please try again.",
      };
    }
  }

  @Get()
  async findAll(@Query() query: ArtworkQueryDto) {
    return this.artworkService.findAll(query);
  }

  @Get("my-artworks")
  @UseGuards(AuthGuard)
  async findMyArtworks(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 10,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.artworkService.findByUser(userId, page, limit);
  }

  @Get("trending")
  @ApiOperation({
    summary: "Get trending artworks",
    description:
      "Returns artworks sorted by engagement metrics (views, likes, comments, favorites) with recency bonus",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of trending artworks to return (default: 12)",
    example: 12,
  })
  async getTrendingArtworks(
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 12,
  ) {
    const artworks = await this.artworkService.getTrendingArtworks(limit);
    return {
      success: true,
      artworks,
    };
  }

  @Get(":id/similar-artworks")
  @ApiOperation({
    summary: "Get artworks similar to a specific artwork",
    description:
      "Returns artworks that share collections with the given artwork, ranked by number of shared collections. Excludes the current artwork.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of similar artworks to return (default: 12)",
    example: 12,
  })
  async getSimilarArtworks(
    @Param("id") artworkId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      const artworks = await this.artworkService.getSimilarArtworks(
        artworkId,
        limit || 12,
      );

      return {
        success: true,
        artworks,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch similar artworks",
      };
    }
  }

  @Get(":id/similar-artworks-by-category")
  @ApiOperation({
    summary: "Get artworks similar to a specific artwork by category",
    description:
      "Returns artworks that share at least one category with the given artwork, ranked by number of shared categories. Excludes the current artwork.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of similar artworks to return (default: 12)",
    example: 12,
  })
  async getSimilarArtworksByCategory(
    @Param("id") artworkId: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      const artworks = await this.artworkService.getSimilarArtworksByCategory(
        artworkId,
        limit || 12,
      );

      return {
        success: true,
        artworks,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error.message || "Failed to fetch similar artworks by category",
      };
    }
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req: any) {
    const userId = req.user?.id;
    const artwork = await this.artworkService.findOne(id, userId);
    return {
      success: true,
      artwork,
    };
  }

  @Patch(":id")
  @UseGuards(AuthGuard)
  async update(
    @Param("id") id: string,
    @Body() updateArtworkDto: UpdateArtworkDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        "User ID not found. Please sign in again.",
      );
    }
    return this.artworkService.update(id, updateArtworkDto, userId);
  }

  @Delete(":id")
  @UseGuards(AuthGuard)
  async remove(@Param("id") id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        "User ID not found. Please sign in again.",
      );
    }
    return this.artworkService.remove(id, userId);
  }

  @Patch(":id/status")
  async updateStatus(@Param("id") id: string, @Body("status") status: string) {
    return this.artworkService.updateStatus(id, status as any);
  }
}
