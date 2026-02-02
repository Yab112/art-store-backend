import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import {
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from "./interfaces/payment-response.interface";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";

export interface PayPalPayoutResponse {
  success: boolean;
  payoutBatchId?: string;
  transactionId?: string;
  status?: string;
  message?: string;
}

/**
 * PayPal Service
 * Uses the platform's PayPal business account credentials.
 * Customer payments go to the platform account, which then sends payouts to artists.
 */
@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>("PAYPAL_CLIENT_ID");
    this.clientSecret = this.configService.get<string>("PAYPAL_CLIENT_SECRET");
    const mode = this.configService.get<string>("PAYPAL_MODE") || "sandbox";

    this.baseUrl =
      mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn("PayPal credentials not configured");
      this.logger.warn(
        `PAYPAL_CLIENT_ID: ${this.clientId ? "Set (hidden)" : "NOT SET"}`,
      );
      this.logger.warn(
        `PAYPAL_CLIENT_SECRET: ${this.clientSecret ? "Set (hidden)" : "NOT SET"}`,
      );
    } else {
      this.logger.log(`PayPal configured for ${mode} mode`);
    }
  }

  /**
   * Get PayPal access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");

      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error("Failed to get PayPal access token");
      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.error_description ||
          error.response?.data?.error ||
          error.message;
        throw new BadRequestException(
          `PayPal authentication failed: ${errorMessage}. Check your CLIENT_ID and CLIENT_SECRET.`,
        );
      }
      throw new BadRequestException(
        "PayPal authentication failed. Please check your credentials.",
      );
    }
  }

  /**
   * Initialize a payment with PayPal
   */
  async initializePayment(
    paymentData: InitializePaymentDto,
  ): Promise<PaymentInitializeResponse> {
    try {
      const accessToken = await this.getAccessToken();

      const frontendUrl = this.configService.get("FRONTEND_URL");
      const baseReturnUrl =
        paymentData.returnUrl || `${frontendUrl}/payment/success`;

      const payload = {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: paymentData.txRef,
            description: `Art Gallery Order ${paymentData.orderId || paymentData.txRef}`,
            amount: {
              currency_code: paymentData.currency || "USD",
              value: paymentData.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Art Gallery",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${baseReturnUrl}?provider=paypal`,
          cancel_url:
            paymentData.callbackUrl || `${frontendUrl}/payment/cancel`,
        },
      };

      this.logger.log(`Initializing PayPal payment: ${paymentData.txRef}`);

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const approvalUrl = response.data.links.find(
        (link: any) => link.rel === "approve",
      )?.href;

      if (!approvalUrl) {
        throw new BadRequestException("PayPal approval URL not found");
      }

      // PayPal will return with token parameter (order ID) in the return URL
      // We return the PayPal order ID as txRef for verification
      return {
        success: true,
        message: "Payment initialized successfully",
        data: {
          checkoutUrl: approvalUrl,
          txRef: response.data.id, // PayPal order ID
          provider: "paypal",
        },
      };
    } catch (error) {
      this.logger.error("PayPal payment initialization failed:", error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new BadRequestException(`PayPal payment failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Capture a PayPal order
   */
  async capturePayment(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      this.logger.log(`Capturing PayPal payment: ${orderId}`);

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error("PayPal payment capture failed:", error);
      throw error;
    }
  }

  /**
   * Verify a PayPal payment
   * If order is APPROVED, it will be automatically captured
   */
  async verifyPayment(orderId: string): Promise<PaymentVerifyResponse> {
    try {
      const accessToken = await this.getAccessToken();

      this.logger.log(`Verifying PayPal payment: ${orderId}`);

      // First, get the order status
      const orderResponse = await axios.get(
        `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const order = orderResponse.data;
      let status = order.status;
      const purchaseUnit = order.purchase_units[0];

      // If order is APPROVED, capture it to complete the payment
      if (status === "APPROVED") {
        this.logger.log(`Capturing approved PayPal order: ${orderId}`);
        try {
          const captureResponse = await axios.post(
            `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
            {},
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );

          // Verify capture was successful
          const captureStatus = captureResponse.data.status;
          const captureDetails =
            captureResponse.data.purchase_units?.[0]?.payments?.captures?.[0];

          if (
            captureStatus === "COMPLETED" &&
            captureDetails?.status === "COMPLETED"
          ) {
            status = "COMPLETED";
            this.logger.log(`PayPal order captured successfully: ${orderId}`);
          } else {
            status = "FAILED";
            this.logger.error(
              `PayPal capture failed with status: ${captureStatus}`,
            );
            throw new BadRequestException(
              `PayPal payment capture failed: ${captureDetails?.status_details?.reason || "Insufficient funds or payment declined"}.`,
            );
          }
        } catch (captureError: any) {
          status = "FAILED";
          this.logger.error(
            `Failed to capture PayPal order ${orderId}:`,
            captureError,
          );
          const errorMessage =
            captureError?.response?.data?.message ||
            captureError?.response?.data?.details?.[0]?.description ||
            captureError?.message ||
            "Unknown error";
          throw new BadRequestException(
            `PayPal payment capture failed: ${errorMessage}`,
          );
        }
      } else if (status === "COMPLETED") {
        this.logger.log(`PayPal order already completed: ${orderId}`);
      }

      // Only treat COMPLETED as success, not APPROVED
      const isSuccess = status === "COMPLETED";

      // Get the original txRef from reference_id (stored when order was created)
      const originalTxRef = purchaseUnit.reference_id || orderId;

      return {
        success: isSuccess,
        message: isSuccess
          ? "Payment verified successfully"
          : "Payment not completed",
        data: {
          status: isSuccess ? "success" : status.toLowerCase(),
          userId: order.userId,
          amount: parseFloat(purchaseUnit.amount.value),
          currency: purchaseUnit.amount.currency_code,
          txRef: orderId, // PayPal order ID
          originalTxRef: originalTxRef, // Original TX-{orderId}-{timestamp} format
          provider: "paypal",
          chargeResponseMessage: status,
          customerEmail: order.payer?.email_address,
          customerName: `${order.payer?.name?.given_name || ""} ${order.payer?.name?.surname || ""}`,
        },
      };
    } catch (error) {
      this.logger.error("PayPal payment verification failed:", error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new BadRequestException(`PayPal verification failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Process PayPal Payout to artist
   * @param email PayPal email of the recipient
   * @param amount Amount to payout
   * @param currency Currency code (default: USD)
   * @param note Note for the payout
   */
  async processPayout(
    email: string,
    amount: number,
    currency: string = "USD",
    note?: string,
  ): Promise<PayPalPayoutResponse> {
    try {
      this.logger.log(
        `Processing PayPal payout: ${currency} ${amount.toFixed(2)} to ${email}`,
      );

      const accessToken = await this.getAccessToken();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException("Invalid PayPal email address");
      }

      const senderBatchId = `PAYOUT-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const senderItemId = `PAYOUT-ITEM-${Date.now()}`;

      const payoutPayload = {
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: "You have received a payout from Art Gallery",
          email_message:
            note ||
            `You have received a payout of ${currency} ${amount.toFixed(2)} from Art Gallery.`,
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: amount.toFixed(2),
              currency: currency,
            },
            receiver: email,
            note: note || `Payout from Art Gallery`,
            sender_item_id: senderItemId,
          },
        ],
      };

      const response = await axios.post(
        `${this.baseUrl}/v1/payments/payouts`,
        payoutPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const payoutBatchId = response.data.batch_header?.payout_batch_id;
      const payoutStatus = response.data.batch_header?.batch_status;

      this.logger.log(
        `PayPal payout successful - Batch ID: ${payoutBatchId}, Status: ${payoutStatus}`,
      );

      return {
        success: true,
        payoutBatchId,
        status: payoutStatus,
        message: "Payout processed successfully",
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to process PayPal payout: ${error.message || error}`,
      );

      if (axios.isAxiosError(error)) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.response?.data?.details?.[0]?.issue ||
          error?.response?.data?.details?.[0]?.description ||
          error?.message ||
          "Failed to process payout";

        return {
          success: false,
          message: errorMessage,
        };
      }

      return {
        success: false,
        message: error?.message || "Failed to process payout",
      };
    }
  }

  /**
   * Get payout status
   * @param payoutBatchId PayPal payout batch ID
   */
  async getPayoutStatus(payoutBatchId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/v1/payments/payouts/${payoutBatchId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get payout status for Batch ID: ${payoutBatchId}`,
      );
      throw new BadRequestException(
        error?.response?.data?.message || "Failed to get payout status",
      );
    }
  }

  /**
   * Verify PayPal webhook signature
   * @param headers Request headers containing webhook signature
   * @param body Webhook payload body
   */
  async verifyWebhookSignature(headers: any, body: any): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const webhookId = this.configService.get<string>("PAYPAL_WEBHOOK_ID");

      if (!webhookId) {
        this.logger.warn(
          "PAYPAL_WEBHOOK_ID not configured. Skipping signature verification (allowed in sandbox/development).",
        );
        return true; // Allow in development/sandbox without webhook ID
      }

      const verifyUrl = `${this.baseUrl}/v1/notifications/verify-webhook-signature`;

      const verificationPayload = {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: body,
      };

      const response = await axios.post(verifyUrl, verificationPayload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const isValid = response.data.verification_status === "SUCCESS";

      if (!isValid) {
        this.logger.warn(
          `Webhook signature verification failed: ${response.data.verification_status}`,
        );
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(
        "Webhook signature verification error:",
        error.message || error,
      );
      // In sandbox, we might not have webhook ID configured, so allow it
      return true;
    }
  }

  /**
   * Handle PayPal webhook events
   * Supports both payment and payout webhooks
   */
  async handleWebhook(payload: any, headers?: any): Promise<any> {
    try {
      const eventType = payload.event_type || "unknown";

      this.logger.log(`Processing PayPal webhook: ${eventType}`);

      // Verify webhook signature if headers provided
      if (headers && headers["paypal-transmission-id"]) {
        try {
          await this.verifyWebhookSignature(headers, payload);
        } catch (error: any) {
          this.logger.warn(
            `Webhook signature verification error (allowing): ${error.message}`,
          );
        }
      }

      const resource = payload.resource;

      // Handle payout-related webhook events
      if (eventType?.includes("PAYOUTSBATCH")) {
        const batchId = resource?.batch_header?.payout_batch_id;
        const batchStatus = resource?.batch_header?.batch_status;

        return {
          success: true,
          eventType: "PAYOUT_BATCH",
          payoutBatchId: batchId,
          status: batchStatus,
          message: "Payout batch webhook processed",
        };
      }

      // Handle individual payout item events
      if (eventType?.includes("PAYOUTS") && eventType?.includes("ITEM")) {
        const payoutItemId = resource?.payout_item_id;
        const transactionId = resource?.transaction_id;
        const transactionStatus = resource?.transaction_status;
        const payoutBatchId = resource?.payout_batch_id;

        return {
          success: true,
          eventType: "PAYOUT_ITEM",
          payoutItemId: payoutItemId,
          transactionId: transactionId,
          transactionStatus: transactionStatus,
          payoutBatchId: payoutBatchId,
          message: "Payout item webhook processed",
        };
      }

      // Handle payment-related webhooks (for orders)
      if (eventType?.includes("PAYMENT")) {
        return {
          success: true,
          eventType: "PAYMENT",
          message: "Payment webhook processed",
        };
      }

      this.logger.warn(`Unhandled webhook event type: ${eventType}`);

      return {
        success: true,
        eventType: "UNKNOWN",
        message: "Webhook received but not processed",
      };
    } catch (error: any) {
      this.logger.error(
        "PayPal webhook processing failed:",
        error.message || error,
      );
      throw error;
    }
  }
}
