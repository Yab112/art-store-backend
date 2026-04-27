import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { CategoryService } from "./category.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
} from "./dto";

@ApiTags("Categories")
@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new category (Admin only)" })
  @ApiResponse({
    status: 201,
    description: "Category created successfully",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 409, description: "Category already exists" })
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all categories" })
  @ApiResponse({
    status: 200,
    description: "List of all categories",
    type: [CategoryResponseDto],
  })
  async findAll() {
    return this.categoryService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a category by ID" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({
    status: 200,
    description: "Category details",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findOne(@Param("id") id: string) {
    return this.categoryService.findOne(id);
  }

  @Put(":id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category (Admin only)" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({
    status: 200,
    description: "Category updated successfully",
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({ status: 409, description: "Category name already exists" })
  async update(
    @Param("id") id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a category (Admin only)" })
  @ApiParam({ name: "id", description: "Category ID" })
  @ApiResponse({
    status: 200,
    description: "Category deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  @ApiResponse({
    status: 400,
    description: "Cannot delete category with associated artworks",
  })
  async remove(@Param("id") id: string) {
    return this.categoryService.remove(id);
  }
}
