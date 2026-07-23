import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import {
  ChapaInitializeResponse,
  ChapaVerifyResponse,
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from "./interfaces/payment-response.interface";
import { InitializePaymentDto } from "./dto/initialize-payment.dto";
import { PrismaService } from "../../core/database/prisma.service";

@Injectable()
export class ChapaService {
  private readonly logger = new Logger(ChapaService.name);
  private readonly baseUrl = "https://api.chapa.co/v1";
  private readonly secretKey: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.secretKey = this.configService.get<string>("CHAPA_SECRET_KEY");
    if (!this.secretKey) {
      this.logger.warn("CHAPA_SECRET_KEY not configured");
    }
  }

  /**
   * Initialize a payment with Chapa
   */
  async initializePayment(
    paymentData: InitializePaymentDto,
  ): Promise<PaymentInitializeResponse> {
    try {
      // Validate secret key
      if (!this.secretKey) {
        throw new BadRequestException("Chapa secret key is not configured");
      }

      // Validate required fields
      if (!paymentData.email) {
        throw new BadRequestException("Email is required");
      }

      if (!paymentData.txRef) {
        throw new BadRequestException("Transaction reference is required");
      }

      // Chapa requires amount as a number (not string) and currency must be ETB
      const currency = paymentData.currency || "ETB";
      const amount =
        typeof paymentData.amount === "string"
          ? parseFloat(paymentData.amount)
          : Number(paymentData.amount);

      if (isNaN(amount) || amount <= 0) {
        throw new BadRequestException("Invalid payment amount");
      }

      // Ensure amount is rounded to 2 decimal places for Chapa
      const roundedAmount = Math.round(amount * 100) / 100;

      // Chapa has strict length limits:
      // - tx_ref: max 50 characters
      // - customization.title: max 16 characters
      // - customization.description: max 50 characters

      // Shorten txRef if it exceeds 50 characters (keep last 47 chars + "..." if needed)
      let txRef = paymentData.txRef;
      if (txRef.length > 50) {
        // Use order ID (first 8 chars) + timestamp (last 13 chars) to stay under 50
        const orderId = paymentData.orderId || "";
        const shortOrderId = orderId.substring(0, 8);
        const timestamp = Date.now().toString();
        txRef = `TX-${shortOrderId}-${timestamp}`.substring(0, 50);
        this.logger.warn(
          `TxRef truncated from ${paymentData.txRef.length} to ${txRef.length} characters: ${txRef}`,
        );
      }

      // Shorten title to max 16 characters
      const title = "Art Payment".substring(0, 16);

      // Shorten description to max 50 characters
      const orderIdShort = paymentData.orderId
        ? paymentData.orderId.substring(0, 8)
        : txRef.substring(0, 8);
      const description = `Order ${orderIdShort}`.substring(0, 50);

      // Get frontend URL for return URL
      const frontendUrl = this.configService.get<string>("FRONTEND_URL");
      const serverUrl =
        this.configService.get<string>("SERVER_BASE_URL") ||
        this.configService.get<string>("API_BASE_URL");

      const payload: Record<string, any> = {
        amount: roundedAmount,
        currency: currency,
        email: paymentData.email,
        first_name: paymentData.firstName || "",
        last_name: paymentData.lastName || "",
        tx_ref: txRef,
        callback_url:
          paymentData.callbackUrl || `${serverUrl}/api/payment/chapa/callback`,
        return_url:
          paymentData.returnUrl ||
          `${frontendUrl}/payment/success?txRef=${txRef}`,
        customization: {
          title: title,
          description: description,
        },
      };


      this.logger.log(
        `Initializing Chapa payment: ${paymentData.txRef}`,
        JSON.stringify(payload, null, 2),
      );

      const response = await axios.post<ChapaInitializeResponse>(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status === "success") {
        const checkoutUrl = response.data.data.checkout_url;
        this.logger.log(
          `Chapa payment initialized successfully. Checkout URL: ${checkoutUrl}`,
        );

        const responseData = {
          success: true,
          message: "Payment initialized successfully",
          data: {
            checkoutUrl: checkoutUrl,
            txRef: paymentData.txRef,
            provider: "chapa",
          },
        };

        // Store shortened txRef in a way that can be accessed later
        if (txRef !== paymentData.txRef) {
          (responseData.data as any).chapaTxRef = txRef;
        }
        return responseData;
      } else {
        this.logger.error("Chapa returned non-success status:", response.data);
        throw new BadRequestException("Failed to initialize payment");
      }
    } catch (error) {
      this.logger.error("Chapa payment initialization failed:", error);

      if (axios.isAxiosError(error)) {
        // Extract error message properly
        let errorMessage = "Unknown error";

        if (error.response?.data) {
          const errorData = error.response.data;

          // Try to extract message from different possible structures
          if (typeof errorData.message === "string") {
            errorMessage = errorData.message;
          } else if (typeof errorData === "string") {
            errorMessage = errorData;
          } else if (errorData.error) {
            errorMessage =
              typeof errorData.error === "string"
                ? errorData.error
                : JSON.stringify(errorData.error);
          } else if (errorData.status === "error" && errorData.message) {
            errorMessage =
              typeof errorData.message === "string"
                ? errorData.message
                : JSON.stringify(errorData.message);
          } else {
            // Fallback: stringify the whole response data
            errorMessage = JSON.stringify(errorData);
          }

          // Log full error response for debugging
          this.logger.error(
            "Chapa API error response:",
            JSON.stringify(error.response.data, null, 2),
          );
        } else if (error.message) {
          errorMessage = error.message;
        }

        throw new BadRequestException(`Chapa payment failed: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Verify a payment transaction
   * Note: Chapa stores the tx_ref we sent during initialization.
   * If we sent a shortened tx_ref (due to 50 char limit), we need to use that for verification.
   */
  async verifyPayment(
    txRef: string,
    orderId?: string,
  ): Promise<PaymentVerifyResponse> {
    try {
      this.logger.log(`Verifying Chapa payment: ${txRef}`);

      // Try to get the shortened txRef from transaction metadata if available
      let verifyTxRef = txRef;
      if (orderId) {
        try {
          this.logger.log(
            `🔍 Looking up Chapa txRef from metadata for orderId: ${orderId}`,
          );
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { transaction: true },
          });
          if (order?.transaction?.metadata) {
            const metadata = order.transaction.metadata as any;
            this.logger.log(
              `📦 Transaction metadata keys: ${Object.keys(metadata).join(", ")}`,
            );
            if (metadata.chapaTxRef) {
              verifyTxRef = metadata.chapaTxRef;
              this.logger.log(
                `✅ Using stored Chapa txRef from metadata: ${verifyTxRef}`,
              );
            } else {
              this.logger.warn(
                `⚠️ chapaTxRef not found in metadata. Will construct from txRef.`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ Order ${orderId} has no transaction or metadata`,
            );
          }
        } catch (error: any) {
          this.logger.warn(
            `❌ Failed to retrieve Chapa txRef from metadata: ${error?.message || error}`,
          );
        }
      } else {
        this.logger.warn(
          `⚠️ No orderId provided, cannot look up stored Chapa txRef`,
        );
      }

      // If still using original and it's longer than 50 chars, try to construct shortened version
      if (
        verifyTxRef === txRef &&
        txRef.length > 50 &&
        txRef.startsWith("TX-")
      ) {
        // Extract orderId from original format: TX-{orderId}-{timestamp}
        const withoutPrefix = txRef.substring(3); // Remove 'TX-'
        const lastDashIndex = withoutPrefix.lastIndexOf("-");
        if (lastDashIndex > 0) {
          const extractedOrderId = withoutPrefix.substring(0, lastDashIndex);
          const timestamp = withoutPrefix.substring(lastDashIndex + 1);
          // Construct shortened version: {orderId}-{shortTimestamp}
          const shortTimestamp = timestamp.slice(-8); // Last 8 digits
          verifyTxRef = `${extractedOrderId}-${shortTimestamp}`;
          this.logger.log(
            `Constructed shortened txRef for verification: ${verifyTxRef} (original was ${txRef.length} chars)`,
          );
        }
      }

      // Try verification with the txRef (original or shortened)
      let response;
      try {
        response = await axios.get<ChapaVerifyResponse>(
          `${this.baseUrl}/transaction/verify/${verifyTxRef}`,
          {
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
            },
          },
        );
      } catch (verifyError: any) {
        // If verification fails and we used a shortened version, try the original
        if (verifyTxRef !== txRef && axios.isAxiosError(verifyError)) {
          this.logger.warn(
            `Verification with shortened txRef failed, trying original: ${txRef}`,
          );
          response = await axios.get<ChapaVerifyResponse>(
            `${this.baseUrl}/transaction/verify/${txRef}`,
            {
              headers: {
                Authorization: `Bearer ${this.secretKey}`,
              },
            },
          );
        } else {
          throw verifyError;
        }
      }

      if (response.data.status === "success") {
        const data = response.data.data;
        const isSuccess = data.status === "success";

        return {
          success: isSuccess,
          message: isSuccess
            ? "Payment verified successfully"
            : `Payment status: ${data.status}`,
          data: {
            status: data.status,
            amount: parseFloat(data.amount),
            currency: data.currency,
            txRef: data.tx_ref,
            provider: "chapa",
            chargeResponseMessage: data.method || data.status,
            customerEmail: data.email,
            customerName:
              `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          },
        };
      } else {
        return {
          success: false,
          message: "Payment verification failed",
          data: {
            status: "failed",
            amount: 0,
            currency: "",
            txRef,
            provider: "chapa",
          },
        };
      }
    } catch (error) {
      this.logger.error("Chapa payment verification failed:", error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new BadRequestException(`Chapa verification failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Handle Chapa webhook callback
   */
  async handleWebhook(payload: any): Promise<any> {
    try {
      this.logger.log("Processing Chapa webhook");
      // Process webhook payload
      // You can update order status here based on the webhook data
      return {
        success: true,
        message: "Webhook processed",
      };
    } catch (error) {
      this.logger.error("Chapa webhook processing failed:", error);
      throw error;
    }
  }

  /**
   * Fetch banks from Chapa and normalize for clients.
   * Chapa returns `id` (used as bank_code for transfers) — not `code`.
   */
  async getBanks(): Promise<
    Array<{
      id: string;
      name: string;
      code: string;
      slug: string | null;
      isMobileMoney: boolean;
      accountLength: number | null;
    }>
  > {
    try {
      const response = await axios.get(`${this.baseUrl}/banks`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const raw = Array.isArray(response.data?.data)
        ? response.data.data
        : response.data?.status === "success" && Array.isArray(response.data.data)
          ? response.data.data
          : [];

      return raw
        .map((bank: any) => {
          const id = bank?.id != null ? String(bank.id) : "";
          const code =
            bank?.code != null && String(bank.code).trim() !== ""
              ? String(bank.code)
              : id;
          if (!code || !bank?.name) return null;
          return {
            id: id || code,
            name: String(bank.name),
            code,
            slug: bank?.slug != null ? String(bank.slug) : null,
            isMobileMoney: Boolean(
              bank?.is_mobilemoney === 1 ||
                bank?.is_mobilemoney === true ||
                bank?.isMobileMoney,
            ),
            accountLength:
              typeof bank?.acct_length === "number"
                ? bank.acct_length
                : typeof bank?.accountLength === "number"
                  ? bank.accountLength
                  : null,
          };
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error("Failed to fetch Chapa banks:", error);
      return [];
    }
  }

  /**
   * Initiate a bank transfer (Payout)
   */
  async initiateTransfer(data: {
    account_name: string;
    account_number: string;
    amount: number;
    bank_code: string;
    reference: string;
    currency?: string;
  }): Promise<any> {
    try {
      this.logger.log(`Initiating Chapa transfer: ${data.reference}`);

      const response = await axios.post(
        `${this.baseUrl}/transfers`,
        {
          account_name: data.account_name,
          account_number: data.account_number,
          amount: data.amount,
          currency: data.currency || "ETB",
          reference: data.reference,
          bank_code: data.bank_code,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status === "success") {
        this.logger.log(
          `Chapa transfer response for ${data.reference}:`,
          JSON.stringify(response.data, null, 2),
        );
        return {
          success: true,
          message: response.data.message || "Transfer initiated successfully",
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          message: response.data.message || "Transfer failed",
          data: response.data.data,
        };
      }
    } catch (error: any) {
      this.logger.error("Chapa transfer initiation failed:", error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        return {
          success: false,
          message: `Chapa API error: ${JSON.stringify(error.response?.data || message)}`,
          error: error.response?.data,
        };
      }
      return {
        success: false,
        message: error.message || "Unknown error during transfer",
      };
    }
  }

  /**
   * Attempt a Chapa refund by tx_ref / transaction reference.
   * Chapa refund APIs vary by account; treat ambiguous network errors as unknown.
   */
  async refundPayment(params: {
    txRef: string;
    amount: number;
    reason?: string;
    idempotencyKey: string;
  }): Promise<{
    outcome: "success" | "failed" | "unknown";
    gatewayRefundId?: string;
    message?: string;
  }> {
    try {
      if (!this.secretKey) {
        return { outcome: "failed", message: "Chapa secret key not configured" };
      }

      const response = await axios.post(
        `${this.baseUrl}/refund/${params.txRef}`,
        {
          amount: Math.round(params.amount * 100) / 100,
          reason: params.reason || "Dispute resolution refund",
          reference: params.idempotencyKey.slice(0, 50),
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30_000,
        },
      );

      if (response.data?.status === "success") {
        return {
          outcome: "success",
          gatewayRefundId:
            response.data?.data?.id ||
            response.data?.data?.refund_id ||
            params.idempotencyKey,
          message: response.data?.message,
        };
      }

      return {
        outcome: "failed",
        message: response.data?.message || "Chapa refund failed",
      };
    } catch (error: any) {
      if (error?.code === "ECONNABORTED" || !error?.response) {
        return {
          outcome: "unknown",
          message: error?.message || "Chapa refund network error",
        };
      }
      return {
        outcome: "failed",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Chapa refund failed",
      };
    }
  }
}
