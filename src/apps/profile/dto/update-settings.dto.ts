import { IsBoolean, IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateSettingsDto {
  // Privacy settings
  @IsOptional()
  @IsBoolean()
  allowMessagesFromAnyone?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowTagging?: boolean;

  // Security settings
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  loginNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  suspiciousActivityAlerts?: boolean;

  // Email settings
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  // Account settings
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  searchable?: boolean;

  @IsOptional()
  @IsBoolean()
  indexable?: boolean; // Allow search engines to index profile
}
