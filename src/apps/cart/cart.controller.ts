import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';
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
 * Cart Controller
 * Handles all cart-related endpoints
 */
@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * POST /cart
   * Add artwork to cart
   */
  @Post()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Add artwork to cart',
    description:
      "Add an artwork to the authenticated user's cart. If the artwork already exists, the quantity will be increased.",
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({
    status: 201,
    description: 'Artwork added to cart successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Max cart items reached or max quantity reached',
  })
  @ApiResponse({ status: 404, description: 'Artwork not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addToCart(@Body() addToCartDto: AddToCartDto, @Request() req: any) {
    try {
      const userId = req.user.id;
      const cartItem = await this.cartService.addToCart(userId, addToCartDto);

      return {
        success: true,
        message: 'Artwork added to cart successfully',
        cartItem,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to add to cart',
      };
    }
  }

  /**
   * GET /cart
   * Get user's cart items
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get user cart items',
    description:
      "Retrieve a paginated list of items in the authenticated user's cart with totals.",
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Cart items retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCartItems(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.cartService.getCartItems(userId, page, limit);

      return {
        success: true,
        message: 'Cart items retrieved successfully',
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to fetch cart items',
      };
    }
  }

  /**
   * PUT /cart/:artworkId
   * Update cart item quantity
   */
  @Put(':artworkId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Update cart item quantity',
    description:
      "Update the quantity of a specific artwork in the user's cart.",
  })
  @ApiParam({ name: 'artworkId', description: 'Artwork ID to update' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 400, description: 'Invalid quantity' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCartItem(
    @Param('artworkId') artworkId: string,
    @Body() updateDto: UpdateCartItemDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const cartItem = await this.cartService.updateCartItem(
        userId,
        artworkId,
        updateDto,
      );

      return {
        success: true,
        message: 'Cart item updated successfully',
        cartItem,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to update cart item',
      };
    }
  }

  /**
   * DELETE /cart/:artworkId
   * Remove artwork from cart
   */
  @Delete(':artworkId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Remove artwork from cart',
    description: "Remove an artwork from the authenticated user's cart.",
  })
  @ApiParam({
    name: 'artworkId',
    description: 'Artwork ID to remove from cart',
  })
  @ApiResponse({
    status: 200,
    description: 'Artwork removed from cart successfully',
  })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeFromCart(
    @Param('artworkId') artworkId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id;
      const result = await this.cartService.removeFromCart(userId, artworkId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to remove from cart',
      };
    }
  }

  /**
   * DELETE /cart
   * Clear entire cart
   */
  @Delete()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Clear entire cart',
    description: "Remove all items from the authenticated user's cart.",
  })
  @ApiResponse({
    status: 200,
    description: 'Cart cleared successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@Request() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.cartService.clearCart(userId);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to clear cart',
      };
    }
  }

  /**
   * GET /cart/summary
   * Get cart summary (total items and total price)
   */
  @Get('summary')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Get cart summary',
    description:
      'Get the total number of items and total price of all items in the cart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        totalItems: { type: 'number', example: 5 },
        totalPrice: { type: 'number', example: 1500.0 },
        itemCount: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCartSummary(@Request() req: any) {
    try {
      const userId = req.user.id;
      const summary = await this.cartService.getCartSummary(userId);

      return {
        success: true,
        ...summary,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get cart summary',
      };
    }
  }
}
