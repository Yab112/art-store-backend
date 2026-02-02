import { IsString, IsNotEmpty, IsOptional, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCommentDto {
  @ApiProperty({
    description: "Comment content",
    example: "Great article! Thanks for sharing.",
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    description: "Parent comment ID for nested/reply comments",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}
