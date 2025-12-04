import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VoteTypeDto {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

export class VoteDto {
  @ApiProperty({
    description: 'Vote type',
    example: 'LIKE',
    enum: VoteTypeDto,
  })
  @IsEnum(VoteTypeDto)
  type: VoteTypeDto;
}








