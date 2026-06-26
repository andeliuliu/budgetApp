import { Module } from "@nestjs/common";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard";
import { CryptoService } from "../crypto/crypto.service";
import { PlaidController } from "./plaid.controller";
import { PlaidService } from "./plaid.service";

@Module({
  controllers: [PlaidController],
  providers: [PlaidService, CryptoService, SupabaseAuthGuard],
  exports: [PlaidService],
})
export class PlaidModule {}
