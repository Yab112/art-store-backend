import { Injectable } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigurationService } from '../configuration';

@Injectable()
export class CorsService {
  constructor(private configurationService: ConfigurationService) {}

  getOptions() {
    const clientBaseUrl = this.configurationService.getClientBaseUrl();
    console.log({ clientBaseUrl });

    const options: Record<string, CorsOptions> = {
      development: {
        origin: [
          clientBaseUrl || 'http://localhost:3000',
          'https://delala.vercel.app',
          'https://delala-admin.vercel.app',
          'http://localhost:5173',
        ],
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization',
      },
      production: {
        origin: [clientBaseUrl, 'https://delala-admin.vercel.app'],
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization',
      },
      staging: {
        origin: [clientBaseUrl, 'https://delala-admin.vercel.app'],
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Authorization',
      },
    };

    const environment = this.configurationService.getEnvironment();

    const value = options[environment];
    const valueDefault = options['development'];

    return value ?? valueDefault;
  }
}
