import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ARTWORK_VALIDATION } from '../constants';

/**
 * DTO for creating a comment on an artwork
 */
export class CreateCommentDto {
  @ApiProperty({ 
    description: 'Comment content', 
    example: 'This is a beautiful piece of art!',
    minLength: ARTWORK_VALIDATION.COMMENT_MIN_LENGTH,
    maxLength: ARTWORK_VALIDATION.COMMENT_MAX_LENGTH
  })
  @IsNotEmpty({ message: 'Comment cannot be empty' })
  @IsString()
  @MinLength(ARTWORK_VALIDATION.COMMENT_MIN_LENGTH, {
    message: `Comment must be at least ${ARTWORK_VALIDATION.COMMENT_MIN_LENGTH} character long`,
  })
  @MaxLength(ARTWORK_VALIDATION.COMMENT_MAX_LENGTH, {
    message: `Comment must not exceed ${ARTWORK_VALIDATION.COMMENT_MAX_LENGTH} characters`,
  })
  comment: string;
}
