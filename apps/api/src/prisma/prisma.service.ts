import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (err) {
      // Let the app boot without a DB in dev (e.g. health checks); Prisma will
      // connect lazily on the first query once DATABASE_URL points somewhere real.
      this.logger.warn(
        `Database not reachable at startup: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
