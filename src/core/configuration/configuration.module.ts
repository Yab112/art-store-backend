import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigurationService } from "./configuration.service";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.ENV_FILE_PATH || "env/local.env",
      isGlobal: true,
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
