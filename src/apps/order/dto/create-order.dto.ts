import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

export class OrderItemDto {
  @IsString()
  artworkId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;
}

export class ShippingAddressDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;

  @IsString()
  @IsOptional()
  country?: string;
}

export enum PaymentMethodEnum {
  CHAPA = "chapa",
  PAYPAL = "paypal",
  CARD = "card",
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsString()
  buyerEmail: string;
}
