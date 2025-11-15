import { EmailService } from './email.service';

/**
 * Global email bridge for Better Auth integration
 * This allows Better Auth to send emails without dependency injection
 */
class EmailBridge {
  private static instance: EmailBridge;
  private emailService: EmailService | null = null;

  private constructor() {}

  static getInstance(): EmailBridge {
    if (!EmailBridge.instance) {
      EmailBridge.instance = new EmailBridge();
    }
    return EmailBridge.instance;
  }

  setEmailService(emailService: EmailService): void {
    this.emailService = emailService;
  }

  async sendVerificationEmail({
    email,
    link,
  }: {
    email: string;
    link: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Verify Your Email Address - Finder App',
        template: 'email-verification',
        variables: {
          email,
          link,
        },
      });
      console.log(`✅ Email verification sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send email verification to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail({
    email,
    link,
  }: {
    email: string;
    link: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Reset Your Password - Finder App',
        template: 'password-reset',
        variables: {
          email,
          link,
        },
      });
      console.log(`✅ Password reset email sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send password reset to ${email}:`, error);
      throw error;
    }
  }

  async sendMagicLinkEmail({
    email,
    link,
  }: {
    email: string;
    link: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Your Magic Link - Finder App',
        template: 'magic-link',
        variables: {
          email,
          link,
        },
      });
      console.log(`✅ Magic link sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send magic link to ${email}:`, error);
      throw error;
    }
  }

  async send2FACodeEmail({
    email,
    code,
  }: {
    email: string;
    code: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Your 2FA Code - Finder App',
        template: '2fa-code',
        variables: {
          email,
          code,
        },
      });
      console.log(`✅ 2FA code sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send 2FA code to ${email}:`, error);
      throw error;
    }
  }

  async sendVerificationOTPEmail({
    email,
    code,
  }: {
    email: string;
    code: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Verify Your Email - Finder App',
        template: 'verification-otp',
        variables: {
          email,
          code,
        },
      });
      console.log(`✅ Verification OTP sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send verification OTP to ${email}:`, error);
      throw error;
    }
  }

  async sendPasswordResetOTPEmail({
    email,
    code,
  }: {
    email: string;
    code: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Reset Your Password - Finder App',
        template: 'password-reset-otp',
        variables: {
          email,
          code,
        },
      });
      console.log(`✅ Password reset OTP sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send password reset OTP to ${email}:`, error);
      throw error;
    }
  }

  async sendSignInOTPEmail({
    email,
    code,
  }: {
    email: string;
    code: string;
  }): Promise<void> {
    if (!this.emailService) {
      console.error('EmailService not initialized in EmailBridge');
      return;
    }

    try {
      await this.emailService.send({
        name: 'User',
        email,
        subject: 'Your Sign In Code - Finder App',
        template: 'signin-otp',
        variables: {
          email,
          code,
        },
      });
      console.log(`✅ Sign in OTP sent to: ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send sign in OTP to ${email}:`, error);
      throw error;
    }
  }
}

export const emailBridge = EmailBridge.getInstance();
