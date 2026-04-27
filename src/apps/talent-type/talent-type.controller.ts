import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Logger,
} from "@nestjs/common";
import { TalentTypeService } from "./talent-type.service";
import {
  CreateTalentTypeDto,
  UpdateTalentTypeDto,
} from "./dto/talent-type.dto";
import { AuthGuard } from "../../core/guards/auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Controller("talent-types")
export class TalentTypeController {
  private readonly logger = new Logger(TalentTypeController.name);

  constructor(private readonly talentTypeService: TalentTypeService) {}

  /**
   * Get all active talent types
   */
  @Get()
  async getAllTalentTypes() {
    try {
      const talentTypes = await this.talentTypeService.getAllTalentTypes();
      return {
        success: true,
        data: talentTypes,
      };
    } catch (error) {
      this.logger.error("Failed to get all talent types:", error);
      throw error;
    }
  }

  /**
   * Get talent type by ID
   */
  @Get(":id")
  async getTalentTypeById(@Param("id") id: string) {
    try {
      const talentType = await this.talentTypeService.getTalentTypeById(id);
      return {
        success: true,
        data: talentType,
      };
    } catch (error) {
      this.logger.error(`Failed to get talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get artists by talent type
   */
  @Get(":id/artists")
  async getArtistsByTalentType(
    @Param("id") id: string,
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    try {
      return await this.talentTypeService.getArtistsByTalentType(
        id,
        page,
        limit,
      );
    } catch (error) {
      this.logger.error(`Failed to get artists by talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create talent type (admin only)
   */
  @Post()
  @UseGuards(AuthGuard)
  async createTalentType(
    @Body() dto: CreateTalentTypeDto,
    @CurrentUser() user: any,
  ) {
    try {
      if (user.role !== "ADMIN") {
        return {
          success: false,
          message: "Unauthorized. Admin access required.",
        };
      }

      const talentType = await this.talentTypeService.createTalentType(dto);
      return {
        success: true,
        data: talentType,
      };
    } catch (error) {
      this.logger.error("Failed to create talent type:", error);
      throw error;
    }
  }

  /**
   * Update talent type (admin only)
   */
  @Put(":id")
  @UseGuards(AuthGuard)
  async updateTalentType(
    @Param("id") id: string,
    @Body() dto: UpdateTalentTypeDto,
    @CurrentUser() user: any,
  ) {
    try {
      if (user.role !== "ADMIN") {
        return {
          success: false,
          message: "Unauthorized. Admin access required.",
        };
      }

      const talentType = await this.talentTypeService.updateTalentType(id, dto);
      return {
        success: true,
        data: talentType,
      };
    } catch (error) {
      this.logger.error(`Failed to update talent type ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete talent type (admin only)
   */
  @Delete(":id")
  @UseGuards(AuthGuard)
  async deleteTalentType(@Param("id") id: string, @CurrentUser() user: any) {
    try {
      if (user.role !== "ADMIN") {
        return {
          success: false,
          message: "Unauthorized. Admin access required.",
        };
      }

      await this.talentTypeService.deleteTalentType(id);
      return {
        success: true,
        message: "Talent type deleted successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to delete talent type ${id}:`, error);
      throw error;
    }
  }
}
