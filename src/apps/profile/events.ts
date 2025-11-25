/**
 * Profile Events
 * Event definitions for profile-related actions
 */

export const PROFILE_EVENTS = {
  // Profile updates
  PROFILE_UPDATED: 'profile.updated',
  PROFILE_VIEWED: 'profile.viewed',

  // Preferences
  PREFERENCES_UPDATED: 'profile.preferences.updated',
  LANGUAGE_CHANGED: 'profile.language.changed',

  // Settings
  SETTINGS_UPDATED: 'profile.settings.updated',
  EMAIL_CHANGED: 'profile.email.changed',
  PASSWORD_CHANGED: 'profile.password.changed',

  // Account actions
  ACCOUNT_DEACTIVATED: 'profile.account.deactivated',
  ACCOUNT_REACTIVATED: 'profile.account.reactivated',

  // Activity
  ACTIVITY_LOGGED: 'profile.activity.logged',
} as const;

// Event payload interfaces
export interface ProfileUpdatedEvent {
  userId: string;
  userName: string;
  email: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  updatedAt: Date;
}

export interface ProfileViewedEvent {
  profileUserId: string;
  viewerUserId?: string;
  viewerIp: string;
  timestamp: Date;
}

export interface PreferencesUpdatedEvent {
  userId: string;
  userName: string;
  email: string;
  preferences: {
    themePreference?: string;
    languagePreference?: string;
    timezone?: string;
    messagingPreferences?: any;
    notifications?: {
      email?: boolean;
      push?: boolean;
      sms?: boolean;
    };
    language?: string;
  };
  updatedAt: Date;
}

export interface LanguageChangedEvent {
  userId: string;
  userName: string;
  email: string;
  oldLanguage: string;
  newLanguage: string;
  timestamp: Date;
}

export interface SettingsUpdatedEvent {
  userId: string;
  userName: string;
  email: string;
  settingsType: 'privacy' | 'security' | 'general';
  changes: Record<string, any>;
  updatedAt: Date;
}

export interface EmailChangedEvent {
  userId: string;
  userName: string;
  oldEmail: string;
  newEmail: string;
  timestamp: Date;
  requiresVerification: boolean;
}

export interface PasswordChangedEvent {
  userId: string;
  userName: string;
  email: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

export interface AccountDeactivatedEvent {
  userId: string;
  userName: string;
  email: string;
  reason?: string;
  deactivatedAt: Date;
  canReactivate: boolean;
}

export interface AccountReactivatedEvent {
  userId: string;
  userName: string;
  email: string;
  reactivatedAt: Date;
}

export interface ActivityLoggedEvent {
  userId: string;
  activityType: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
