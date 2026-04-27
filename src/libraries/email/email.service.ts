import { Injectable } from "@nestjs/common";
import { Logger, LoggerService } from "../logger";
import { ConfigurationService } from "../../core/configuration";
import * as nodemailer from "nodemailer";
import * as ejs from "ejs";
import * as path from "path";

type SendOptions = {
  name: string;
  email: string;
  subject: string;
  template: string;
  variables: Record<string, string>;
};

@Injectable()
export class EmailService {
  private logger: Logger;
  private transporter: nodemailer.Transporter;

  constructor(
    private loggerService: LoggerService,
    private configurationService: ConfigurationService,
  ) {
    this.logger = this.loggerService.create({ name: "EmailService" });
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.configurationService.get("SMTP_HOST"),
        port: parseInt(this.configurationService.get("SMTP_PORT") || "587"),
        secure: false, // true for 465, false for other ports
        requireTLS: true, // Force TLS for Gmail
        auth: {
          user: this.configurationService.get("SMTP_USER"),
          pass: this.configurationService.get("SMTP_PASS")?.trim(), // Trim whitespace
        },
        tls: {
          // Don't reject unauthorized certificates (for development)
          // In production, set this to true and use proper certificates
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 10000, // 10 seconds
        // Retry configuration
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          this.logger.error(
            `SMTP connection verification failed: ${error.message}`,
          );
        } else {
          this.logger.success("Email transporter initialized and verified");
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to initialize email transporter: ${error.message}`,
      );
    }
  }

  async send(options: SendOptions): Promise<void> {
    try {
      // const templatePath = path.join(
      //   __dirname,
      //   './templates/',
      //   `${options.template}.ejs`,
      // );
      const templatePath = path.join(
        process.cwd(),
        "templates",
        `${options.template}.ejs`,
      );
      const html = await ejs.renderFile(templatePath, options.variables);

      const mailOptions = {
        from: "eshetieyabibal@gmail.com",
        to: options.email,
        subject: options.subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${options.email}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }
}
