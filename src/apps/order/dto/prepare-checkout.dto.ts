import {
  IsArray,
  IsString,
  ValidateNested,
  ArrayMinSize,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import {
  OrderItemDto,
  ShippingAddressDto,
  ShippingOptionDto,
  PaymentMethodEnum,
} from "./create-order.dto";

/** One seller's slice of a multi-seller checkout. */
export class PrepareCheckoutGroupDto {
  @IsString()
  sellerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsString()
  @IsEnum(["USD", "ETB"] as any)
  currency: "USD" | "ETB";

  @ValidateNested()
  @Type(() => ShippingOptionDto)
  shippingOption: ShippingOptionDto;
}

export class PrepareCheckoutDto {
  @IsString()
  buyerEmail: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrepareCheckoutGroupDto)
  groups: PrepareCheckoutGroupDto[];
}
