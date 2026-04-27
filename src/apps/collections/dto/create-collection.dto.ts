import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { COLLECTION_VALIDATION, COLLECTION_CONSTANTS } from "../constants";

export class CreateCollectionDto {
  @ApiProperty({
    description: "Collection name",
    example: "Modern Art Collection",
    minLength: COLLECTION_VALIDATION.NAME_MIN_LENGTH,
    maxLength: COLLECTION_VALIDATION.NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(COLLECTION_VALIDATION.NAME_MIN_LENGTH)
  @MaxLength(COLLECTION_VALIDATION.NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({
    description: "Collection description",
    maxLength: COLLECTION_VALIDATION.DESCRIPTION_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(COLLECTION_VALIDATION.DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({
    description: "Cover image URL (S3)",
    example:
      "https://art-gallery-s3-bucket.s3.us-east-1.amazonaws.com/images/cover.jpg",
  })
  @IsOptional()
  @IsString()
  coverImage?: string; // S3 URL

  @ApiPropertyOptional({
    description: "Collection visibility",
    enum: [
      COLLECTION_CONSTANTS.VISIBILITY.PUBLIC,
      COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
      COLLECTION_CONSTANTS.VISIBILITY.UNLISTED,
    ],
    default: COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
    example: COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    COLLECTION_CONSTANTS.VISIBILITY.PUBLIC,
    COLLECTION_CONSTANTS.VISIBILITY.PRIVATE,
    COLLECTION_CONSTANTS.VISIBILITY.UNLISTED,
  ])
  visibility?: string;
}
