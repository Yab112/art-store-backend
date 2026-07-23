import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Transform, Type } from "class-transformer";

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

export class ShippingOptionDto {
  @IsString()
  serviceType: string;

  @IsString()
  serviceName: string;

  @IsNumber()
  totalCharge: number;

  @IsString()
  currency: string;

  /** FedEx sometimes sends objects/enums; coerce or drop invalid values. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === "") return undefined;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  })
  @IsNumber()
  transitDays?: number;
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

  /** Explicit charge currency — never inferred from paymentMethod at runtime. */
  @IsString()
  @IsEnum(["USD", "ETB"] as any)
  currency: "USD" | "ETB";

  @IsString()
  buyerEmail: string;

  @ValidateNested()
  @Type(() => ShippingOptionDto)
  shippingOption: ShippingOptionDto;

  /** Multi-seller session id — shared across sibling orders from prepare. */
  @IsString()
  @IsOptional()
  checkoutId?: string;

  /** Expected single seller for this order (enforced against artwork owners). */
  @IsString()
  @IsOptional()
  sellerId?: string;
}
