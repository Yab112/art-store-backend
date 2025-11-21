import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Abstract Art',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Artworks featuring abstract techniques and styles',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
