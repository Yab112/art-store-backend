import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../libraries/email';
import {
  PROFILE_EVENTS,
  ProfileUpdatedEvent,
  PreferencesUpdatedEvent,
  SettingsUpdatedEvent,
  AccountDeactivatedEvent,
  EmailChangedEvent,
  PasswordChangedEvent,
  LanguageChangedEvent,
} from './events';

/**
 * Profile Event Subscriber
 * Handles all profile-related events and triggers appropriate actions
 */
@Injectable()
export class ProfileEventSubscriber {
  private readonly logger = new Logger(ProfileEventSubscriber.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Handle profile updated event
   */
  @OnEvent(PROFILE_EVENTS.PROFILE_UPDATED)
  async handleProfileUpdated(event: ProfileUpdatedEvent) {
    try {
      this.logger.log(
        `Profile updated for user ${event.userId}: ${event.changes.length} changes`,
      );

      // Send confirmation email
      await this.emailService.send({
        name: event.userName,
        email: event.email,
        subject: 'Profile Updated Successfully',
        template: 'profile-updated',
        variables: {
          userName: event.userName,
          changes: JSON.stringify(event.changes),
          updatedAt: event.updatedAt.toISOString(),
        },
      });

      this.logger.log(`Profile update notification sent to ${event.email}`);
    } catch (error) {
      this.logger.error('Failed to handle profile updated event:', error);
    }
  }

  /**
   * Handle preferences updated event
   */
  @OnEvent(PROFILE_EVENTS.PREFERENCES_UPDATED)
  async handlePreferencesUpdated(event: PreferencesUpdatedEvent) {
    try {
      this.logger.log(`Preferences updated for user ${event.userId}`);

      // Send confirmation email if email notifications are enabled
      if (event.preferences.notifications?.email !== false) {
        await this.emailService.send({
          name: event.userName,
          email: event.email,
          subject: 'Preferences Updated',
          template: 'preferences-updated',
          variables: {
            userName: event.userName,
            language: event.preferences.language || 'en',
            timezone: event.preferences.timezone || 'UTC',
            updatedAt: event.updatedAt.toISOString(),
          },
        });

        this.logger.log(
          `Preferences update notification sent to ${event.email}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to handle preferences updated event:', error);
    }
  }

  /**
   * Handle language changed event
   */
  @OnEvent(PROFILE_EVENTS.LANGUAGE_CHANGED)
  async handleLanguageChanged(event: LanguageChangedEvent) {
    try {
      this.logger.log(
        `Language changed for user ${event.userId}: ${event.oldLanguage} -> ${event.newLanguage}`,
      );

      // Send email in the new language
      await this.emailService.send({
        name: event.userName,
        email: event.email,
        subject: 'Language Preference Updated',
        template: 'language-changed',
        variables: {
          userName: event.userName,
          newLanguage: event.newLanguage,
          timestamp: event.timestamp.toISOString(),
        },
      });

      this.logger.log(`Language change notification sent to ${event.email}`);
    } catch (error) {
      this.logger.error('Failed to handle language changed event:', error);
    }
  }

  /**
   * Handle settings updated event
   */
  @OnEvent(PROFILE_EVENTS.SETTINGS_UPDATED)
  async handleSettingsUpdated(event: SettingsUpdatedEvent) {
    try {
      this.logger.log(
        `Settings updated for user ${event.userId}: ${event.settingsType}`,
      );

      // Send security alert for security-related changes
      if (event.settingsType === 'security') {
        await this.emailService.send({
          name: event.userName,
          email: event.email,
          subject: 'Security Settings Updated',
          template: 'security-settings-updated',
          variables: {
            userName: event.userName,
            changes: JSON.stringify(event.changes),
            updatedAt: event.updatedAt.toISOString(),
          },
        });

        this.logger.log(
          `Security settings update alert sent to ${event.email}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to handle settings updated event:', error);
    }
  }

  /**
   * Handle email changed event
   */
  @OnEvent(PROFILE_EVENTS.EMAIL_CHANGED)
  async handleEmailChanged(event: EmailChangedEvent) {
    try {
      this.logger.log(
        `Email changed for user ${event.userId}: ${event.oldEmail} -> ${event.newEmail}`,
      );

      // Send notification to OLD email
      await this.emailService.send({
        name: event.userName,
        email: event.oldEmail,
        subject: 'Email Address Changed',
        template: 'email-changed-old',
        variables: {
          userName: event.userName,
          newEmail: event.newEmail,
          timestamp: event.timestamp.toISOString(),
        },
      });

      // Send verification to NEW email if required
      if (event.requiresVerification) {
        await this.emailService.send({
          name: event.userName,
          email: event.newEmail,
          subject: 'Verify Your New Email Address',
          template: 'email-verification',
          variables: {
            userName: event.userName,
            verificationLink: `http://localhost:3000/verify-email/${event.userId}`,
          },
        });
      }

      this.logger.log(`Email change notifications sent`);
    } catch (error) {
      this.logger.error('Failed to handle email changed event:', error);
    }
  }

  /**
   * Handle password changed event
   */
  @OnEvent(PROFILE_EVENTS.PASSWORD_CHANGED)
  async handlePasswordChanged(event: PasswordChangedEvent) {
    try {
      this.logger.log(`Password changed for user ${event.userId}`);

      // Send security alert
      await this.emailService.send({
        name: event.userName,
        email: event.email,
        subject: 'Password Changed Successfully',
        template: 'password-changed',
        variables: {
          userName: event.userName,
          timestamp: event.timestamp.toISOString(),
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
      });

      this.logger.log(`Password change alert sent to ${event.email}`);
    } catch (error) {
      this.logger.error('Failed to handle password changed event:', error);
    }
  }

  /**
   * Handle account deactivated event
   */
  @OnEvent(PROFILE_EVENTS.ACCOUNT_DEACTIVATED)
  async handleAccountDeactivated(event: AccountDeactivatedEvent) {
    try {
      this.logger.log(`Account deactivated for user ${event.userId}`);

      // Send farewell email
      await this.emailService.send({
        name: event.userName,
        email: event.email,
        subject: 'Account Deactivated',
        template: 'account-deactivated',
        variables: {
          userName: event.userName,
          reason: event.reason || 'User requested',
          canReactivate: event.canReactivate ? 'Yes' : 'No',
          deactivatedAt: event.deactivatedAt.toISOString(),
        },
      });

      this.logger.log(
        `Account deactivation confirmation sent to ${event.email}`,
      );

      // TODO: Schedule data deletion if requested
      // TODO: Cancel any active subscriptions
      // TODO: Archive user data
    } catch (error) {
      this.logger.error('Failed to handle account deactivated event:', error);
    }
  }

  /**
   * Handle profile viewed event
   */
  @OnEvent(PROFILE_EVENTS.PROFILE_VIEWED)
  async handleProfileViewed(event: any) {
    try {
      // Log analytics, increment view count, etc.
      this.logger.log(
        `Profile ${event.profileUserId} viewed by ${event.viewerUserId || 'anonymous'}`,
      );

      // TODO: Store in analytics database
      // TODO: Update profile view count
    } catch (error) {
      this.logger.error('Failed to handle profile viewed event:', error);
    }
  }
}
