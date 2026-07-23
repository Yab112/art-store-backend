import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Transform } from "class-transformer";

export class ResolveDisputeDto {
  @IsString()
  @IsIn(["SELLER_WINS", "BUYER_WINS"])
  outcome: "SELLER_WINS" | "BUYER_WINS";

  @IsString()
  @IsNotEmpty()
  resolution: string;

  /** Buyer Wins only. Default true. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  })
  @IsBoolean()
  returnRequired?: boolean;

  /** Required when returnRequired === false */
  @IsOptional()
  @IsString()
  returnWaiveReason?: string;
}

export class WaiveReturnDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CancelBuyerWinsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteRefundDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmReturnDto {
  @IsString()
  @IsNotEmpty()
  signatureDataUrl: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Optional evidence photos as data URLs */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoDataUrls?: string[];
}

export class ListDisputesQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
