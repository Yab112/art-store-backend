/**
 * Artwork Constants
 * Centralized constants for artwork-related configurations
 */

export const ARTWORK_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // File limits
  MAX_PHOTOS: 10,
  MAX_PHOTO_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_DOCUMENT_SIZE: 20 * 1024 * 1024, // 20MB

  // Price limits
  MIN_PRICE: 0,
  MAX_PRICE: 10000000, // 10 million

  // Artwork statuses
  STATUS: {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    SOLD: "SOLD",
    WITHDRAWN: "WITHDRAWN",
  },

  // Techniques
  TECHNIQUES: [
    "Oil on Canvas",
    "Acrylic",
    "Watercolor",
    "Digital Art",
    "Mixed Media",
    "Sculpture",
    "Photography",
    "Print",
    "Drawing",
    "Other",
  ],

  // Support types
  SUPPORT_TYPES: [
    "Canvas",
    "Paper",
    "Wood",
    "Metal",
    "Stone",
    "Digital",
    "Other",
  ],

  // Artwork states
  ARTWORK_STATES: ["Excellent", "Very Good", "Good", "Fair", "Poor"],

  // Comments
  COMMENTS: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

export const ARTWORK_VALIDATION = {
  // Field length constraints
  TITLE_MAX_LENGTH: 200,
  ARTIST_MAX_LENGTH: 100,
  TECHNIQUE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 2000,
  ORIGIN_MAX_LENGTH: 100,
  ACCOUNT_HOLDER_MAX_LENGTH: 100,
  IBAN_MAX_LENGTH: 34,
  BIC_MAX_LENGTH: 11,

  // Dimension constraints (in cm)
  MIN_DIMENSION: 0.1,
  MAX_DIMENSION: 10000,

  // Weight constraints (in kg)
  MIN_WEIGHT: 0.01,
  MAX_WEIGHT: 10000,

  // Year constraints
  MIN_YEAR: 1000,
  MAX_YEAR: new Date().getFullYear() + 1,

  // Price constraints
  MIN_PRICE: 1,
  MAX_PRICE: 100000000, // 100 million

  // Comment constraints
  COMMENT_MIN_LENGTH: 1,
  COMMENT_MAX_LENGTH: 1000,
} as const;

export const ARTWORK_MESSAGES = {
  SUCCESS: {
    SUBMITTED: "Artwork submitted successfully",
    UPDATED: "Artwork updated successfully",
    DELETED: "Artwork deleted successfully",
    APPROVED: "Artwork approved successfully",
    REJECTED: "Artwork rejected successfully",
    WITHDRAWN: "Artwork withdrawn successfully",
    SOLD_MARKED: "Artwork marked as sold",
    COMMENT_ADDED: "Comment added successfully",
    COMMENT_UPDATED: "Comment updated successfully",
    COMMENT_DELETED: "Comment deleted successfully",
    LIKED: "Artwork liked successfully",
    UNLIKED: "Like removed successfully",
  },
  ERROR: {
    NOT_FOUND: "Artwork not found",
    UNAUTHORIZED: "You are not authorized to perform this action",
    INVALID_STATUS: "Invalid artwork status",
    ALREADY_APPROVED: "Artwork is already approved",
    ALREADY_REJECTED: "Artwork is already rejected",
    ALREADY_SOLD: "Artwork is already sold",
    INVALID_PRICE: "Invalid price range",
    MAX_PHOTOS_EXCEEDED: "Maximum number of photos exceeded",
    INVALID_DIMENSIONS: "Invalid dimensions",
    INVALID_YEAR: "Invalid year",
    COMMENT_NOT_FOUND: "Comment not found",
    COMMENT_TOO_SHORT: "Comment is too short",
    COMMENT_TOO_LONG: "Comment is too long",
    ALREADY_LIKED: "You have already liked this artwork",
    NOT_LIKED: "You have not liked this artwork",
  },
  INFO: {
    PENDING_APPROVAL: "Your artwork is pending approval by our team",
    REVIEW_TIME: "Review typically takes 1-2 business days",
  },
} as const;

export const ARTWORK_EMAIL_SUBJECTS = {
  SUBMITTED: "Artwork Submitted Successfully",
  APPROVED: "Your Artwork Has Been Approved!",
  REJECTED: "Artwork Submission Update",
  SOLD: "Congratulations! Your Artwork Sold",
  PRICE_UPDATE: "Artwork Price Updated",
  DELETED: "Artwork Removed",
  COMMENT_RECEIVED: "New Comment on Your Artwork",
  LIKE_RECEIVED: "Someone Liked Your Artwork",
} as const;
