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
      throw new BadRequestException('PayPal authentication failed');
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
          return_url: paymentData.returnUrl || `${this.configService.get('FRONTEND_URL')}/payment/success`,
          cancel_url: paymentData.callbackUrl || `${this.configService.get('FRONTEND_URL')}/payment/cancel`,
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

      return {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          checkoutUrl: approvalUrl,
          txRef: response.data.id,
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
   */
  async verifyPayment(orderId: string): Promise<PaymentVerifyResponse> {
    try {
      const accessToken = await this.getAccessToken();

      this.logger.log(`Verifying PayPal payment: ${orderId}`);

      const response = await axios.get(
        `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const order = response.data;
      const status = order.status;
      const purchaseUnit = order.purchase_units[0];

      return {
        success: status === 'COMPLETED' || status === 'APPROVED',
        message: 'Payment verified successfully',
        data: {
          status: status.toLowerCase(),
          amount: parseFloat(purchaseUnit.amount.value),
          currency: purchaseUnit.amount.currency_code,
          txRef: orderId,
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
