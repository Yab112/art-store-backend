/**
 * Cart Constants
 * Centralized constants for cart-related configurations
 */

export const CART_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // Cart limits
  MAX_CART_ITEMS_PER_USER: 50,
  MAX_QUANTITY_PER_ITEM: 10,
  MIN_QUANTITY_PER_ITEM: 1,
} as const;

export const CART_MESSAGES = {
  SUCCESS: {
    ADDED: 'Artwork added to cart successfully',
    UPDATED: 'Cart item updated successfully',
    REMOVED: 'Artwork removed from cart successfully',
    CLEARED: 'Cart cleared successfully',
    LISTED: 'Cart items retrieved successfully',
  },
  ERROR: {
    NOT_FOUND: 'Cart item not found',
    ARTWORK_NOT_FOUND: 'Artwork not found',
    MAX_CART_ITEMS_REACHED: 'You have reached the maximum number of cart items',
    MAX_QUANTITY_REACHED: 'Maximum quantity per item reached',
    INVALID_QUANTITY: 'Invalid quantity. Must be between 1 and 10',
    EMPTY_CART: 'Cart is empty',
  },
  INFO: {
    EMPTY_CART: 'Your cart is empty',
  },
} as const;

