import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArtworkListItemDto } from "../../artwork/dto/artwork-response.dto";

export class CartItemDto {
  @ApiProperty({ description: "Cart item ID", example: "uuid" })
  id: string;

  @ApiProperty({ description: "User ID", example: "uuid" })
  userId: string;

  @ApiProperty({ description: "Artwork ID", example: "uuid" })
  artworkId: string;

  @ApiProperty({ description: "Quantity of the artwork", example: 1 })
  quantity: number;

  @ApiProperty({ description: "Date when item was added to cart" })
  createdAt: Date;

  @ApiProperty({ description: "Date when item was last updated" })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Artwork details",
    type: ArtworkListItemDto,
  })
  artwork?: ArtworkListItemDto;
}

export class CartResponseDto {
  @ApiProperty({ description: "List of cart items", type: [CartItemDto] })
  items: CartItemDto[];

  @ApiProperty({ description: "Total number of items in cart", example: 5 })
  totalItems: number;

  @ApiProperty({
    description: "Total price of all items in cart",
    example: 1500.0,
  })
  totalPrice: number;

  @ApiProperty({ description: "Pagination information" })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
