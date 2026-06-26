import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { LedgerController } from "./ledger.controller";

@Module({
  controllers: [LedgerController],
  providers: [SupabaseAuthGuard],
})
export class LedgerModule {}
