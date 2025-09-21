import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigurationService {
  constructor(private manager: ConfigService) {}

  get(key: string, valueDefault?: string): string {
    return this.manager.get(key, valueDefault);
  }

  getAccessSignToken() {
    return this.manager.get('JWT_ACCESS_SECRET');
  }

  getPort(): number {
    return this.manager.get('PORT', 3099);
  }

  getNumber(key: string, valueDefault?: number): number {
    return this.manager.get<number>(key, valueDefault);
  }

  getBoolean(key: string, valueDefault?: boolean): boolean {
    return this.manager.get<boolean>(key, valueDefault);
  }

  getEnvironment(): string {
    const value = this.get('NODE_ENV', 'development');

    return value;
  }

  getClientBaseUrl(): string {
    const value = this.manager.get('CLIENT_BASE_URL');
    const valueClean = value?.replace(/\/$/, '') || value;
    return valueClean;
  }

  getBaseUrl(): string {
    const port = this.getPort();
    const value = this.manager.get('BASE_URL', `http://localhost:${port}`);

    const valueClean = value?.replace(/\/$/, '') || value;
    return valueClean;
  }

  isEnvironmentDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  isEnvironmentProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  isEnvironmentStaging(): boolean {
    return this.getEnvironment() === 'staging';
  }
}
