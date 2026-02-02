import { IsString, IsArray, IsNotEmpty, ArrayMinSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddArtworkDto {
  @ApiProperty({
    description: "Artwork ID to add to collection",
    example: "uuid-of-artwork",
  })
  @IsString()
  @IsNotEmpty()
  artworkId: string;
}

export class AddArtworksDto {
  @ApiProperty({
    description: "Array of artwork IDs to add to collection",
    type: [String],
    example: ["uuid1", "uuid2", "uuid3"],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  artworkIds: string[];
}
