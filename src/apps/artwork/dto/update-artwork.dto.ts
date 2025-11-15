import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  Min,
  ValidateNested,
} from 'class-validator';
import { ArtworkDimensionInputDto } from './create-artwork.dto';

/**
 * DTO for updating an artwork
 * All fields are optional - only provided fields will be updated
 */
export class UpdateArtworkDto {
  @ApiPropertyOptional({
    description: 'Title of the artwork',
    example: 'Sunset Over Mountains Updated',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Artist name',
    example: 'John Doe Updated',
  })
  @IsOptional()
  @IsString()
  artist?: string;

  @ApiPropertyOptional({
    description: 'Art technique used',
    example: 'Oil on Canvas',
  })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiPropertyOptional({ description: 'Support material', example: 'Canvas' })
  @IsOptional()
  @IsString()
  support?: string;

  @ApiPropertyOptional({
    description: 'State of the artwork',
    example: 'Excellent',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Year artwork was created',
    example: '2020',
  })
  @IsOptional()
  @IsString()
  yearOfArtwork?: string;

  @ApiPropertyOptional({
    description: 'Artwork dimensions',
    type: ArtworkDimensionInputDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ArtworkDimensionInputDto)
  dimensions?: ArtworkDimensionInputDto;

  @ApiPropertyOptional({
    description: 'Whether artwork is framed',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isFramed?: boolean;

  @ApiPropertyOptional({ description: 'Weight of the artwork', example: '2kg' })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiPropertyOptional({ description: 'Accept hand delivery', example: true })
  @IsOptional()
  @IsBoolean()
  handDeliveryAccepted?: boolean;

  @ApiPropertyOptional({
    description: 'Origin of the artwork',
    example: 'France',
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({ description: 'Year of acquisition', example: '2021' })
  @IsOptional()
  @IsString()
  yearOfAcquisition?: string;

  @ApiPropertyOptional({ description: 'Artwork description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Desired price in currency',
    example: 1500.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  desiredPrice?: number;

  @ApiPropertyOptional({
    description: 'Accept price negotiation',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  acceptPriceNegotiation?: boolean;

  @ApiPropertyOptional({
    description: 'Account holder name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional({
    description: 'IBAN for payment',
    example: 'FR7630006000011234567890189',
  })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional({ description: 'BIC code', example: 'BNPAFRPPXXX' })
  @IsOptional()
  @IsString()
  bicCode?: string;

  @ApiPropertyOptional({ description: 'Accepted terms of sale', example: true })
  @IsOptional()
  @IsBoolean()
  acceptTermsOfSale?: boolean;

  @ApiPropertyOptional({ description: 'Given sales mandate', example: true })
  @IsOptional()
  @IsBoolean()
  giveSalesMandate?: boolean;

  @ApiPropertyOptional({ description: 'Proof of origin URL (S3)' })
  @IsOptional()
  @IsString()
  proofOfOrigin?: string;

  @ApiPropertyOptional({
    description: 'Array of photo URLs (S3)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
