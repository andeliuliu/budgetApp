import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health/health.controller";
import { LedgerModule } from "./ledger/ledger.module";
import { PlaidModule } from "./plaid/plaid.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the monorepo-root .env first, then any app-local override.
      envFilePath: ["../../.env", ".env"],
    }),
    PrismaModule,
    PlaidModule,
    LedgerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
