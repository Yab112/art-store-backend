import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../core/guards/auth.guard";
import { CheckoutCapabilityService } from "./checkout-capability.service";

@Controller()
export class CheckoutCapabilityController {
  constructor(private readonly caps: CheckoutCapabilityService) {}

  /**
   * Resolve checkout payment methods for a cart/order.
   * GET /api/checkout/available-methods?artworkIds=a,b&country=US
   */
  @Get("checkout/available-methods")
  @UseGuards(AuthGuard)
  async availableMethods(
    @Request() req: any,
    @Query("artworkIds") artworkIdsRaw: string,
    @Query("country") country?: string,
  ) {
    const buyerId = req.user?.id || req.user?.userId;
    const artworkIds = String(artworkIdsRaw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!artworkIds.length) {
      return {
        success: true,
        data: {
          availableMethods: [],
          compatible: false,
          reason: "No artworks selected",
        },
      };
    }

    const resolved = await this.caps.resolveForArtworks({
      buyerId,
      artworkIds,
      buyerCountry: country,
    });

    return { success: true, data: resolved };
  }
}
