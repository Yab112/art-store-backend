import { WinstonLogger } from './internal/winston.service';

type LoggerOptions = {
  name?: string;
  instance: WinstonLogger;
};

export class Logger {
  private context: string;

  constructor(private options: LoggerOptions) {
    this.context = options.name || 'App';
  }

  log(message: string, context?: string): void {
    this.options.instance.log(message, context || this.context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.options.instance.error(message, trace, context || this.context);
  }

  warn(message: string, context?: string): void {
    this.options.instance.warn(message, context || this.context);
  }

  debug(message: string, context?: string): void {
    this.options.instance.debug(message, context || this.context);
  }

  verbose(message: string, context?: string): void {
    this.options.instance.verbose(message, context || this.context);
  }

  success(message: string, context?: string): void {
    this.options.instance.log(`✅ ${message}`, context || this.context);
  }

  info(message: string, context?: string): void {
    this.options.instance.log(`ℹ️ ${message}`, context || this.context);
  }
}
