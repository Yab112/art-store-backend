import { IsString, IsNotEmpty, IsBoolean, IsOptional, ValidateIf } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  /** Required for clean receipt; optional when raising a dispute. */
  @ValidateIf((o: ConfirmDeliveryDto) => !o.hasDispute)
  @IsString()
  @IsNotEmpty()
  signatureDataUrl?: string;

  @IsBoolean()
  acceptedTerms: boolean;

  @IsBoolean()
  hasDispute: boolean;

  @IsOptional()
  @IsString()
  disputeReason?: string; // e.g. DAMAGED, WRONG_ITEM, QUALITY_ISSUE, OTHER

  @IsOptional()
  @IsString()
  disputeNote?: string; // Optional description or note for the dispute

  @IsOptional()
  @IsString()
  attachmentDataUrl?: string; // Optional base64 file attachment for proof
}
