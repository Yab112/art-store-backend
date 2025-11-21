import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
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
      `Initialize payment request: ${initializePaymentDto.provider}`,
    );
    return this.paymentService.initializePayment(initializePaymentDto);
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
   */
  @Post('paypal/webhook')
  @HttpCode(HttpStatus.OK)
  async paypalWebhook(@Body() payload: any) {
    this.logger.log('PayPal webhook received');
    return this.paymentService.handlePaypalWebhook(payload);
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
