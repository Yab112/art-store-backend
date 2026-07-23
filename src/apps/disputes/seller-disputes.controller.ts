import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthGuard } from "../../core/guards/auth.guard";
import { DisputesService } from "./disputes.service";
import { ConfirmReturnDto } from "./dto/resolve-dispute.dto";

@Controller("disputes")
@UseGuards(AuthGuard)
export class SellerDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get("return-queue")
  async returnQueue(@Request() req) {
    return this.disputesService.listSellerReturnQueue(req.user.id);
  }

  @Get(":id")
  async getOne(@Request() req, @Param("id") id: string) {
    return this.disputesService.getSellerDispute(id, req.user.id);
  }

  @Post(":id/confirm-return")
  async confirmReturn(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: ConfirmReturnDto,
  ) {
    return this.disputesService.confirmReturn(id, req.user.id, dto);
  }
}
