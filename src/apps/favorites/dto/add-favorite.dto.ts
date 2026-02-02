import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

export class AddFavoriteDto {
  @ApiProperty({
    description: "Artwork ID to add to favorites",
    example: "uuid-artwork-id",
  })
  @IsString()
  @IsUUID()
  artworkId: string;
}
