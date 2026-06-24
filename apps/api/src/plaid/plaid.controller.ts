import { Body, Controller, HttpCode, Post } from "@nestjs/common";
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
  exchange(@Body("publicToken") publicToken: string) {
    return this.plaid.exchangePublicToken(publicToken);
  }

  /** Plaid calls this webhook when new transaction data is available. */
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() payload: unknown) {
    await this.plaid.handleWebhook(payload);
    return { received: true };
  }
}
