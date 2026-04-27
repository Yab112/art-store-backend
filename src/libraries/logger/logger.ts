import { WinstonLogger } from "./internal/winston.service";

type LoggerOptions = {
  name?: string;
  instance: WinstonLogger;
};

export class Logger {
  private context: string;

  constructor(private options: LoggerOptions) {
    this.context = options.name || "App";
  }

  log(message: string, context?: string): void {
    this.options.instance.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.options.instance.error(message, {
      trace,
      context: context || this.context,
    });
  }

  warn(message: string, context?: string): void {
    this.options.instance.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string): void {
    this.options.instance.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string): void {
    this.options.instance.verbose(message, {
      context: context || this.context,
    });
  }

  success(message: string, context?: string): void {
    this.options.instance.info(`✅ ${message}`, {
      context: context || this.context,
    });
  }

  info(message: string, context?: string): void {
    this.options.instance.info(`ℹ️ ${message}`, {
      context: context || this.context,
    });
  }
}
