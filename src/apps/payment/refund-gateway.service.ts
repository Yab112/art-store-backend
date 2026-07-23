import { Injectable, Logger } from "@nestjs/common";
import { PaypalService } from "./paypal.service";
import { ChapaService } from "./chapa.service";
import { EarningProvider } from "../balance/balance.service";

export type GatewayRefundOutcome = "success" | "failed" | "unknown";

export interface GatewayRefundResult {
  outcome: GatewayRefundOutcome;
  gatewayRefundId?: string;
  message?: string;
}

@Injectable()
export class RefundGatewayService {
  private readonly logger = new Logger(RefundGatewayService.name);

  constructor(
    private readonly paypalService: PaypalService,
    private readonly chapaService: ChapaService,
  ) {}

  async refundOrderPayment(params: {
    provider: EarningProvider;
    amount: number;
    currency?: string;
    idempotencyKey: string;
    metadata: Record<string, any>;
  }): Promise<GatewayRefundResult> {
    const { provider, amount, currency, idempotencyKey, metadata } = params;

    if (provider === "paypal") {
      const captureId =
        metadata.paypalCaptureId ||
        metadata.captureId ||
        metadata.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      const paypalOrderId =
        metadata.paypalOrderId ||
        metadata.txRef ||
        metadata.orderId;

      this.logger.log(
        `PayPal refund attempt idempotencyKey=${idempotencyKey} capture=${captureId || "n/a"} order=${paypalOrderId || "n/a"}`,
      );

      return this.paypalService.refundCapture({
        captureId,
        paypalOrderId,
        amount,
        currency: currency || "USD",
        idempotencyKey,
      });
    }

    const txRef =
      metadata.txRef ||
      metadata.chapaTxRef ||
      metadata.originalTxRef ||
      metadata.reference;

    if (!txRef) {
      return {
        outcome: "failed",
        message: "No Chapa tx_ref available to refund",
      };
    }

    this.logger.log(
      `Chapa refund attempt idempotencyKey=${idempotencyKey} txRef=${txRef}`,
    );

    return this.chapaService.refundPayment({
      txRef: String(txRef),
      amount,
      idempotencyKey,
      reason: "Dispute resolution refund",
    });
  }
}
