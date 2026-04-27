import {
  ArgumentsHost,
  Catch,
  HttpException,
  ExceptionFilter as NestExceptionFilter,
} from "@nestjs/common";
import { Response } from "express";
import { ExceptionService } from "./exception.service";
import { PrismaClientValidationError } from "@prisma/client/runtime/library";

@Catch()
export class ExceptionFilter implements NestExceptionFilter {
  constructor(private exceptionService: ExceptionService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const { status, message, data } = this.getErrorResponse(exception);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      data,
    });
  }

  private getErrorResponse(exception: unknown) {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    } else if (exception instanceof PrismaClientValidationError) {
      return this.handlePrismaClientValidationError(exception);
    } else {
      return this.handleUnknownException(exception);
    }
  }

  private handleHttpException(exception: HttpException) {
    const status = exception.getStatus();
    if (this.exceptionService.isCustom(exception)) {
      const payload = this.exceptionService.getPayload(exception);
      return {
        status,
        message: payload.message,
        data: { code: payload.code },
      };
    } else {
      const payload = exception.getResponse() as any;
      return {
        status,
        message: exception.message,
        data: payload?.message || {},
      };
    }
  }

  private handlePrismaClientValidationError(
    exception: PrismaClientValidationError,
  ) {
    return {
      status: 422, // Unprocessable Entity
      message: "Prisma validation error",
      data: exception.message.replace(/\n/g, " "),
    };
  }

  private handleUnknownException(exception: any) {
    console.log({ exception });
    return {
      status: 500, // Internal Server Error
      message: "Internal server error",
      data: {},
    };
  }
}
