import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import { PlaidService } from "./plaid.service";

@Controller("plaid")
export class PlaidController {
  constructor(private readonly plaid: PlaidService) {}

  /** Mobile calls this to start Plaid Link. */
  @Post("link-token")
  createLinkToken(@Body("userId") userId: string) {
    // TODO: derive userId from the authenticated session instead of the body.
    return this.plaid.createLinkToken(userId);
  }

  /** Mobile posts the public token here after the user finishes Link. */
  @Post("exchange")
  exchange(
    @Body("userId") userId: string,
    @Body("publicToken") publicToken: string,
  ) {
    return this.plaid.exchangePublicToken(userId, publicToken);
  }

  /** Manually trigger a re-sync for an item (also runs automatically on webhook). */
  @Post("items/:id/sync")
  sync(@Param("id") id: string) {
    return this.plaid.syncTransactions(id);
  }

  /** Plaid calls this webhook when new transaction data is available. */
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() payload: unknown) {
    await this.plaid.handleWebhook(payload);
    return { received: true };
  }
}
