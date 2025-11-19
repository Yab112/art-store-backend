import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PaymentInitializeResponse,
  PaymentVerifyResponse,
} from './interfaces/payment-response.interface';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('PAYPAL_CLIENT_SECRET');
    const mode = this.configService.get<string>('PAYPAL_MODE') || 'sandbox';

    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('PayPal credentials not configured');
      this.logger.warn(`PAYPAL_CLIENT_ID: ${this.clientId ? 'Set (hidden)' : 'NOT SET'}`);
      this.logger.warn(`PAYPAL_CLIENT_SECRET: ${this.clientSecret ? 'Set (hidden)' : 'NOT SET'}`);
    } else {
      this.logger.log(`PayPal configured for ${mode} mode`);
      this.logger.log(`PayPal base URL: ${this.baseUrl}`);
    }
  }

  /**
   * Get PayPal access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to get PayPal access token:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error_description || error.response?.data?.error || error.message;
        this.logger.error(`PayPal API Error: ${JSON.stringify(error.response?.data)}`);
        throw new BadRequestException(`PayPal authentication failed: ${errorMessage}. Check your CLIENT_ID and CLIENT_SECRET.`);
      }
      throw new BadRequestException('PayPal authentication failed. Please check your credentials.');
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

      const frontendUrl = this.configService.get('FRONTEND_URL');
      const baseReturnUrl = paymentData.returnUrl || `${frontendUrl}/payment/success`;
      
      const payload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: paymentData.txRef,
            description: `Art Gallery Order ${paymentData.orderId || paymentData.txRef}`,
            amount: {
              currency_code: paymentData.currency || 'USD',
              value: paymentData.amount.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: 'Art Gallery',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${baseReturnUrl}?provider=paypal`,
          cancel_url: paymentData.callbackUrl || `${frontendUrl}/payment/cancel`,
        },
      };

      this.logger.log(`Initializing PayPal payment: ${paymentData.txRef}`);

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const approvalUrl = response.data.links.find(
        (link: any) => link.rel === 'approve',
      )?.href;

      if (!approvalUrl) {
        throw new BadRequestException('PayPal approval URL not found');
      }

      // PayPal will return with token parameter (order ID) in the return URL
      // We return the PayPal order ID as txRef for verification
      return {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          checkoutUrl: approvalUrl,
          txRef: response.data.id, // PayPal order ID
          provider: 'paypal',
        },
      };
    } catch (error) {
      this.logger.error('PayPal payment initialization failed:', error);
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('PayPal payment capture failed:', error);
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
      if (status === 'APPROVED') {
        this.logger.log(`Capturing approved PayPal order: ${orderId}`);
        try {
          const captureResponse = await axios.post(
            `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
            {},
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          status = captureResponse.data.status;
          this.logger.log(`PayPal order captured successfully: ${orderId}, status: ${status}`);
        } catch (captureError) {
          this.logger.error(`Failed to capture PayPal order ${orderId}:`, captureError);
          // Continue with verification even if capture fails
        }
      }

      const isSuccess = status === 'COMPLETED' || status === 'APPROVED';
      
      // Get the original txRef from reference_id (stored when order was created)
      const originalTxRef = purchaseUnit.reference_id || orderId;

      return {
        success: isSuccess,
        message: isSuccess ? 'Payment verified successfully' : 'Payment not completed',
        data: {
          status: isSuccess ? 'success' : status.toLowerCase(),
          amount: parseFloat(purchaseUnit.amount.value),
          currency: purchaseUnit.amount.currency_code,
          txRef: orderId, // PayPal order ID
          originalTxRef: originalTxRef, // Original TX-{orderId}-{timestamp} format
          provider: 'paypal',
          chargeResponseMessage: status,
          customerEmail: order.payer?.email_address,
          customerName: `${order.payer?.name?.given_name || ''} ${order.payer?.name?.surname || ''}`,
        },
      };
    } catch (error) {
      this.logger.error('PayPal payment verification failed:', error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new BadRequestException(`PayPal verification failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Handle PayPal webhook
   */
  async handleWebhook(payload: any): Promise<any> {
    try {
      this.logger.log('Processing PayPal webhook');
      // Process webhook payload
      // You can update order status here based on the webhook data
      return {
        success: true,
        message: 'Webhook processed',
      };
    } catch (error) {
      this.logger.error('PayPal webhook processing failed:', error);
      throw error;
    }
  }
}
