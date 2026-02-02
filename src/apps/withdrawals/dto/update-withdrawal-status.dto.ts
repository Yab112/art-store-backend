import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentStatus } from "@prisma/client";

export class UpdateWithdrawalStatusDto {
  @ApiProperty({
    description: "New status for the withdrawal",
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
  })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({
    description: "Optional reason for status change",
    example: "Approved by admin",
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
