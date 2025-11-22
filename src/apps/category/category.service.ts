import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto";

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate a URL-friendly slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/--+/g, "-"); // Replace multiple hyphens with single hyphen
  }

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto) {
    const { name, description } = createCategoryDto;
    const slug = this.generateSlug(name);

    // Check if category with same name or slug exists
    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existing) {
      throw new ConflictException("Category with this name already exists");
    }

    return this.prisma.category.create({
      data: {
        name,
        description,
        slug,
        image: createCategoryDto.image,
      } as Prisma.CategoryCreateInput,
      include: {
        _count: {
          select: { artworks: true },
        },
      },
    });
  }

  /**
   * Get all categories
   */
  async findAll() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { artworks: true }, // artworks is the relation name in Category model
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return categories.map((category) => ({
      ...category,
      artworkCount: category._count?.artworks || 0,
      _count: undefined,
    }));
  }

  /**
   * Get a single category by ID
   */
  async findOne(id: string) {
    const category = (await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { artworkOnCategory: true } as any,
        },
      },
    })) as any;

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return {
      ...category,
      artworkCount: category._count?.artworks || 0,
      _count: undefined,
    };
  }

  /**
   * Update a category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    const { name, description } = updateCategoryDto;
    const slug = name ? this.generateSlug(name) : undefined;

    // If updating name, check for conflicts
    if (name) {
      const existing = await this.prisma.category.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [{ name }, { slug }],
            },
          ],
        },
      });

      if (existing) {
        throw new ConflictException("Category with this name already exists");
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(name && { name, slug }),
        ...(description !== undefined && { description }),
        ...(updateCategoryDto.image !== undefined && {
          image: updateCategoryDto.image,
        }),
      } as Prisma.CategoryUpdateInput,
      include: {
        _count: {
          select: { artworks: true },
        },
      },
    });
  }

  /**
   * Delete a category
   */
  async remove(id: string) {
    // Check if category exists
    await this.findOne(id);

    // Check if category has artworks
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { artworks: true },
        },
      },
    });

    if (category._count?.artworks > 0) {
      throw new BadRequestException(
        `Cannot delete category. It has ${category._count.artworks} associated artworks. Please reassign or remove the artworks first.`
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { message: "Category deleted successfully" };
  }
}
