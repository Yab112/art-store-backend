export interface ConfigurationObject {
  port: number;
  environment: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export const createConfigurationObject = (): ConfigurationObject => {
  return {
    port: parseInt(process.env.PORT || '5000', 10),
    environment: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_ACCESS_SECRET || 'default-secret',
    jwtExpiresIn: process.env.JWT_EXPIRY_TIME || '1d',
  };
};
