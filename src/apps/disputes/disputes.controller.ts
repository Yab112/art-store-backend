import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "../../core/guards/auth.guard";
import { DisputesService } from "./disputes.service";
import {
  ListDisputesQueryDto,
  ResolveDisputeDto,
  WaiveReturnDto,
  CancelBuyerWinsDto,
  CompleteRefundDto,
} from "./dto/resolve-dispute.dto";

@Controller("admin/disputes")
@UseGuards(AuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  private assertAdmin(req: any) {
    if (req.user?.role?.toUpperCase() !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }
  }

  @Get()
  async list(@Request() req, @Query() query: ListDisputesQueryDto) {
    this.assertAdmin(req);
    return this.disputesService.listDisputes(query);
  }

  @Get(":id")
  async getOne(@Request() req, @Param("id") id: string) {
    this.assertAdmin(req);
    return this.disputesService.getDisputeById(id);
  }

  @Post(":id/resolve")
  async resolve(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    this.assertAdmin(req);
    return this.disputesService.resolveDispute(id, req.user.id, dto);
  }

  @Post(":id/waive-return")
  async waiveReturn(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: WaiveReturnDto,
  ) {
    this.assertAdmin(req);
    return this.disputesService.waiveReturn(id, req.user.id, dto.reason);
  }

  @Post(":id/cancel-buyer-wins")
  async cancelBuyerWins(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: CancelBuyerWinsDto,
  ) {
    this.assertAdmin(req);
    return this.disputesService.cancelBuyerWins(id, req.user.id, dto.reason);
  }

  @Post(":id/complete-refund")
  async completeRefund(
    @Request() req,
    @Param("id") id: string,
    @Body() dto: CompleteRefundDto,
  ) {
    this.assertAdmin(req);
    return this.disputesService.completeRefund(id, req.user.id, dto?.note);
  }
}
