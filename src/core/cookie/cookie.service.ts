import { Injectable } from "@nestjs/common";
import { CookieOptions, Request, Response } from "express";
import { ConfigurationService } from "../configuration";

import { SystemConst } from "@/common/constant/system.const";

@Injectable()
export class CookieService {
  constructor(private configurationService: ConfigurationService) {}

  getAccessToken(request: Request): string {
    return request.cookies[SystemConst.REFRESH_COOKIE];
  }

  setAccessToken(response: Response, token: string): void {
    const options = this.getOptions();
    response.cookie(SystemConst.REFRESH_COOKIE, token, options);
  }

  deleteAccessToken(response: Response): void {
    response.clearCookie(SystemConst.REFRESH_COOKIE);
  }

  private getOptions(): CookieOptions {
    const REFRESH_TOKEN_EXP = this.configurationService.getNumber(
      "JWT_REFRESH_EXPIRY_TIME",
    );
    const options: Record<string, CookieOptions> = {
      development: {
        maxAge: 24 * 60 * 60 * 1000 * REFRESH_TOKEN_EXP,
        secure: true,
        httpOnly: false,
        sameSite: "lax",
      },
      production: {
        maxAge: 24 * 60 * 60 * 1000 * REFRESH_TOKEN_EXP,
        secure: true,
        httpOnly: true,
        sameSite: "none",
      },
      staging: {
        maxAge: REFRESH_TOKEN_EXP,
        secure: true,
        httpOnly: true,
        sameSite: "none",
      },
    };

    const environment = this.configurationService.getEnvironment();

    const valueDefault = options["development"];

    const value = options[environment];

    return value ?? valueDefault;
  }
}
