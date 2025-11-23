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
          'http://localhost:5173', // Vite dev server (frontend)
          'http://localhost:3000', // Backend (for Swagger, etc.)
          'http://localhost:3001',
          clientBaseUrl,
          'https://art-store-frontend-flame.vercel.app',
          process.env.FRONTEND_URL || 'http://localhost:5173',
        ],
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
      production: {
        origin: [
          clientBaseUrl,
          'https://art-store-frontend-flame.vercel.app',
          process.env.FRONTEND_URL,
        ].filter(Boolean),
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
      staging: {
        origin: [
          clientBaseUrl,
          'https://art-store-frontend-flame.vercel.app',
          process.env.FRONTEND_URL,
        ].filter(Boolean),
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      },
    };

    const environment = this.configurationService.getEnvironment();

    const value = options[environment];
    const valueDefault = options['development'];

    return value ?? valueDefault;
  }
}
