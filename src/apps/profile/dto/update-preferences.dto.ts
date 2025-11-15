import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { PROFILE_CONSTANTS } from '../constants';

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @IsOptional()
  @IsBoolean()
  newArtwork?: boolean;

  @IsOptional()
  @IsBoolean()
  priceChanges?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;

  @IsOptional()
  @IsBoolean()
  reviews?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional()
  notifications?: NotificationPreferencesDto;

  @IsOptional()
  @IsString()
  @IsIn(PROFILE_CONSTANTS.SUPPORTED_LANGUAGES)
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    PROFILE_CONSTANTS.VISIBILITY.PUBLIC,
    PROFILE_CONSTANTS.VISIBILITY.PRIVATE,
    PROFILE_CONSTANTS.VISIBILITY.FRIENDS_ONLY,
  ])
  profileVisibility?: string;

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;
}
