import { Global, Module } from "@nestjs/common";
import { WinstonService } from "./internal/winston.service";
import { LoggerService } from "./logger.service";

@Global()
@Module({
  imports: [],
  providers: [WinstonService, LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
