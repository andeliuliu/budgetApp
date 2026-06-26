import { Module } from "@nestjs/common";
import { CryptoService } from "../crypto/crypto.service";
import { PlaidController } from "./plaid.controller";
import { PlaidService } from "./plaid.service";

@Module({
  controllers: [PlaidController],
  providers: [PlaidService, CryptoService],
  exports: [PlaidService],
})
export class PlaidModule {}
