import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { PROFILE_VALIDATION } from "../constants";

// Helper to transform empty strings to undefined
const TransformEmptyToUndefined = () =>
  Transform(({ value }) =>
    value === "" || value === null ? undefined : value,
  );

// Helper to transform empty strings to null (useful for clearing database fields)
const TransformEmptyToNull = () =>
  Transform(({ value }) =>
    value === "" ? null : value,
  );

export class UpdateProfileDto {
  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  @MaxLength(PROFILE_VALIDATION.NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  @MaxLength(PROFILE_VALIDATION.BIO_MAX_LENGTH)
  bio?: string;

  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  @MaxLength(PROFILE_VALIDATION.LOCATION_MAX_LENGTH)
  location?: string;

  @TransformEmptyToUndefined()
  @ValidateIf((o) => {
    // Only validate if website has a value (after transformation)
    const value = o.website;
    return value !== undefined && value !== null && value !== "";
  })
  @IsUrl({ require_tld: false }, { message: "Website must be a valid URL" })
  @ValidateIf((o) => {
    const value = o.website;
    return value !== undefined && value !== null && value !== "";
  })
  @MaxLength(PROFILE_VALIDATION.WEBSITE_MAX_LENGTH)
  website?: string;

  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  avatar?: string; // S3 URL

  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  coverImage?: string; // S3 URL

  @IsOptional()
  @TransformEmptyToUndefined()
  @IsString()
  phone?: string;

  // FedEx Artist Shipping Address fields
  // Note: @ValidateIf guards skip @IsString when value is null (after TransformEmptyToNull
  // converts "" to null). The ValidationPipe has skipNullProperties: false, so without
  // this guard the null would fail @IsString() validation.
  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressLine1?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressLine2?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressCity?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressState?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressZipCode?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressCountry?: string | null;

  @IsOptional()
  @TransformEmptyToNull()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  addressPhone?: string | null;

  @IsOptional()
  @TransformEmptyToUndefined()
  talentTypeIds?: string[]; // Array of talent type IDs for multiple talents
}
