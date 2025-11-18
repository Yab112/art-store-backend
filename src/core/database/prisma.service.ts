import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error: any) {
      this.logger.error('Failed to connect to database:', error.message);
      this.logger.error('Database URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set');
      this.logger.error('Error code:', error.code);
      
      // Provide helpful error messages
      if (error.code === 'P1001') {
        this.logger.error('Cannot reach database server. Possible causes:');
        this.logger.error('1. Database server is paused (Neon free tier auto-pauses)');
        this.logger.error('2. Network/firewall blocking connection');
        this.logger.error('3. Database credentials expired or incorrect');
        this.logger.error('4. Database server is down');
        this.logger.error('Please check your Neon dashboard and ensure the database is active.');
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
