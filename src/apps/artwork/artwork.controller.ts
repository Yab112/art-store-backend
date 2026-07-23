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
import { Public } from "@/core/decorators/public.decorator";
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
    } catch (error: unknown) {
      // Log the full error for debugging
      console.error("Error submitting artwork:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit artwork. Please try again.";

      return {
        success: false,
        message,
      };
    }
  }

  @Get()
  async findAll(@Query() query: ArtworkQueryDto) {
    return this.artworkService.findAll(query);
  }

  @Get("admin")
  @UseGuards(AuthGuard)
  async findAllAdmin(@Query() query: ArtworkQueryDto, @Request() req: any) {
    const userId = req.user.id;
    return this.artworkService.findAllAdmin(query, userId);
  }

  @Get("my-artworks")
  @UseGuards(AuthGuard)
  async findMyArtworks(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query("status") status: string | undefined,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.artworkService.findByUser(userId, page, limit, status);
  }

  // IMPORTANT: More specific routes must come BEFORE generic :id route
  @Get(":id/similar-artworks-by-category")
  async getSimilarArtworksByCategory(
    @Param("id") id: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 8,
  ) {
    try {
      const similarArtworks =
        await this.artworkService.getSimilarArtworksByCategory(id, limit);
      return {
        success: true,
        artworks: similarArtworks,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to fetch similar artworks",
        artworks: [],
      };
    }
  }

  @Get(":id")
  @Public()
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  async updateStatus(@Param("id") id: string, @Body("status") status: string) {
    return this.artworkService.updateStatus(id, status as any);
  }

  @Post(":id/like")
  @UseGuards(AuthGuard)
  async like(@Param("id") id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        "User ID not found. Please sign in again.",
      );
    }
    return this.artworkService.likeArtwork(id, userId);
  }

  @Delete(":id/like")
  @UseGuards(AuthGuard)
  async unlike(@Param("id") id: string, @Request() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException(
        "User ID not found. Please sign in again.",
      );
    }
    return this.artworkService.unlikeArtwork(id, userId);
  }
}
