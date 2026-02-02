/**
 * Favorites Constants
 * Centralized constants for favorites-related configurations
 */

export const FAVORITE_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // Favorites limits
  MAX_FAVORITES_PER_USER: 1000,
} as const;

export const FAVORITE_MESSAGES = {
  SUCCESS: {
    ADDED: "Artwork added to favorites successfully",
    REMOVED: "Artwork removed from favorites successfully",
    LISTED: "Favorites retrieved successfully",
  },
  ERROR: {
    NOT_FOUND: "Favorite not found",
    ALREADY_EXISTS: "Artwork is already in favorites",
    ARTWORK_NOT_FOUND: "Artwork not found",
    MAX_FAVORITES_REACHED: "You have reached the maximum number of favorites",
  },
  INFO: {
    EMPTY_FAVORITES: "You have no favorites yet",
  },
} as const;
