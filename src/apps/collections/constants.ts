/**
 * Collections Constants
 * Centralized constants for collection-related configurations
 */

export const COLLECTION_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // Collection limits
  MAX_COLLECTIONS_PER_USER: 50,
  MAX_ARTWORKS_PER_COLLECTION: 100,
  MIN_ARTWORKS_FOR_PUBLISH: 3, // Minimum artworks required to publish

  // Collection visibility
  VISIBILITY: {
    PUBLIC: "public",
    PRIVATE: "private",
    UNLISTED: "unlisted", // Can be accessed via link but not listed publicly
  },

  // Collection types
  COLLECTION_TYPES: {
    USER_CURATED: "user_curated",
    FEATURED: "featured", // Admin/moderator curated
    TRENDING: "trending",
    SEASONAL: "seasonal",
  },

  // Sort options
  SORT_OPTIONS: {
    NEWEST: "newest",
    OLDEST: "oldest",
    MOST_ARTWORKS: "most_artworks",
    RECENTLY_UPDATED: "recently_updated",
    ALPHABETICAL: "alphabetical",
  },
} as const;

export const COLLECTION_VALIDATION = {
  // Field length constraints
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,

  // Cover image
  COVER_IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
} as const;

export const COLLECTION_MESSAGES = {
  SUCCESS: {
    CREATED: "Collection created successfully",
    UPDATED: "Collection updated successfully",
    DELETED: "Collection deleted successfully",
    PUBLISHED: "Collection published successfully",
    UNPUBLISHED: "Collection unpublished successfully",
    ARTWORK_ADDED: "Artwork added to collection",
    ARTWORK_REMOVED: "Artwork removed from collection",
    ARTWORKS_ADDED: "Artworks added to collection",
  },
  ERROR: {
    NOT_FOUND: "Collection not found",
    UNAUTHORIZED: "You are not authorized to perform this action",
    MAX_COLLECTIONS_REACHED:
      "You have reached the maximum number of collections",
    MAX_ARTWORKS_REACHED: "Collection has reached maximum artwork limit",
    ARTWORK_ALREADY_IN_COLLECTION: "Artwork is already in this collection",
    ARTWORK_NOT_IN_COLLECTION: "Artwork is not in this collection",
    ARTWORK_NOT_FOUND: "Artwork not found",
    CANNOT_PUBLISH: "Collection must have at least 3 artworks to be published",
    INVALID_VISIBILITY: "Invalid visibility setting",
    NAME_TOO_SHORT: "Collection name is too short",
    NAME_TOO_LONG: "Collection name is too long",
  },
  INFO: {
    EMPTY_COLLECTION: "This collection has no artworks yet",
    PRIVATE_COLLECTION: "This is a private collection",
    FEATURED_COLLECTION: "This is a featured collection curated by our team",
  },
} as const;

export const COLLECTION_EMAIL_SUBJECTS = {
  CREATED: "Collection Created Successfully",
  PUBLISHED: "Your Collection is Now Public!",
  FEATURED: "Your Collection Has Been Featured!",
  ARTWORK_ADDED: "Artwork Added to Your Collection",
  COLLABORATION_INVITE: "You Have Been Invited to Collaborate on a Collection",
} as const;
