import { Injectable } from "@nestjs/common";
import * as winston from "winston";

export type WinstonLogger = winston.Logger;

@Injectable()
export class WinstonService {
  create(): WinstonLogger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.prettyPrint(),
      ),
      defaultMeta: { service: "finder-api" },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(
              ({ timestamp, level, message, context, ...meta }) => {
                const contextStr = context ? `[${context}]` : "";
                const metaStr = Object.keys(meta).length
                  ? JSON.stringify(meta)
                  : "";
                return `${timestamp} ${level} ${contextStr} ${message} ${metaStr}`.trim();
              },
            ),
          ),
        }),
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    });
  }
}
