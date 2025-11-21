import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      // Check if user with email already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException("User with this email already exists");
      }

      const user = await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          image: createUserDto.image,
          role: createUserDto.role || "USER",
          emailVerified: createUserDto.emailVerified ?? false,
          score: createUserDto.score ?? 0,
          banned: createUserDto.banned ?? false,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`User created: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error("Failed to create user:", error);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 20, search?: string) {
    try {
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            score: true,
            role: true,
            banned: true,
            banReason: true,
            banExpires: true,
            twoFactorEnabled: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.user.count({ where }),
      ]);
      console.log("users", users);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error("Failed to fetch users:", error);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          artworks: {
            take: 10,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              artist: true,
              photos: true,
              desiredPrice: true,
              status: true,
              createdAt: true,
            },
          },
          Collection: {
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
              artworks: {
                take: 3,
                include: {
                  artwork: {
                    select: {
                      id: true,
                      title: true,
                      photos: true,
                    },
                  },
                },
              },
            },
          },
          reviews: {
            take: 10,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
          interactions: {
            take: 20,
            orderBy: { createdAt: "desc" },
            include: {
              artwork: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          favorites: {
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
              artwork: {
                select: {
                  id: true,
                  title: true,
                  photos: true,
                  desiredPrice: true,
                },
              },
            },
          },
          cartItems: {
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
              artwork: {
                select: {
                  id: true,
                  title: true,
                  photos: true,
                  desiredPrice: true,
                },
              },
            },
          },
          _count: {
            select: {
              artworks: true,
              Collection: true,
              reviews: true,
              interactions: true,
              favorites: true,
              cartItems: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Get user's orders by email
      const orders = await this.prisma.order.findMany({
        where: { buyerEmail: user.email },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              artwork: {
                select: {
                  id: true,
                  title: true,
                  photos: true,
                },
              },
            },
          },
          transaction: {
            select: {
              id: true,
              status: true,
              amount: true,
              createdAt: true,
            },
          },
        },
      });

      // Get withdrawals if any (checking by payoutAccount or other identifier)
      // Note: Withdrawal model doesn't have userId, so we'll need to check if there's a way to link it
      const withdrawals = await this.prisma.withdrawal.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      });

      const userData = user as any;

      return {
        ...userData,
        artworkCount: userData._count?.artworks || 0,
        collectionCount: userData._count?.collections || 0,
        reviewCount: userData._count?.reviews || 0,
        interactionCount: userData._count?.interactions || 0,
        favoriteCount: userData._count?.favorites || 0,
        cartItemCount: userData._count?.cartItems || 0,
        orders,
        orderCount: orders.length,
        withdrawals,
        withdrawalCount: withdrawals.length,
        _count: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to find user ${id}:`, error);
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // If email is being updated, check if new email already exists
      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: updateUserDto.email },
        });

        if (emailExists) {
          throw new BadRequestException("User with this email already exists");
        }
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateUserDto,
        },
      });

      this.logger.log(`User updated: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to update user ${id}:`, error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User deleted: ${id}`);
      return { success: true, message: `User ${id} deleted successfully` };
    } catch (error) {
      this.logger.error(`Failed to delete user ${id}:`, error);
      throw error;
    }
  }
}
