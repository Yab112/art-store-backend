import { Injectable, OnModuleInit } from '@nestjs/common';
import { EmailService } from './email.service';
import { emailBridge } from './email-bridge';

@Injectable()
export class EmailBridgeInitializerService implements OnModuleInit {
  constructor(private readonly emailService: EmailService) {}

  onModuleInit() {
    // Initialize the email bridge with the EmailService instance
    emailBridge.setEmailService(this.emailService);
    console.log('✅ Email bridge initialized with EmailService');
  }
}
