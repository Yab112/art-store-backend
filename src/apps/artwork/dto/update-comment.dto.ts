import { IsNotEmpty, IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { ARTWORK_VALIDATION } from "../constants";

/**
 * DTO for updating a comment on an artwork
 */
export class UpdateCommentDto {
  @ApiProperty({
    description: "Updated comment content",
    example: "This is an updated comment about the artwork!",
    minLength: ARTWORK_VALIDATION.COMMENT_MIN_LENGTH,
    maxLength: ARTWORK_VALIDATION.COMMENT_MAX_LENGTH,
  })
  @IsNotEmpty({ message: "Comment cannot be empty" })
  @IsString()
  @MinLength(ARTWORK_VALIDATION.COMMENT_MIN_LENGTH, {
    message: `Comment must be at least ${ARTWORK_VALIDATION.COMMENT_MIN_LENGTH} character long`,
  })
  @MaxLength(ARTWORK_VALIDATION.COMMENT_MAX_LENGTH, {
    message: `Comment must not exceed ${ARTWORK_VALIDATION.COMMENT_MAX_LENGTH} characters`,
  })
  comment: string;
}
