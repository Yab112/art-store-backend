/**
 * Response DTOs for Profile endpoints
 */

export class PublicProfileDto {
  id: string;
  name: string;
  email?: string; // Only if user allows
  image?: string;
  bio?: string;
  location?: string;
  website?: string;
  coverImage?: string;
  role: string;
  score: number;
  createdAt: Date;
  artworkCount?: number;
  collectionCount?: number;
  reviewCount?: number;
}

export class UserProfileDto extends PublicProfileDto {
  email: string; // Always included for own profile
  emailVerified: boolean;
  phone?: string;
  twoFactorEnabled: boolean;
  firstlogin?: boolean;
  banned: boolean;
  banReason?: string;
  banExpires?: Date;
}

export class UserPreferencesDto {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    newArtwork: boolean;
    priceChanges: boolean;
    messages: boolean;
    reviews: boolean;
    marketing: boolean;
  };
  language: string;
  timezone: string;
  profileVisibility: string;
  showEmail: boolean;
  showPhone: boolean;
}

export class UserSettingsDto {
  // Privacy
  allowMessagesFromAnyone: boolean;
  showOnlineStatus: boolean;
  allowComments: boolean;
  allowTagging: boolean;

  // Security
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;

  // Account
  displayName: string;
  searchable: boolean;
  indexable: boolean;
}

export class ActivityLogDto {
  id: string;
  activityType: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class UploadedArtworkDto {
  id: string;
  title?: string;
  artist: string;
  technique: string;
  photos: string[];
  status: string;
  isApproved: boolean;
  desiredPrice: number;
  createdAt: Date;
  updatedAt: Date;
}
