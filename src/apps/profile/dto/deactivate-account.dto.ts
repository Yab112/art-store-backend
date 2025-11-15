import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class DeactivateAccountDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  deleteData?: boolean; // Whether to delete all user data or just deactivate

  @IsOptional()
  @IsString()
  feedback?: string; // User feedback about why they're leaving
}
