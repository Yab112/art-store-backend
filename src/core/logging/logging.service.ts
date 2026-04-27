import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { RequestHelper } from "../../common/util/request";
import { Logger, LoggerService } from "../../libraries/logger";

// TODO change user service
@Injectable()
export class LoggingService {
  private logger: Logger;
  constructor(
    private loggerService: LoggerService,
    // private userService: any
  ) {
    this.logger = this.loggerService.create({ name: "LoggingInterceptor" });
  }

  logOnStart(request: Request): void {
    const path = RequestHelper.getPath(request);
    const method = RequestHelper.getMethod(request);

    // const authenticationPayload = this.userService.findUserById(userId)

    // const email = authenticationPayload?.user?.email ?? '???@???.com'
    // const name = authenticationPayload?.user?.name ?? '???'

    const email = "???@???.com";
    const name = "???";

    this.logger.log(`[START] ${name} - ${email} | ${method} ${path}`);
  }

  logOnStop(request: Request): void {
    const path = RequestHelper.getPath(request);
    const method = RequestHelper.getMethod(request);
    const email = "???@???.com";
    const name = "???";

    this.logger.log(`[STOP] ${name} - ${email} | ${method} ${path}`);
  }
}
