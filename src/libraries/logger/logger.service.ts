import { Injectable } from '@nestjs/common';
import { WinstonLogger, WinstonService } from './internal/winston.service';
import { Logger } from './logger';

type CreateOptions = {
  name?: string;
};

@Injectable()
export class LoggerService {
  private instance: WinstonLogger;

  constructor(private winstonService: WinstonService) {
    this.instance = this.winstonService.create();
  }

  create(options?: CreateOptions): Logger {
    return new Logger({ ...options, instance: this.instance });
  }

  log(message: string, context?: string): void {
    this.instance.log(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.instance.error(message, trace, context);
  }

  warn(message: string, context?: string): void {
    this.instance.warn(message, context);
  }

  debug(message: string, context?: string): void {
    this.instance.debug(message, context);
  }

  verbose(message: string, context?: string): void {
    this.instance.verbose(message, context);
  }
}
