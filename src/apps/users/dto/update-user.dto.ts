import { ApiPropertyOptional } from "@nestjs/swagger";
import { PartialType } from "@nestjs/mapped-types";
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from "class-validator";
import { CreateUserDto } from "./create-user.dto";

/**
 * DTO for updating an existing user
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: "User full name",
    example: "John Doe Updated",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "User email address",
    example: "john.doe.updated@example.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "User profile image URL" })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: "User role", example: "admin" })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: "Whether email is verified" })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiPropertyOptional({ description: "User score/rating", example: 4.5 })
  @IsOptional()
  score?: number;

  @ApiPropertyOptional({ description: "Whether user is banned" })
  @IsOptional()
  @IsBoolean()
  banned?: boolean;

  @ApiPropertyOptional({ description: "Ban reason" })
  @IsOptional()
  @IsString()
  banReason?: string;

  @ApiPropertyOptional({ description: "Ban expiration date" })
  @IsOptional()
  banExpires?: Date;
}
