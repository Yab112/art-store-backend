import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Initialize a payment
   * POST /api/payment/initialize
   */
  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializePayment(@Body() initializePaymentDto: InitializePaymentDto) {
    this.logger.log(
      `Initialize payment request: ${JSON.stringify(initializePaymentDto)}`,
    );
    try {
      return await this.paymentService.initializePayment(initializePaymentDto);
    } catch (error: any) {
      this.logger.error(`Payment initialization error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify a payment
   * POST /api/payment/verify
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto) {
    this.logger.log(`Verify payment request: ${verifyPaymentDto.txRef}`);
    return this.paymentService.verifyPayment(verifyPaymentDto);
  }

  /**
   * Chapa callback endpoint
   * GET /api/payment/chapa/callback
   */
  @Get('chapa/callback')
  async chapaCallback(
    @Query('trx_ref') trxRef: string,
    @Query('status') status: string,
  ) {
    this.logger.log(`Chapa callback: ${trxRef} - ${status}`);
    return {
      success: true,
      message: 'Callback received',
      data: { trxRef, status },
    };
  }

  /**
   * Chapa webhook endpoint
   * POST /api/payment/chapa/webhook
   */
  @Post('chapa/webhook')
  @HttpCode(HttpStatus.OK)
  async chapaWebhook(@Body() payload: any) {
    this.logger.log('Chapa webhook received');
    return this.paymentService.handleChapaWebhook(payload);
  }

  /**
   * PayPal callback endpoint
   * GET /api/payment/paypal/callback
   */
  @Get('paypal/callback')
  async paypalCallback(@Query('token') token: string) {
    this.logger.log(`PayPal callback: ${token}`);
    return {
      success: true,
      message: 'Callback received',
      data: { token },
    };
  }

  /**
   * PayPal webhook endpoint
   * POST /api/payment/paypal/webhook
   * 
   * PayPal will send webhook events for:
   * - Payment events (PAYMENT.CAPTURE.COMPLETED, etc.)
   * - Payout batch events (PAYMENT.PAYOUTSBATCH.SUCCESS, etc.)
   * - Payout item events (PAYMENT.PAYOUTSITEM.SUCCESS, etc.)
   * 
   * For sandbox testing:
   * 1. Go to PayPal Developer Dashboard
   * 2. Navigate to your app > Webhooks
   * 3. Add webhook URL: https://your-ngrok-url.ngrok-free.dev/api/payment/paypal/webhook
   * 4. Select events: PAYMENT.PAYOUTSBATCH.* and PAYMENT.PAYOUTSITEM.*
   * 5. Use ngrok or similar for local testing: ngrok http 3000
   * 
   * IMPORTANT: For ngrok free tier, you may need to bypass the browser warning.
   * Add this header in PayPal webhook configuration if available, or use:
   * ngrok http 3000 --request-header-add "ngrok-skip-browser-warning: true"
   */
  @Post('paypal/webhook')
  @HttpCode(HttpStatus.OK)
  async paypalWebhook(
    @Body() payload: any,
    @Headers() headers: any,
  ) {
    try {
      const eventType = payload.event_type || 'unknown';
      
      this.logger.log(`PayPal webhook received: ${eventType}`);
      
      // Check if this is ngrok's browser warning page (common issue)
      if (payload && typeof payload === 'string' && payload.includes('ngrok')) {
        this.logger.error(`Received ngrok browser warning page instead of webhook payload`);
        return { success: false, message: 'Ngrok browser warning detected' };
      }
      
      // Validate payload structure
      if (!payload || typeof payload !== 'object' || !payload.event_type) {
        this.logger.error(`Invalid webhook payload structure`);
        return { success: false, message: 'Invalid webhook payload' };
      }
      
      const result = await this.paymentService.handlePaypalWebhook(payload, headers);
      
      this.logger.log(`Webhook processed successfully: ${eventType}`);
      return result;
    } catch (error: any) {
      // Always return 200 OK to PayPal even if processing fails
      this.logger.error(`PayPal webhook processing error: ${error.message || error}`);
      return {
        success: false,
        message: 'Webhook received but processing failed',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Capture PayPal payment
   * POST /api/payment/paypal/capture/:orderId
   */
  @Post('paypal/capture/:orderId')
  @HttpCode(HttpStatus.OK)
  async capturePaypalPayment(@Param('orderId') orderId: string) {
    this.logger.log(`Capture PayPal payment: ${orderId}`);
    return this.paymentService.capturePaypalPayment(orderId);
  }
}
