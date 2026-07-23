import { IsString, IsArray, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipientAddressDto {
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

export class GetRatesDto {
  @ValidateNested()
  @Type(() => RecipientAddressDto)
  recipientAddress: RecipientAddressDto;

  @IsArray()
  @IsString({ each: true })
  cartItemIds: string[];
}
