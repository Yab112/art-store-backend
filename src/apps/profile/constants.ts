/**
 * Profile Constants
 * Centralized constants for profile-related configurations
 */

export const PROFILE_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,

  // Upload limits
  MAX_ARTWORKS_PER_USER: 1000,

  // Activity log types
  ACTIVITY_TYPES: {
    PROFILE_UPDATED: 'profile.updated',
    PREFERENCES_UPDATED: 'preferences.updated',
    SETTINGS_UPDATED: 'settings.updated',
    ARTWORK_UPLOADED: 'artwork.uploaded',
    ARTWORK_DELETED: 'artwork.deleted',
    COLLECTION_CREATED: 'collection.created',
    ACCOUNT_DEACTIVATED: 'account.deactivated',
  },

  // Notification preferences
  NOTIFICATION_CHANNELS: {
    EMAIL: 'email',
    PUSH: 'push',
    SMS: 'sms',
  },

  // Supported languages
  SUPPORTED_LANGUAGES: ['en', 'fr', 'es', 'de', 'it'] as const,

  // Profile visibility
  VISIBILITY: {
    PUBLIC: 'public',
    PRIVATE: 'private',
    FRIENDS_ONLY: 'friends_only',
  },
} as const;

export const PROFILE_VALIDATION = {
  // Field length constraints
  BIO_MAX_LENGTH: 500,
  NAME_MAX_LENGTH: 100,
  LOCATION_MAX_LENGTH: 100,
  WEBSITE_MAX_LENGTH: 200,

  // Image constraints
  AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  COVER_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
} as const;

export const PROFILE_MESSAGES = {
  SUCCESS: {
    PROFILE_UPDATED: 'Profile updated successfully',
    PREFERENCES_UPDATED: 'Preferences updated successfully',
    SETTINGS_UPDATED: 'Settings updated successfully',
    ACCOUNT_DEACTIVATED: 'Account deactivated successfully',
  },
  ERROR: {
    PROFILE_NOT_FOUND: 'Profile not found',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    INVALID_LANGUAGE: 'Invalid language preference',
    DEACTIVATION_FAILED: 'Failed to deactivate account',
  },
} as const;
