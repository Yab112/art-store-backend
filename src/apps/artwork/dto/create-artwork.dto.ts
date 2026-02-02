import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class ArtworkDimensionInputDto {
  @ApiProperty({ description: "Height of the artwork", example: "50cm" })
  @IsString()
  height: string;

  @ApiProperty({ description: "Width of the artwork", example: "60cm" })
  @IsString()
  width: string;

  @ApiPropertyOptional({ description: "Depth of the artwork", example: "5cm" })
  @IsOptional()
  @IsString()
  depth?: string;
}

export class CreateArtworkDto {
  @ApiPropertyOptional({
    description: "Title of the artwork",
    example: "Sunset Over Mountains",
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: "Artist name", example: "John Doe" })
  @IsString()
  artist: string;

  @ApiProperty({
    description: "Category IDs for the artwork",
    example: ["123e4567-e89b-12d3-a456-426614174000"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];

  @ApiProperty({ description: "Support material", example: "Canvas" })
  @IsString()
  support: string;

  @ApiProperty({ description: "State of the artwork", example: "Excellent" })
  @IsString()
  state: string;

  @ApiProperty({ description: "Year artwork was created", example: "2020" })
  @IsString()
  yearOfArtwork: string;

  @ApiProperty({
    description: "Artwork dimensions",
    type: ArtworkDimensionInputDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ArtworkDimensionInputDto)
  dimensions: ArtworkDimensionInputDto;

  @ApiProperty({ description: "Whether artwork is framed", example: true })
  @IsBoolean()
  isFramed: boolean;

  @ApiProperty({ description: "Weight of the artwork", example: "2kg" })
  @IsString()
  weight: string;

  @ApiProperty({ description: "Accept hand delivery", example: true })
  @IsBoolean()
  handDeliveryAccepted: boolean;

  @ApiProperty({ description: "Origin of the artwork", example: "France" })
  @IsString()
  origin: string;

  @ApiPropertyOptional({ description: "Year of acquisition", example: "2021" })
  @IsOptional()
  @IsString()
  yearOfAcquisition?: string;

  @ApiPropertyOptional({ description: "Artwork description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Desired price in currency", example: 1500.0 })
  @IsNumber()
  @Min(0)
  desiredPrice: number;

  @ApiProperty({ description: "Accept price negotiation", example: true })
  @IsBoolean()
  acceptPriceNegotiation: boolean;

  @ApiProperty({ description: "Account holder name", example: "John Doe" })
  @IsString()
  accountHolder: string;

  @ApiProperty({
    description: "IBAN for payment",
    example: "FR7630006000011234567890189",
  })
  @IsString()
  iban: string;

  @ApiPropertyOptional({ description: "BIC code", example: "BNPAFRPPXXX" })
  @IsOptional()
  @IsString()
  bicCode?: string;

  @ApiProperty({ description: "Accepted terms of sale", example: true })
  @IsBoolean()
  acceptTermsOfSale: boolean;

  @ApiProperty({ description: "Given sales mandate", example: true })
  @IsBoolean()
  giveSalesMandate: boolean;

  @ApiPropertyOptional({ description: "Proof of origin URL (S3)" })
  @IsOptional()
  @IsString()
  proofOfOrigin?: string;

  @ApiProperty({ description: "Array of photo URLs (S3)", type: [String] })
  @IsArray()
  @IsString({ each: true })
  photos: string[];
}
