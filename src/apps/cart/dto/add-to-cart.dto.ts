import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUUID, IsInt, Min, Max, IsOptional } from "class-validator";
import { CART_CONSTANTS } from "../constants";

export class AddToCartDto {
  @ApiProperty({
    description: "Artwork ID to add to cart",
    example: "uuid-artwork-id",
  })
  @IsString()
  @IsUUID()
  artworkId: string;

  @ApiPropertyOptional({
    description: "Quantity of the artwork (default: 1)",
    example: 1,
    minimum: CART_CONSTANTS.MIN_QUANTITY_PER_ITEM,
    maximum: CART_CONSTANTS.MAX_QUANTITY_PER_ITEM,
  })
  @IsOptional()
  @IsInt()
  @Min(CART_CONSTANTS.MIN_QUANTITY_PER_ITEM)
  @Max(CART_CONSTANTS.MAX_QUANTITY_PER_ITEM)
  quantity?: number;
}

export class UpdateCartItemDto {
  @ApiProperty({
    description: "New quantity for the cart item",
    example: 2,
    minimum: CART_CONSTANTS.MIN_QUANTITY_PER_ITEM,
    maximum: CART_CONSTANTS.MAX_QUANTITY_PER_ITEM,
  })
  @IsInt()
  @Min(CART_CONSTANTS.MIN_QUANTITY_PER_ITEM)
  @Max(CART_CONSTANTS.MAX_QUANTITY_PER_ITEM)
  quantity: number;
}
