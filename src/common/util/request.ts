import { Request } from "express";

export const getRequestIp = (req: Request): string => {
  return req.ip || req.connection.remoteAddress || "unknown";
};

export const getRequestUserAgent = (req: Request): string => {
  return req.get("User-Agent") || "unknown";
};

export class RequestHelper {
  static getPath(request: Request): string {
    return request.path;
  }

  static getMethod(request: Request): string {
    return request.method;
  }
}
