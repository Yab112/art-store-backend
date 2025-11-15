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

@Injectable()
export class ChapaService {
  private readonly logger = new Logger(ChapaService.name);
  private readonly baseUrl = 'https://api.chapa.co/v1';
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
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
      const payload = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'ETB',
        email: paymentData.email,
        first_name: paymentData.firstName || '',
        last_name: paymentData.lastName || '',
        phone_number: paymentData.phoneNumber || '',
        tx_ref: paymentData.txRef,
        callback_url: paymentData.callbackUrl || `${this.configService.get('SERVER_BASE_URL')}/api/payment/chapa/callback`,
        return_url: paymentData.returnUrl || `${this.configService.get('FRONTEND_URL')}/payment/success`,
        customization: {
          title: 'Art Gallery Payment',
          description: `Payment for order ${paymentData.orderId || paymentData.txRef}`,
        },
      };

      this.logger.log(`Initializing Chapa payment: ${paymentData.txRef}`);

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
        return {
          success: true,
          message: 'Payment initialized successfully',
          data: {
            checkoutUrl: response.data.data.checkout_url,
            txRef: paymentData.txRef,
            provider: 'chapa',
          },
        };
      } else {
        throw new BadRequestException('Failed to initialize payment');
      }
    } catch (error) {
      this.logger.error('Chapa payment initialization failed:', error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new BadRequestException(`Chapa payment failed: ${message}`);
      }
      throw error;
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(txRef: string): Promise<PaymentVerifyResponse> {
    try {
      this.logger.log(`Verifying Chapa payment: ${txRef}`);

      const response = await axios.get<ChapaVerifyResponse>(
        `${this.baseUrl}/transaction/verify/${txRef}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

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
