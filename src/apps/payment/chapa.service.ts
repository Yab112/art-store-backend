import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ChapaInitializeResponse,
  ChapaVerifyResponse,
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from './interfaces/payment-response.interface';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class ChapaService {
  private readonly logger = new Logger(ChapaService.name);
  private readonly baseUrl = 'https://api.chapa.co/v1';
  private readonly secretKey: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.secretKey = this.configService.get<string>('CHAPA_SECRET_KEY');
    if (!this.secretKey) {
      this.logger.warn('CHAPA_SECRET_KEY not configured');
    }
  }

  /**
   * Initialize a payment with Chapa
   */
  async initializePayment(
    paymentData: InitializePaymentDto,
  ): Promise<PaymentInitializeResponse> {
    try {
      // Chapa has strict length limits:
      // - tx_ref: max 50 characters
      // - customization.title: max 16 characters
      // - customization.description: max 50 characters
      
      // Shorten tx_ref if needed (Chapa limit: 50 chars)
      // Format: TX-{orderId}-{timestamp} can be too long
      // Use a shorter format: {orderId}-{shortTimestamp}
      let txRef = paymentData.txRef;
      if (txRef.length > 50) {
        // If txRef is too long, use just orderId + short timestamp
        if (paymentData.orderId) {
          const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits
          txRef = `${paymentData.orderId}-${shortTimestamp}`;
          // If still too long, truncate orderId
          if (txRef.length > 50) {
            const maxOrderIdLength = 50 - shortTimestamp.length - 1; // -1 for dash
            txRef = `${paymentData.orderId.substring(0, maxOrderIdLength)}-${shortTimestamp}`;
          }
        } else {
          // Fallback: truncate to 50 chars
          txRef = txRef.substring(0, 50);
        }
        this.logger.warn(`txRef truncated from ${paymentData.txRef.length} to ${txRef.length} characters: ${txRef}`);
      }

      // Shorten title (Chapa limit: 16 chars)
      const title = 'Artopia Payment'.substring(0, 16);

      // Shorten description (Chapa limit: 50 chars)
      let description = `Order ${paymentData.orderId || txRef}`;
      if (description.length > 50) {
        description = description.substring(0, 47) + '...';
      }

      // Build return URL with original txRef and orderId as query parameters
      // This ensures the frontend can verify the payment even if Chapa uses the shortened tx_ref
      const baseReturnUrl = paymentData.returnUrl || `${this.configService.get('FRONTEND_URL')}/payment/success`;
      const returnUrlParams = new URLSearchParams({
        txRef: paymentData.txRef, // Use original txRef for frontend
        provider: 'chapa',
      });
      if (paymentData.orderId) {
        returnUrlParams.append('orderId', paymentData.orderId);
      }
      const returnUrl = `${baseReturnUrl}?${returnUrlParams.toString()}`;

      const payload = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'ETB',
        email: paymentData.email,
        first_name: paymentData.firstName || '',
        last_name: paymentData.lastName || '',
        phone_number: paymentData.phoneNumber || '',
        tx_ref: txRef, // Use shortened txRef for Chapa API (max 50 chars)
        callback_url: paymentData.callbackUrl || `${this.configService.get('SERVER_BASE_URL')}/api/payment/chapa/callback`,
        return_url: returnUrl, // Include original txRef in return URL
        customization: {
          title: title,
          description: description,
        },
      };

      this.logger.log(`Initializing Chapa payment: ${paymentData.txRef}`);
      this.logger.log(`Chapa payload: ${JSON.stringify(payload, null, 2)}`);
      this.logger.log(`Chapa API URL: ${this.baseUrl}/transaction/initialize`);

      const response = await axios.post<ChapaInitializeResponse>(
        `${this.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.status === 'success') {
        // Return both original and shortened txRef for reference
        // The shortened one is what Chapa knows about
        const responseData: PaymentInitializeResponse = {
          success: true,
          message: 'Payment initialized successfully',
          data: {
            checkoutUrl: response.data.data.checkout_url,
            txRef: paymentData.txRef, // Original txRef for frontend
            provider: 'chapa',
          },
        };
        // Store shortened txRef in a way that can be accessed later
        if (txRef !== paymentData.txRef) {
          (responseData.data as any).chapaTxRef = txRef;
        }
        return responseData;
      } else {
        throw new BadRequestException('Failed to initialize payment');
      }
    } catch (error) {
      this.logger.error('Chapa payment initialization failed:', error);
      if (axios.isAxiosError(error)) {
        // Log the full error response for debugging
        this.logger.error('Chapa API Error Response:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
        });

        // Extract error message from different possible formats
        let errorMessage = 'Unknown error';
        const responseData = error.response?.data;
        
        if (typeof responseData === 'string') {
          errorMessage = responseData;
        } else if (responseData?.message) {
          // Chapa returns message as an object with field-specific errors
          if (typeof responseData.message === 'object') {
            // Format validation errors nicely
            const errors: string[] = [];
            Object.entries(responseData.message).forEach(([field, messages]) => {
              if (Array.isArray(messages)) {
                errors.push(`${field}: ${messages.join(', ')}`);
              } else {
                errors.push(`${field}: ${messages}`);
              }
            });
            errorMessage = errors.join('; ');
          } else {
            errorMessage = responseData.message;
          }
        } else if (responseData?.error) {
          errorMessage = typeof responseData.error === 'string' 
            ? responseData.error 
            : JSON.stringify(responseData.error);
        } else if (responseData?.data?.message) {
          errorMessage = responseData.data.message;
        } else if (responseData) {
          errorMessage = JSON.stringify(responseData);
        } else {
          errorMessage = error.message || 'Failed to initialize payment with Chapa';
        }

        this.logger.error(`Chapa error message: ${errorMessage}`);
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
  async verifyPayment(txRef: string, orderId?: string): Promise<PaymentVerifyResponse> {
    try {
      this.logger.log(`Verifying Chapa payment: ${txRef}`);

      // Try to get the shortened txRef from transaction metadata if available
      let verifyTxRef = txRef;
      if (orderId) {
        try {
          this.logger.log(`🔍 Looking up Chapa txRef from metadata for orderId: ${orderId}`);
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { transaction: true },
          });
          if (order?.transaction?.metadata) {
            const metadata = order.transaction.metadata as any;
            this.logger.log(`📦 Transaction metadata keys: ${Object.keys(metadata).join(', ')}`);
            if (metadata.chapaTxRef) {
              verifyTxRef = metadata.chapaTxRef;
              this.logger.log(`✅ Using stored Chapa txRef from metadata: ${verifyTxRef}`);
            } else {
              this.logger.warn(`⚠️ chapaTxRef not found in metadata. Will construct from txRef.`);
            }
          } else {
            this.logger.warn(`⚠️ Order ${orderId} has no transaction or metadata`);
          }
        } catch (error: any) {
          this.logger.warn(`❌ Failed to retrieve Chapa txRef from metadata: ${error?.message || error}`);
        }
      } else {
        this.logger.warn(`⚠️ No orderId provided, cannot look up stored Chapa txRef`);
      }

      // If still using original and it's longer than 50 chars, try to construct shortened version
      if (verifyTxRef === txRef && txRef.length > 50 && txRef.startsWith('TX-')) {
        // Extract orderId from original format: TX-{orderId}-{timestamp}
        const withoutPrefix = txRef.substring(3); // Remove 'TX-'
        const lastDashIndex = withoutPrefix.lastIndexOf('-');
        if (lastDashIndex > 0) {
          const extractedOrderId = withoutPrefix.substring(0, lastDashIndex);
          const timestamp = withoutPrefix.substring(lastDashIndex + 1);
          // Construct shortened version: {orderId}-{shortTimestamp}
          const shortTimestamp = timestamp.slice(-8); // Last 8 digits
          verifyTxRef = `${extractedOrderId}-${shortTimestamp}`;
          this.logger.log(`Constructed shortened txRef for verification: ${verifyTxRef} (original was ${txRef.length} chars)`);
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
          this.logger.warn(`Verification with shortened txRef failed, trying original: ${txRef}`);
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

      if (response.data.status === 'success') {
        const data = response.data.data;
        return {
          success: true,
          message: 'Payment verified successfully',
          data: {
            status: data.status,
            amount: parseFloat(data.amount),
            currency: data.currency,
            txRef: data.tx_ref,
            provider: 'chapa',
            chargeResponseMessage: data.method,
            customerEmail: data.email,
            customerName: `${data.first_name} ${data.last_name}`,
          },
        };
      } else {
        return {
          success: false,
          message: 'Payment verification failed',
          data: {
            status: 'failed',
            amount: 0,
            currency: '',
            txRef,
            provider: 'chapa',
          },
        };
      }
    } catch (error) {
      this.logger.error('Chapa payment verification failed:', error);
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
      this.logger.log('Processing Chapa webhook');
      // Process webhook payload
      // You can update order status here based on the webhook data
      return {
        success: true,
        message: 'Webhook processed',
      };
    } catch (error) {
      this.logger.error('Chapa webhook processing failed:', error);
      throw error;
    }
  }
}
