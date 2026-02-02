import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from "class-validator";

/**
 * DTO for creating a new user
 */
export class CreateUserDto {
  @ApiProperty({ description: "User full name", example: "John Doe" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: "User email address",
    example: "john.doe@example.com",
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: "User profile image URL" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({
    description: "User role",
    example: "user",
    default: "user",
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: "Whether email is verified",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    description: "User score/rating",
    example: 0,
    default: 0,
  })
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({
    description: "Whether user is banned",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  banned?: boolean;
}
