import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddArtworkDto,
  CollectionsQueryDto,
} from "./dto";
import { AuthGuard } from "@/core/guards/auth.guard";
import { UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";

/**
 * Collections Controller
 * Handles all collection-related endpoints
 */
@ApiTags("Collections")
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * POST /collections
   * Create a new collection
   */
  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() createCollectionDto: CreateCollectionDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const collection = await this.collectionsService.create(
        createCollectionDto,
        userId,
      );

      return {
        success: true,
        message: "Collection created successfully",
        collection,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to create collection",
      };
    }
  }

  /**
   * GET /collections/hot
   * Get hot collections sorted by engagement score
   */
  @Get("hot")
  @ApiOperation({
    summary: "Get hot collections",
    description:
      "Returns public collections sorted by engagement score (views, likes, comments, favorites)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of hot collections to return (default: 10)",
    example: 10,
  })
  async getHotCollections(
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      const collections = await this.collectionsService.getHotCollections(
        limit || 10,
      );

      return {
        success: true,
        collections,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch hot collections",
      };
    }
  }

  /**
   * GET /collections
   * List all collections (paginated)
   * If visibility filter is provided, filters by it. Otherwise returns all collections.
   */
  @Get()
  @ApiOperation({ summary: "Get all collections with pagination and filters" })
  async findAll(@Query() query: CollectionsQueryDto, @Request() req: any) {
    try {
      const result = await this.collectionsService.findAll(
        query.page,
        query.limit,
        query.search,
        req.user?.id,
        query.visibility,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch collections",
      };
    }
  }

  /**
   * GET /collections/my-collections
   * Get user's own collections
   */
  @Get("my-collections")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Get user's own collections with pagination and filters",
  })
  async findMyCollections(
    @Query() query: CollectionsQueryDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.findByUser(
        userId,
        query.page,
        query.limit,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch collections",
      };
    }
  }

  /**
   * GET /collections/:id
   * Get collection details with artworks
   */
  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req: any) {
    try {
      // Optionally extract user session if available (for private collections)
      let userId: string | undefined;
      try {
        const { auth } = await import("../../auth");
        const session = await auth.api.getSession({
          headers: req.headers as any,
        });
        userId = session?.user?.id;
      } catch {
        // No session available, continue without userId
        userId = undefined;
      }

      const collection = await this.collectionsService.findOne(id, userId);

      return {
        success: true,
        collection,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch collection",
      };
    }
  }

  /**
   * PUT /collections/:id
   * Update collection (name, description, cover)
   */
  @Put(":id")
  @UseGuards(AuthGuard)
  async update(
    @Param("id") id: string,
    @Body() updateCollectionDto: UpdateCollectionDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const collection = await this.collectionsService.update(
        id,
        updateCollectionDto,
        userId,
      );

      return {
        success: true,
        message: "Collection updated successfully",
        collection,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update collection",
      };
    }
  }

  /**
   * DELETE /collections/:id
   * Delete collection
   */
  @Delete(":id")
  @UseGuards(AuthGuard)
  async remove(@Param("id") id: string, @Request() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.remove(id, userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to delete collection",
      };
    }
  }

  /**
   * POST /collections/:id/artworks
   * Add artwork to collection
   */
  @Post(":id/artworks")
  @UseGuards(AuthGuard)
  async addArtwork(
    @Param("id") id: string,
    @Body() addArtworkDto: AddArtworkDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.addArtwork(
        id,
        addArtworkDto.artworkId,
        userId,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to add artwork to collection",
      };
    }
  }

  /**
   * DELETE /collections/:id/artworks/:artworkId
   * Remove artwork from collection
   */
  @Delete(":id/artworks/:artworkId")
  @UseGuards(AuthGuard)
  async removeArtwork(
    @Param("id") id: string,
    @Param("artworkId") artworkId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.removeArtwork(
        id,
        artworkId,
        userId,
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to remove artwork from collection",
      };
    }
  }

  /**
   * POST /collections/:id/publish
   * Make collection public
   */
  @Post(":id/publish")
  @UseGuards(AuthGuard)
  async publish(@Param("id") id: string, @Request() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.publish(id, userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to publish collection",
      };
    }
  }

  /**
   * POST /collections/:id/unpublish
   * Make collection private
   */
  @Post(":id/unpublish")
  @UseGuards(AuthGuard)
  async unpublish(@Param("id") id: string, @Request() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.collectionsService.unpublish(id, userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to unpublish collection",
      };
    }
  }

  /**
   * GET /collections/:id/artworks
   * Get paginated artworks in a collection
   */
  @Get(":id/artworks")
  @ApiOperation({ summary: "Get paginated artworks in a collection" })
  async getCollectionArtworks(
    @Param("id") id: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Request() req?: any,
  ) {
    try {
      const userId = req.user?.id; // Optional
      const pageNum = page ? Number(page) : 1;
      const limitNum = limit ? Number(limit) : 12;

      const result = await this.collectionsService.findCollectionArtworks(
        id,
        pageNum,
        limitNum,
        userId,
      );

      return {
        success: true,
        artworks: result.artworks,
        count: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch collection artworks",
      };
    }
  }

  /**
   * PUT /collections/:id/cover
   * Update collection cover image with S3 URL (uploaded from frontend)
   */
  @Put(":id/cover")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Update collection cover image",
    description:
      "Update collection cover image with S3 public URL. Frontend should upload to S3 first using presigned URL, then send the public URL here.",
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
  async updateCover(
    @Param("id") id: string,
    @Body("coverUrl") coverUrl: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;

      if (!coverUrl) {
        return {
          success: false,
          message: "Cover URL is required",
        };
      }

      // Update collection with new cover image URL
      await this.collectionsService.update(
        id,
        { coverImage: coverUrl },
        userId,
      );

      return {
        success: true,
        message: "Collection cover image updated successfully",
        coverUrl,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to update collection cover image",
      };
    }
  }
}
