import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ShareDto {
  @ApiPropertyOptional({
    description: 'Platform where the post is being shared',
    example: 'facebook',
    enum: ['email', 'facebook', 'twitter', 'whatsapp', 'link', 'other'],
  })
  @IsOptional()
  @IsString()
  platform?: string;
}


