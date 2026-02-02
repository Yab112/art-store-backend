import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../core/database";
import { S3Service } from "../../libraries/s3";
import {
  CreateTalentTypeDto,
  UpdateTalentTypeDto,
  TalentTypeResponseDto,
} from "./dto/talent-type.dto";
import slugify from "slugify";

@Injectable()
export class TalentTypeService {
  private readonly logger = new Logger(TalentTypeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Get all active talent types
   */
  async getAllTalentTypes(): Promise<TalentTypeResponseDto[]> {
    try {
      const talentTypes = await this.prisma.talentType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });

      return Promise.all(talentTypes.map((tt) => this.mapToResponseDto(tt)));
    } catch (error) {
      this.logger.error("Failed to get all talent types:", error);
      throw error;
    }
  }

  /**
   * Get talent type by ID
   */
  async getTalentTypeById(id: string): Promise<TalentTypeResponseDto> {
    try {
      const talentType = await this.prisma.talentType.findUnique({
        where: { id },
      });

      if (!talentType) {
        throw new NotFoundException(`Talent type with ID ${id} not found`);
      }

      return await this.mapToResponseDto(talentType);
    } catch (error) {
      this.logger.error(`Failed to get talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new talent type (admin only)
   */
  async createTalentType(
    dto: CreateTalentTypeDto,
  ): Promise<TalentTypeResponseDto> {
    try {
      const slug =
        dto.slug ||
        slugify(dto.name, { lower: true, strict: true, trim: true });

      // Check if slug already exists
      const existing = await this.prisma.talentType.findUnique({
        where: { slug },
      });

      if (existing) {
        throw new Error(`Talent type with slug "${slug}" already exists`);
      }

      const talentType = await this.prisma.talentType.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          image: dto.image,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      this.logger.log(`Created talent type: ${talentType.name}`);
      return await this.mapToResponseDto(talentType);
    } catch (error) {
      this.logger.error("Failed to create talent type:", error);
      throw error;
    }
  }

  /**
   * Update a talent type (admin only)
   */
  async updateTalentType(
    id: string,
    dto: UpdateTalentTypeDto,
  ): Promise<TalentTypeResponseDto> {
    try {
      const existing = await this.prisma.talentType.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(`Talent type with ID ${id} not found`);
      }

      const updateData: any = {};

      if (dto.name !== undefined) {
        updateData.name = dto.name;
        // Auto-generate slug if name changed and slug not provided
        if (!dto.slug) {
          updateData.slug = slugify(dto.name, {
            lower: true,
            strict: true,
            trim: true,
          });
        }
      }

      if (dto.slug !== undefined) {
        // Check if new slug already exists (excluding current record)
        const slugExists = await this.prisma.talentType.findFirst({
          where: {
            slug: dto.slug,
            id: { not: id },
          },
        });

        if (slugExists) {
          throw new Error(`Talent type with slug "${dto.slug}" already exists`);
        }

        updateData.slug = dto.slug;
      }

      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.image !== undefined) updateData.image = dto.image;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

      const talentType = await this.prisma.talentType.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`Updated talent type: ${talentType.name}`);
      return await this.mapToResponseDto(talentType);
    } catch (error) {
      this.logger.error(`Failed to update talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a talent type (admin only)
   */
  async deleteTalentType(id: string): Promise<void> {
    try {
      const talentType = await this.prisma.talentType.findUnique({
        where: { id },
        include: {
          users: {
            take: 1,
          },
        },
      });

      if (!talentType) {
        throw new NotFoundException(`Talent type with ID ${id} not found`);
      }

      // Check if any users are using this talent type
      if (talentType.users.length > 0) {
        throw new Error(
          `Cannot delete talent type. ${talentType.users.length} user(s) are using it.`,
        );
      }

      await this.prisma.talentType.delete({
        where: { id },
      });

      this.logger.log(`Deleted talent type: ${talentType.name}`);
    } catch (error) {
      this.logger.error(`Failed to delete talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get artists by talent type
   */
  async getArtistsByTalentType(
    talentTypeId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            talentTypes: {
              some: {
                talentTypeId,
              },
            },
            banned: false,
          },
          select: {
            id: true,
            name: true,
            image: true,
            coverImage: true,
            bio: true,
            location: true,
            website: true,
            score: true,
            profileViews: true,
            heatScore: true,
            lastActiveAt: true,
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
            _count: {
              select: {
                artworks: {
                  where: {
                    status: "APPROVED",
                  },
                },
              },
            },
          },
          orderBy: {
            heatScore: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.user.count({
          where: {
            talentTypes: {
              some: {
                talentTypeId,
              },
            },
            banned: false,
          },
        }),
      ]);

      return {
        success: true,
        data: {
          artists: users.map((user) => ({
            id: user.id,
            name: user.name,
            image: user.image,
            coverImage: user.coverImage,
            bio: user.bio,
            location: user.location,
            website: user.website,
            score: user.score,
            profileViews: user.profileViews || 0,
            heatScore: user.heatScore || 0,
            lastActiveAt: user.lastActiveAt,
            talentTypes: user.talentTypes.map((ut) => ut.talentType),
            artworkCount: user._count.artworks,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get artists by talent type ${talentTypeId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Map Prisma model to response DTO
   * Converts S3 object key to pre-signed URL if image exists
   */
  private async mapToResponseDto(
    talentType: any,
  ): Promise<TalentTypeResponseDto> {
    let imageUrl = talentType.image;

    // If image is an S3 object key (not a full URL), generate pre-signed URL
    if (
      imageUrl &&
      !imageUrl.startsWith("http") &&
      !imageUrl.startsWith("data:")
    ) {
      try {
        // Generate pre-signed URL valid for 7 days
        imageUrl = await this.s3Service.getPresignedDownloadUrl(
          imageUrl,
          undefined,
          604800,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to generate pre-signed URL for image ${imageUrl}, using public URL instead`,
        );
        // Fallback to public URL if pre-signed URL generation fails
        imageUrl = this.s3Service.getPublicUrl(imageUrl);
      }
    }

    return {
      id: talentType.id,
      name: talentType.name,
      slug: talentType.slug,
      description: talentType.description,
      image: imageUrl,
      isActive: talentType.isActive,
      sortOrder: talentType.sortOrder,
      createdAt: talentType.createdAt,
      updatedAt: talentType.updatedAt,
    };
  }
}
